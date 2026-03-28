/**
 * Orchestrator
 *
 * Central pipeline that:
 * 1. Resolves company from user input
 * 2. Checks cache, dispatches 3 agents in parallel
 * 3. Runs ratio engine → scorers → red flags → LLM synthesis
 * 4. Returns complete report object
 * 5. Optionally streams SSE progress updates
 */

import { resolveCompany, resolveCompanyEnhanced, getSuggestions } from "../config/companyResolver.js";
import { getCachedOrFresh, getCache, setCache, deleteCache, clearInFlight } from "../cache/cacheLayer.js";
import { runFinancialAgent } from "../agents/financialAgent.js";
import { runLegalAgent } from "../agents/legalAgent.js";
import { runSentimentAgent } from "../agents/sentimentAgent.js";
import { runInsiderAgent } from "../agents/insiderAgent.js";
import { runAnnualReportAgent } from "../agents/annualReportAgent.js";
import { discoverCompetitors } from "../agents/competitorAgent.js";
import { withTinyFishBudget, getTinyFishBudgetSnapshot } from "../agents/tinyfish.js";
import { computeAllRatios, computeRatioMomentum } from "../engine/ratioEngine.js";
import { computeFinancialScore } from "../engine/financialScorer.js";
import { computeLegalScore } from "../engine/legalScorer.js";
import { computeSentimentScore } from "../engine/sentimentScorer.js";
import { computeCompanyIQ } from "../engine/compositeScorer.js";
import { detectRedFlags } from "../engine/redFlagEngine.js";
import { classifyHeadlines, generateSynthesis } from "../synthesis/llmSynthesis.js";
import { validateFinancialData, validateLegalData, validateSentimentData, computeDataConfidence } from "../engine/qualityGates.js";
import { generateFinancialWaterfall, generateLegalWaterfall, generateSentimentWaterfall, generateOverallWaterfall } from "../engine/waterfallEngine.js";
import { detectGovernancePatterns } from "../engine/governancePatterns.js";
import { computeContextWeights } from "../engine/contextEngine.js";
import { detectAnomalies } from "../engine/anomalyDetector.js";

// ─── Deep Analysis Modules (12 new engines) ─────────────────────────────
import { computeAccountingQuality } from "../engine/accountingQuality.js";
import { computeCapitalAllocation } from "../engine/capitalAllocation.js";
import { computeManagementQuality } from "../engine/managementQuality.js";
import { computeMoatAnalysis } from "../engine/moatAnalysis.js";
import { computeESGAnalysis } from "../engine/esgAnalysis.js";
import { computeShareholdingAnalysis } from "../engine/shareholdingAnalysis.js";
import { computeCreditAnalysis } from "../engine/creditAnalysis.js";
import { computeTechInnovation } from "../engine/techInnovation.js";
import { computeSupplyChainRisk } from "../engine/supplyChainRisk.js";
import { computeValuation } from "../engine/valuationEngine.js";
import { computeInsiderTracking } from "../engine/insiderTracking.js";
import { computeIndustryKPIs } from "../engine/industryKPIs.js";
import { buildRelationshipGraph } from "../engine/relationshipGraph.js";
import { computeMultiHorizon } from "../engine/multiHorizon.js";
import { generateReportDiff } from "../engine/reportDiff.js";
import { detectAdversarialPatterns } from "../engine/adversarialDetection.js";
import { recordPeerScore, computePeerBenchmark } from "../engine/peerBenchmark.js";
import { recordScoreSnapshot, computeScoreTrend } from "../engine/scoreTrend.js";
import { saveReport, saveScoreHistory, savePeerScore, getLatestReportByTier, deleteReportsByTicker } from "../db/database.js";
import config from "../config/env.js";

// ─── Circuit Breaker: per-agent timeout wrapper ─────────────────────────

const AGENT_TIMEOUT_MS = 0; // 0 = disabled (no timeout - let TinyFish take required time)
const backgroundHydrations = new Map();

function withOptionalTimeout(promise, timeoutMs, label) {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }
  return withTimeout(promise, timeoutMs, label);
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[CircuitBreaker] ${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// ─── Progress / SSE helpers ─────────────────────────────────────────────

function createProgressEmitter(sseRes) {
  const steps = [];
  return {
    emit(phase, message, pct) {
      const event = { phase, message, pct, ts: Date.now() };
      steps.push(event);
      if (sseRes && !sseRes.writableEnded) {
        sseRes.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    },
    steps,
  };
}

// ─── Report tiers ───────────────────────────────────────────────────────

export const TIERS = {
  free_score: {
    includeFinancials: true,
    includeLegal: true,
    includeSentiment: true,
    includeSynthesis: false,
    includeInsider: false,
    includeAnnualReport: false,
    includeCompetitors: false,
  },
  quick_scan: {
    includeFinancials: true,
    includeLegal: true,
    includeSentiment: true,
    includeSynthesis: false,
    includeInsider: true,
    includeAnnualReport: false,
    includeCompetitors: true,
  },
  standard: {
    includeFinancials: true,
    includeLegal: true,
    includeSentiment: true,
    includeSynthesis: true,
    includeInsider: true,
    includeAnnualReport: true,
    includeCompetitors: true,
  },
};

// ─── Main Pipeline ──────────────────────────────────────────────────────

/**
 * Run the complete due-diligence pipeline for a company.
 *
 * @param {string} userInput - Company name/ticker from the user
 * @param {string} tier      - "free_score" | "quick_scan" | "standard"
 * @param {object} [sseRes]  - Express response object for SSE streaming (optional)
 * @returns {Promise<object>} Full report object
 */
export async function runPipeline(userInput, tier = "free_score", sseRes = null, options = {}) {
  const {
    forceFull = false,
    backgroundHydration = true,
    economyMode = false,
    cacheOnly = false,
    forceRefresh = false,  // When true: bypass ALL caches and run completely fresh
  } = options;
  const progress = createProgressEmitter(sseRes);
  const tierConfig = TIERS[tier] || TIERS.free_score;
  const fastMode = !forceFull && Boolean(config.performance?.fastMode) && tier !== "standard";
  const maxReportMs = config.performance?.maxReportMs || 30000;
  const fastAgentTimeoutMs = config.performance?.fastAgentTimeoutMs || 18000;

  // ── Step 1: Resolve company ──────────────────────────────────────────
  progress.emit("resolve", "Resolving company...", 5);

  // Try standard resolve first, then fall back to enhanced (with LLM)
  let company = await resolveCompany(userInput);
  if (!company) {
    const enhanced = await resolveCompanyEnhanced(userInput);
    if (enhanced.company) {
      company = enhanced.company;
    } else {
      const suggestions = enhanced.suggestions;
      const suggText = suggestions.length > 0
        ? ` Did you mean: ${suggestions.map(s => `${s.name} (${s.ticker})`).join(", ")}?`
        : "";
      const error = { error: true, message: `Company "${userInput}" not found in our database.${suggText}`, suggestions };
      if (sseRes && !sseRes.writableEnded) {
        sseRes.write(`data: ${JSON.stringify({ phase: "error", ...error })}\n\n`);
        sseRes.end();
      }
      return error;
    }
  }

  progress.emit("resolve", `Identified: ${company.name} (${company.ticker})`, 10);

  const cacheBaseKey = `report:${company.ticker}:${tier}`;
  const fastCacheKey = `${cacheBaseKey}:fast`;
  const fullCacheKey = `${cacheBaseKey}:full`;
  const cacheTtlMs = (config.cache?.ttlHours || 24) * 3600 * 1000;

  const resolveBudgetMaxCalls = () => {
    if (!config.tinyfish?.budgetEnabled) return Number.POSITIVE_INFINITY;
    if (tier === "free_score") return config.tinyfish?.budgetFreeScoreCalls || 6;
    if (tier === "quick_scan") return config.tinyfish?.budgetQuickScanCalls || 10;
    if (tier === "standard") return config.tinyfish?.budgetStandardCalls || 16;
    return config.tinyfish?.budgetFreeScoreCalls || 6;
  };

  // ── Force-refresh: wipe all cached data so analysis runs from scratch ───────
  if (forceRefresh) {
    console.log(`[Orchestrator] FORCE-REFRESH requested for ${company.ticker} — clearing all caches.`);
    deleteCache(fullCacheKey);
    deleteCache(fastCacheKey);
    clearInFlight(fullCacheKey);
    clearInFlight(fastCacheKey);
    try {
      const del = deleteReportsByTicker(company.ticker);
      console.log(`[Orchestrator] Deleted ${del.changes} stale DB report(s) for ${company.ticker}.`);
    } catch (e) {
      console.warn(`[Orchestrator] Could not clear DB reports for ${company.ticker}:`, e.message);
    }
  }

  // Prefer full cached report when available.
  const fullCached = !forceRefresh && getCache(fullCacheKey);
  if (fullCached !== undefined && fullCached !== false) {
    console.log(`[Orchestrator] IN-MEMORY CACHE HIT for ${fullCacheKey} — returning cached report.`);
    return fullCached;
  }

  // Reuse latest persisted DB report within TTL (survives server restarts).
  if (!forceRefresh) {
    const dbCached = getLatestReportByTier(company.ticker, tier);
    if (dbCached?.report && dbCached.created_at) {
      const cachedSteps = Number(dbCached.report?.metadata?.totalSteps || 0);
      const looksLikeFallbackOnly = cachedSteps <= 0;
      const createdAtMs = new Date(String(dbCached.created_at).replace(" ", "T") + "Z").getTime();
      const isFresh = Number.isFinite(createdAtMs) && Date.now() - createdAtMs <= cacheTtlMs;
      if (isFresh && !looksLikeFallbackOnly) {
        console.log(`[Orchestrator] DB CACHE HIT for ${company.ticker}:${tier} (created ${dbCached.created_at}) — returning cached report.`);
        setCache(fullCacheKey, dbCached.report);
        return dbCached.report;
      } else if (isFresh && looksLikeFallbackOnly) {
        console.log(`[Orchestrator] Skipping DB cache for ${company.ticker}:${tier} because cached report has zero TinyFish steps.`);
      } else {
        console.log(`[Orchestrator] DB cache STALE for ${company.ticker}:${tier} (created ${dbCached.created_at}, age ${Math.round((Date.now() - createdAtMs) / 60000)}min) — will run fresh.`);
      }
    } else {
      console.log(`[Orchestrator] No DB cache for ${company.ticker}:${tier} — will run fresh.`);
    }
  } else {
    console.log(`[Orchestrator] FORCE-REFRESH: skipping DB cache for ${company.ticker}:${tier}.`);
  }

  // Strict cache-only mode: do not invoke TinyFish when cache miss occurs.
  if (cacheOnly) {
    return {
      error: true,
      cacheOnlyMiss: true,
      message: `No recent cached report found for ${company.ticker} (${tier}).`,
      company: {
        name: company.name,
        ticker: company.ticker,
        sector: company.sector,
      },
      tier,
    };
  }

  const selectedCacheKey = fastMode ? fastCacheKey : fullCacheKey;

  // ── Cache check ──────────────────────────────────────────────────────
  return getCachedOrFresh(selectedCacheKey, async () =>
    withTinyFishBudget(
      {
        maxCalls: resolveBudgetMaxCalls(),
        label: `${company.ticker}:${tier}`,
      },
      async () => {
        const startTime = Date.now();
    const deadlineAt = fastMode ? startTime + maxReportMs : Number.POSITIVE_INFINITY;
    const timeLeft = () => deadlineAt - Date.now();
    const shouldSkipHeavy = () => fastMode && timeLeft() < 5000;
    const isVercelRuntime = Boolean(process.env.VERCEL);
    const useVercelLiteFreeTier = isVercelRuntime && tier === "free_score";
    const currentAgentTimeoutMs = fastMode
      ? Math.min(fastAgentTimeoutMs, Math.max(timeLeft() - 3000, 10000))
      : AGENT_TIMEOUT_MS;
    const skipNonFinancialAgents = (economyMode && tier === "free_score") || useVercelLiteFreeTier;
    const agentErrors = {};
    let partial = false;

    // ── Step 2: Run agents in parallel ───────────────────────────────
    console.log(`[Orchestrator] STARTING AGENTS for ${company.ticker} (tier=${tier}, fastMode=${fastMode}, skipNonFinancial=${skipNonFinancialAgents})`);
    progress.emit("agents", "Launching data collection agents...", 15);

    const agentPromises = [];

    // 0 means no client-side timeout (wait until TinyFish completes).
    const defaultTimeout = parseInt(process.env.TINYFISH_TIMEOUT_MS || "0", 10);

    // Financial agent (with circuit breaker)
    agentPromises.push(
      withOptionalTimeout(
        runFinancialAgent(
          company,
          (msg) => progress.emit("financial", msg, 25),
          { liteMode: useVercelLiteFreeTier }
        ),
        currentAgentTimeoutMs,
        "Financial Agent"
      ).catch((err) => {
          agentErrors.financial = err?.message || "Unknown financial agent error";
          if (fastMode && String(err.message || "").includes("timed out")) {
            console.warn("[Orchestrator] Financial agent deferred by fast window:", err.message);
          } else {
            console.error("[Orchestrator] Financial agent failed:", err.message);
          }
          return null;
        })
    );

    // Legal agent (with circuit breaker)
    if (!skipNonFinancialAgents) {
      agentPromises.push(
        withOptionalTimeout(
          runLegalAgent(company, (msg) => progress.emit("legal", msg, 35)),
          currentAgentTimeoutMs,
          "Legal Agent"
        ).catch((err) => {
            agentErrors.legal = err?.message || "Unknown legal agent error";
            if (fastMode && String(err.message || "").includes("timed out")) {
              console.warn("[Orchestrator] Legal agent deferred by fast window:", err.message);
            } else {
              console.error("[Orchestrator] Legal agent failed:", err.message);
            }
            return null;
          })
      );
    } else {
      agentPromises.push(Promise.resolve(null));
    }

    // Sentiment agent (with circuit breaker)
    if (!skipNonFinancialAgents) {
      agentPromises.push(
        withOptionalTimeout(
          runSentimentAgent(company, (msg) => progress.emit("sentiment", msg, 45)),
          currentAgentTimeoutMs,
          "Sentiment Agent"
        ).catch((err) => {
            agentErrors.sentiment = err?.message || "Unknown sentiment agent error";
            if (fastMode && String(err.message || "").includes("timed out")) {
              console.warn("[Orchestrator] Sentiment agent deferred by fast window:", err.message);
            } else {
              console.error("[Orchestrator] Sentiment agent failed:", err.message);
            }
            return null;
          })
      );
    } else {
      agentPromises.push(Promise.resolve(null));
    }

    // Insider/Promoter agent — quick_scan and standard tiers only
    if (tierConfig.includeInsider) {
      agentPromises.push(
        withOptionalTimeout(
          runInsiderAgent(company, (msg) => progress.emit("insider", msg, 40)),
          currentAgentTimeoutMs,
          "Insider Agent"
        ).catch((err) => {
            agentErrors.insider = err?.message || "Unknown insider agent error";
            if (fastMode && String(err.message || "").includes("timed out")) {
              console.warn("[Orchestrator] Insider agent deferred by fast window:", err.message);
            } else {
              console.error("[Orchestrator] Insider agent failed:", err.message);
            }
            return null;
          })
      );
    } else {
      agentPromises.push(Promise.resolve(null));
    }

    // Annual Report agent — standard tier only
    if (tierConfig.includeAnnualReport) {
      agentPromises.push(
        withOptionalTimeout(
          runAnnualReportAgent(company, (msg) => progress.emit("annualReport", msg, 42)),
          currentAgentTimeoutMs,
          "Annual Report Agent"
        ).catch((err) => {
            agentErrors.annualReport = err?.message || "Unknown annual report agent error";
            if (fastMode && String(err.message || "").includes("timed out")) {
              console.warn("[Orchestrator] Annual Report agent deferred by fast window:", err.message);
            } else {
              console.error("[Orchestrator] Annual Report agent failed:", err.message);
            }
            return null;
          })
      );
    } else {
      agentPromises.push(Promise.resolve(null));
    }

    const [financialData, legalData, sentimentData, insiderData, annualReportData] = await Promise.all(agentPromises);

    // If fast mode timed out any core agent, return partial and rely on background full hydration.
    const hasCoreData = financialData && (skipNonFinancialAgents || legalData) && (skipNonFinancialAgents || sentimentData);
    if (fastMode && !hasCoreData) {
      partial = true;
      progress.emit("agents", "Fast window reached; continuing full analysis in background...", 50);
    }

    progress.emit("agents", "All agents completed.", 50);

    // ── Step 3: Compute ratios ───────────────────────────────────────
    progress.emit("compute", "Computing financial ratios...", 55);
    const allRatios = financialData ? computeAllRatios(financialData) : {};

    // ── Step 3b: Ratio Momentum Tracker ──────────────────────────────
    progress.emit("compute", "Computing ratio trajectories...", 57);
    const trajectories = financialData ? computeRatioMomentum(financialData, allRatios) : {};

    // ── Step 3c: Quality Gates ───────────────────────────────────────
    progress.emit("quality", "Validating data quality...", 58);
    const financialGate = validateFinancialData(financialData);
    const legalGate = validateLegalData(legalData);

    // ── Step 4: Classify headlines via LLM ───────────────────────────
    progress.emit("classify", "Classifying news sentiment...", 60);
    let classifiedArticles = [];

    if (sentimentData?.articles?.length > 0) {
      if (shouldSkipHeavy()) {
        partial = true;
        progress.emit("classify", "Skipping deep headline classification to meet fast deadline...", 60);
      } else {
        classifiedArticles = await withOptionalTimeout(
          classifyHeadlines(
            company.name,
            company.ticker,
            sentimentData.articles
          ),
          Math.min(Math.max(timeLeft(), 1000), 8000),
          "Headline Classification"
        ).catch(() => {
          partial = true;
          return [];
        });
      }
    }

    const sentimentGate = validateSentimentData(sentimentData, classifiedArticles);
    const dataConfidence = computeDataConfidence(financialGate, legalGate, sentimentGate);

    // ── Step 5: Compute pillar scores ────────────────────────────────
    progress.emit("score", "Scoring pillars...", 70);

    const financialScore = computeFinancialScore(allRatios);
    const legalScore = computeLegalScore(legalData || {});
    const sentimentScore = computeSentimentScore(classifiedArticles);

    // ── Step 6: Red flags ────────────────────────────────────────────
    progress.emit("flags", "Detecting red flags...", 75);
    const redFlags = detectRedFlags(allRatios, legalData || {}, sentimentScore);

    // ── Step 6b: Governance Pattern Detection ────────────────────────
    progress.emit("governance", "Detecting governance patterns...", 77);
    const governance = detectGovernancePatterns(legalData || {}, allRatios, trajectories, redFlags);

    // ── Step 6c: Anomaly Detection ───────────────────────────────────
    progress.emit("anomaly", "Scanning for accounting anomalies...", 78);
    const anomalies = detectAnomalies(financialData, allRatios);

    // ── Step 6d: Adversarial Data Detection ─────────────────────────
    progress.emit("adversarial", "Scanning for adversarial patterns...", 78.5);
    const adversarialReport = detectAdversarialPatterns(
      classifiedArticles,
      sentimentData?.articles || [],
      financialScore.score,
      sentimentScore.score
    );

    // ── Step 6e: Deep Analysis (12 modules — each isolated so one failure never kills others) ─────
    progress.emit("deepAnalysis", "Running deep analysis engines...", 79);
    const deepAnalysis = {};

    const runModule = (name, fn) => {
      try {
        deepAnalysis[name] = fn();
      } catch (err) {
        console.error(`[Orchestrator] Deep module "${name}" failed (non-fatal):`, err.message);
        deepAnalysis[name] = null;
      }
    };

    runModule("accountingQuality", () => financialData ? computeAccountingQuality(financialData, allRatios) : null);
    runModule("capitalAllocation", () => financialData ? computeCapitalAllocation(financialData, allRatios, company.sector) : null);
    runModule("managementQuality", () => computeManagementQuality(financialData, legalData || {}, allRatios));
    runModule("moatAnalysis", () => financialData ? computeMoatAnalysis(financialData, allRatios, company.sector) : null);
    runModule("esgAnalysis", () => computeESGAnalysis(financialData, legalData || {}, company.sector));
    runModule("shareholdingAnalysis", () => computeShareholdingAnalysis(legalData || {}));
    runModule("creditAnalysis", () => financialData ? computeCreditAnalysis(financialData, allRatios) : null);
    runModule("techInnovation", () => computeTechInnovation(financialData, legalData || {}, company.sector));
    runModule("supplyChainRisk", () => computeSupplyChainRisk(financialData, legalData || {}, company.sector));
    runModule("valuation", () => financialData ? computeValuation(financialData, allRatios, company.sector) : null);
    runModule("insiderTracking", () => computeInsiderTracking(legalData || {}, financialData));
    runModule("industryKPIs", () => computeIndustryKPIs(financialData, legalData || {}, allRatios, company.sector));

    const modulesRun = Object.values(deepAnalysis).filter(m => m !== null).length;
    console.log(`[Orchestrator] Deep analysis: ${modulesRun}/12 modules completed.`);


    // Compute deep analysis summary score (average of available modules)
    const deepScores = Object.values(deepAnalysis).filter(m => m && typeof m.score === "number").map(m => m.score);
    const deepAnalysisScore = deepScores.length > 0 ? Math.round(deepScores.reduce((s, v) => s + v, 0) / deepScores.length) : null;

    // ── Step 7: Composite score (context-aware) ──────────────────────
    progress.emit("composite", "Computing CompanyIQ score...", 80);

    const composite = computeCompanyIQ(
      financialScore.score,
      legalScore,
      sentimentScore,
      redFlags,
      { sector: company.sector, allRatios }
    );

    // ── Step 7b: Waterfall Explainers ────────────────────────────────
    progress.emit("waterfall", "Generating score explanations...", 82);
    const waterfalls = {
      financial: generateFinancialWaterfall(allRatios, financialScore.breakdown, financialScore.score, company.sector),
      legal: generateLegalWaterfall(legalData || {}, legalScore.flags || [], legalScore.score, company.sector),
      sentiment: generateSentimentWaterfall(sentimentScore, classifiedArticles, company.sector),
      overall: generateOverallWaterfall({
        financialScore: financialScore.score,
        legalScore: legalScore.score,
        sentimentScore: sentimentScore.score,
        weights: composite.weights || { financial: 0.45, legal: 0.30, sentiment: 0.25 },
        flagAdjustment: composite.breakdown?.flagAdjustment || 0,
        finalScore: composite.score,
        sector: company.sector,
        redFlags,
      }),
    };

    // ── Step 8: LLM Synthesis (paid tiers only) ──────────────────────
    let synthesis = null;

    if (tierConfig.includeSynthesis) {
      if (shouldSkipHeavy()) {
        partial = true;
        progress.emit("synthesis", "Skipping synthesis to meet fast deadline...", 85);
      } else {
        progress.emit("synthesis", "Generating AI executive summary...", 85);
        synthesis = await withOptionalTimeout(
          generateSynthesis(company.name, company.ticker, {
            financial: {
              latestRevenue: financialData?.profitAndLoss?.annual?.[0]?.revenue,
              ratios: allRatios,
              score: financialScore.score,
            },
            legal: {
              shareholding: legalData?.shareholding,
              directorChangeCount: legalData?.announcements?.filter(
                (a) => a.category === "Director Change"
              ).length || 0,
              score: legalScore.score,
            },
            sentiment: sentimentScore,
            redFlags,
            compositeScore: composite.score,
            rating: composite.rating,
          }),
          Math.min(Math.max(timeLeft(), 1000), 8000),
          "LLM Synthesis"
        ).catch(() => {
          partial = true;
          return null;
        });
      }
    }

    progress.emit("done", "Report ready!", 100);

    // ── Step 9: Assemble final report ────────────────────────────────
    const durationMs = Date.now() - startTime;

    const report = {
      company: {
        name: company.name,
        ticker: company.ticker,
        sector: company.sector,
        industry: company.industry,
        bseCode: company.bseCode,
        nseSymbol: company.nseSymbol,
      },
      tier,
      companyIQ: composite.score,
      rating: composite.rating,
      ratingColor: composite.color,
      pillarScores: {
        financial: financialScore.score,
        legal: legalScore.score,
        sentiment: sentimentScore.score,
      },
      weights: composite.weights || { financial: 0.45, legal: 0.30, sentiment: 0.25 },
      weightContext: composite.weightContext || null,
      dataConfidence,
      metadata: {
        generatedAt: new Date().toISOString(),
        durationMs,
        partial,
        economyMode,
        fastMode,
        vercelLiteMode: useVercelLiteFreeTier,
        tinyfishBudget: getTinyFishBudgetSnapshot(),
        agentErrors,
        agentSteps: {
          financial: financialData?.metadata?.totalSteps || 0,
          legal: legalData?.metadata?.totalSteps || 0,
          sentiment: sentimentData?.metadata?.totalSteps || 0,
        },
        totalSteps:
          (financialData?.metadata?.totalSteps || 0) +
          (legalData?.metadata?.totalSteps || 0) +
          (sentimentData?.metadata?.totalSteps || 0),
        agentHealth: {
          financial: financialData !== null,
          legal: legalData !== null,
          sentiment: sentimentData !== null,
          insider: insiderData !== null,
          annualReport: annualReportData !== null,
        },
      },
    };

    // Include detail sections based on tier
    if (tierConfig.includeFinancials) {
      report.financial = {
        score: financialScore.score,
        breakdown: financialScore.breakdown,
        ratios: allRatios,
        trajectories,
        waterfall: waterfalls.financial,
        raw: {
          profitLoss: financialData?.profitAndLoss || null,
          balanceSheet: financialData?.balanceSheet || null,
          cashFlow: financialData?.cashFlow || null,
        },
      };
    }

    if (tierConfig.includeLegal) {
      report.legal = {
        score: legalScore.score,
        flags: legalScore.flags,
        waterfall: waterfalls.legal,
        governance,
        shareholding: legalData?.shareholding || null,
        announcements: legalData?.announcements || null,
        directors: legalData?.directors || null,
      };
    }

    if (tierConfig.includeSentiment) {
      report.sentiment = {
        score: sentimentScore.score,
        positive: sentimentScore.positive,
        negative: sentimentScore.negative,
        neutral: sentimentScore.neutral,
        total: sentimentScore.total,
        topThemes: sentimentScore.topThemes,
        flags: sentimentScore.flags,
        waterfall: waterfalls.sentiment,
        articles: classifiedArticles.slice(0, 15),
      };
    }

    report.redFlags = redFlags;
    report.waterfall = waterfalls.overall;
    report.anomalies = anomalies;
    report.adversarialAnalysis = adversarialReport;
    report.deepAnalysis = deepAnalysis;
    report.deepAnalysisScore = deepAnalysisScore;
    report.relationshipGraph = buildRelationshipGraph(company, legalData, financialData);
    report.multiHorizon = computeMultiHorizon(
      financialScore.score, legalScore.score, sentimentScore.score,
      deepAnalysisScore, deepAnalysis, redFlags
    );

    // ── Insider / Promoter Deep Dive ─────────────────────────────────
    if (tierConfig.includeInsider && insiderData) {
      report.insiderActivity = insiderData;
    }

    // ── Annual Report ────────────────────────────────────────────────
    if (tierConfig.includeAnnualReport && annualReportData) {
      report.annualReport = annualReportData;
      // Merge any annual report risk signals into red flags
      if (annualReportData.riskSignals?.length > 0) {
        report.redFlags = [...(report.redFlags || []), ...annualReportData.riskSignals];
      }
    }

    // ── Competitor Auto-Discovery ────────────────────────────────────
    if (tierConfig.includeCompetitors) {
      if (shouldSkipHeavy()) {
        partial = true;
        report.competitors = null;
      } else {
        try {
          progress.emit("competitors", "Discovering competitors...", 88);
          report.competitors = await withOptionalTimeout(
            discoverCompetitors(
              company,
              (msg) => progress.emit("competitors", msg, 89)
            ),
            Math.min(Math.max(timeLeft(), 1000), 5000),
            "Competitor Discovery"
          ).catch(() => null);
          if (report.competitors === null) partial = true;
        } catch (compErr) {
          console.error("[Orchestrator] Competitor discovery failed (non-fatal):", compErr.message);
          report.competitors = null;
        }
      }
    }

    // Add deep analysis summary to pillar scores for free tier visibility
    if (deepAnalysisScore !== null) {
      report.pillarScores.deepAnalysis = deepAnalysisScore;
    }

    if (tierConfig.includeSynthesis && synthesis) {
      report.synthesis = synthesis;
    }

    // Generate diff against previous report (if exists in cache)
    report.diff = generateReportDiff(company.ticker, report);

    // ── Peer Benchmark ───────────────────────────────────────────────
    // Only record peer score if sector is available
    if (company.sector) {
      try {
        recordPeerScore(company.ticker, company.sector, {
          companyIQ: composite.score,
          financial: financialScore.score,
          legal: legalScore.score,
          sentiment: sentimentScore.score,
          deepAnalysis: deepAnalysisScore,
        });
        report.peerBenchmark = computePeerBenchmark(company.ticker, company.sector, {
          companyIQ: composite.score,
          financial: financialScore.score,
          legal: legalScore.score,
          sentiment: sentimentScore.score,
          deepAnalysis: deepAnalysisScore,
        });
      } catch (peerErr) {
        console.warn("[Orchestrator] Peer benchmark error (non-fatal):", peerErr.message);
      }
    }

    // ── Score Trend ──────────────────────────────────────────────────
    report.scoreTrend = computeScoreTrend(company.ticker, {
      companyIQ: composite.score,
      financial: financialScore.score,
      legal: legalScore.score,
      sentiment: sentimentScore.score,
      deepAnalysis: deepAnalysisScore,
    });
    recordScoreSnapshot(company.ticker, {
      companyIQ: composite.score,
      financial: financialScore.score,
      legal: legalScore.score,
      sentiment: sentimentScore.score,
      deepAnalysis: deepAnalysisScore,
    });

    // ── Persist to SQLite ────────────────────────────────────────────
    const hasTinyFishSteps = Number(report.metadata?.totalSteps || 0) > 0;
    if (hasTinyFishSteps) {
      try {
        saveReport(company.ticker, tier, company.name, company.sector, composite.score, composite.rating, report);
        saveScoreHistory(company.ticker, {
          companyIQ: composite.score,
          financial: financialScore.score,
          legal: legalScore.score,
          sentiment: sentimentScore.score,
          deepAnalysis: deepAnalysisScore,
        });
        savePeerScore(company.ticker, company.sector, {
          companyIQ: composite.score,
          financial: financialScore.score,
          legal: legalScore.score,
          sentiment: sentimentScore.score,
          deepAnalysis: deepAnalysisScore,
        });
      } catch (dbErr) {
        console.error("[Orchestrator] DB persistence error (non-fatal):", dbErr.message);
      }
    } else {
      console.warn("[Orchestrator] Skipping DB persistence because TinyFish returned zero steps.");
    }

    // Close SSE if streaming
    if (sseRes && !sseRes.writableEnded) {
      sseRes.write(`data: ${JSON.stringify({ phase: "complete", report })}\n\n`);
      sseRes.end();
    }

    // Persist full-quality report as canonical cache entry.
    if (!report.metadata?.partial && hasTinyFishSteps) {
      setCache(fullCacheKey, report);
    }

    // If a fast/partial report was returned, continue full hydration in background.
    if (
      fastMode &&
      report.metadata?.partial &&
      backgroundHydration &&
      config.performance?.backgroundHydration &&
      tier !== "free_score" &&
      !economyMode &&
      getCache(fullCacheKey) === undefined &&
      !backgroundHydrations.has(fullCacheKey)
    ) {
      const hydratePromise = (async () => {
        try {
          const fullReport = await runPipeline(company.ticker, tier, null, {
            forceFull: true,
            backgroundHydration: false,
          });
          if (fullReport && !fullReport.error) {
            setCache(fullCacheKey, fullReport);
          }
        } catch (err) {
          console.error("[Orchestrator] Background full hydration failed:", err.message);
        } finally {
          backgroundHydrations.delete(fullCacheKey);
        }
      })();

      backgroundHydrations.set(fullCacheKey, hydratePromise);
    }

        return report;
      }
    )
  );
}

export default { runPipeline, TIERS };
