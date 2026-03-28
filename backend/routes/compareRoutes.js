/**
 * Compare Routes — Side-by-side company comparison
 *
 * GET /api/compare?a=<company1>&b=<company2>
 * Runs two free_score pipelines in parallel and returns a comparison object.
 */

import { Router } from "express";
import orchestrator from "../orchestrator/orchestrator.js";

const router = Router();

/**
 * GET /api/compare?a=<company1>&b=<company2>
 */
router.get("/", async (req, res) => {
  try {
    const { a, b } = req.query;

    if (!a || !b) {
      return res.status(400).json({
        error: true,
        message: "Both 'a' and 'b' query parameters are required.",
      });
    }

    const companyA = String(a).trim();
    const companyB = String(b).trim();

    if (companyA.toLowerCase() === companyB.toLowerCase()) {
      return res.status(400).json({
        error: true,
        message: "Please provide two different companies to compare.",
      });
    }

    console.log(`[Compare] Starting comparison: ${companyA} vs ${companyB}`);
    const startTime = Date.now();

    const economyMode = String(req.query.economy || "1") !== "0";
    const cacheOnly = String(req.query.cacheOnly || "0") === "1";

    // Run both pipelines in parallel
    const [reportA, reportB] = await Promise.all([
      orchestrator.runPipeline(companyA, "free_score", null, {
        economyMode,
        backgroundHydration: false,
        cacheOnly,
      }),
      orchestrator.runPipeline(companyB, "free_score", null, {
        economyMode,
        backgroundHydration: false,
        cacheOnly,
      }),
    ]);

    if (cacheOnly && (reportA?.cacheOnlyMiss || reportB?.cacheOnlyMiss)) {
      const missing = [reportA, reportB]
        .filter((r) => r?.cacheOnlyMiss)
        .map((r) => r?.company?.ticker || "UNKNOWN");

      return res.status(412).json({
        error: true,
        cacheOnlyMiss: true,
        message: `Cache-only mode: missing cached data for ${missing.join(", ")}. Run once without cacheOnly to warm cache.`,
        missingTickers: missing,
        metadata: {
          generatedAt: new Date().toISOString(),
          economyMode,
          cacheOnly,
        },
      });
    }

    if (reportA.error) {
      return res.status(404).json({ error: true, message: `Company A: ${reportA.message}` });
    }
    if (reportB.error) {
      return res.status(404).json({ error: true, message: `Company B: ${reportB.message}` });
    }

    const durationMs = Date.now() - startTime;

    // Build comparison metrics
    const metrics = buildComparisonMetrics(reportA, reportB);

    return res.json({
      companyA: reportA,
      companyB: reportB,
      comparison: {
        winner: reportA.companyIQ >= reportB.companyIQ ? reportA.company?.name : reportB.company?.name,
        scoreDiff: Math.abs(reportA.companyIQ - reportB.companyIQ),
        metrics,
      },
      metadata: {
        durationMs,
        generatedAt: new Date().toISOString(),
        economyMode,
        cacheOnly,
      },
    });
  } catch (error) {
    console.error("[Compare] Failed:", error.message);
    return res.status(500).json({
      error: true,
      message: "Comparison failed. Please try again.",
    });
  }
});

/**
 * Build a structured comparison table of key metrics.
 */
function buildComparisonMetrics(a, b) {
  const metrics = [];

  const add = (label, valA, valB, format = "num", higherBetter = true) => {
    const numA = typeof valA === "number" ? valA : null;
    const numB = typeof valB === "number" ? valB : null;
    let winner = "tie";
    if (numA != null && numB != null) {
      if (higherBetter) {
        winner = numA > numB ? "A" : numA < numB ? "B" : "tie";
      } else {
        winner = numA < numB ? "A" : numA > numB ? "B" : "tie";
      }
    }
    metrics.push({ label, valueA: numA, valueB: numB, format, winner });
  };

  // Scores
  add("CompanyIQ Score", a.companyIQ, b.companyIQ);
  add("Financial Score", a.pillarScores?.financial, b.pillarScores?.financial);
  add("Legal Score", a.pillarScores?.legal, b.pillarScores?.legal);
  add("Sentiment Score", a.pillarScores?.sentiment, b.pillarScores?.sentiment);
  add("Deep Analysis Score", a.deepAnalysisScore, b.deepAnalysisScore);

  // Financial ratios
  const ra = a.financial?.ratios || {};
  const rb = b.financial?.ratios || {};

  add("Net Profit Margin", ra.netProfitMargin, rb.netProfitMargin, "pct");
  add("ROE", ra.returnOnEquity, rb.returnOnEquity, "pct");
  add("ROCE", ra.roce, rb.roce, "pct");
  add("Current Ratio", ra.currentRatio, rb.currentRatio);
  add("Debt/Equity", ra.debtToEquity, rb.debtToEquity, "num", false);
  add("Revenue CAGR (3yr)", ra.revenueCAGR3yr, rb.revenueCAGR3yr, "pct");
  add("P/E Ratio", ra.pe, rb.pe, "num", false);
  add("P/B Ratio", ra.pb, rb.pb, "num", false);
  add("EV/EBITDA", ra.evEbitda, rb.evEbitda, "num", false);

  // Red flags (fewer is better)
  add("Red Flags", a.redFlags?.length || 0, b.redFlags?.length || 0, "num", false);

  // Deep Analysis Module Scores
  const daModules = [
    "accountingQuality", "capitalAllocation", "managementQuality", "moatAnalysis",
    "esgAnalysis", "shareholdingAnalysis", "creditAnalysis", "techInnovation",
    "supplyChainRisk", "valuationEngine", "insiderTracking", "industryKPIs",
  ];
  const labelMap = {
    accountingQuality: "Accounting Quality",
    capitalAllocation: "Capital Allocation",
    managementQuality: "Management Quality",
    moatAnalysis: "Economic Moat",
    esgAnalysis: "ESG Score",
    shareholdingAnalysis: "Shareholding",
    creditAnalysis: "Credit Quality",
    techInnovation: "Tech & Innovation",
    supplyChainRisk: "Supply Chain Risk",
    valuationEngine: "Valuation",
    insiderTracking: "Insider Activity",
    industryKPIs: "Industry KPIs",
  };
  for (const mod of daModules) {
    const invertRisk = mod === "supplyChainRisk";
    add(
      labelMap[mod] || mod,
      a.deepAnalysis?.[mod]?.score ?? null,
      b.deepAnalysis?.[mod]?.score ?? null,
      "num",
      !invertRisk
    );
  }

  return metrics;
}

export default router;
