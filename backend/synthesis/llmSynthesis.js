/**
 * LLM Synthesis Layer
 *
 * Uses Groq API (free tier) with Llama models:
 * 1. Classify news headlines — llama-3.1-8b-instant (fast, high RPD limit)
 * 2. Generate executive summary — llama-3.3-70b-versatile (quality)
 *
 * Groq free tier: 14.4K RPD for 8b, 1K RPD for 70b — more than enough for hackathon.
 * API is OpenAI-compatible.
 */

import Groq from "groq-sdk";
import config from "../config/env.js";
import crypto from "crypto";
import { getCache, setCache } from "../cache/cacheLayer.js";

let client = null;

function getClient() {
  if (!client) {
    client = new Groq({ apiKey: config.groq.apiKey });
  }
  return client;
}

function stableHash(input) {
  return crypto.createHash("sha1").update(JSON.stringify(input)).digest("hex");
}

function uniqByNormalizedHeadline(articles) {
  const seen = new Set();
  const out = [];
  for (const a of articles || []) {
    const key = String(a?.headline || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/**
 * Retry wrapper for Groq API calls with exponential backoff on 429 rate limits.
 */
async function groqWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const is429 = error?.status === 429 || error?.message?.includes("429");
      if (is429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(`[LLM] Rate limited (429). Retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

// ─── 1. Sentiment Classification ────────────────────────────────────────

/**
 * Classify news headlines by sentiment and topic using Groq (Llama 3.1 8B).
 *
 * @param {string} companyName
 * @param {string} ticker
 * @param {Array<{headline: string, date: string}>} articles
 * @returns {Promise<Array<{headline: string, sentiment: string, topic: string, date: string}>>}
 */
export async function classifyHeadlines(companyName, ticker, articles) {
  if (!articles || articles.length === 0) return [];

  const maxHeadlines = Math.max(4, config.groq?.classificationMaxHeadlines || 12);
  const uniqueArticles = uniqByNormalizedHeadline(articles).slice(0, maxHeadlines);

  // Token-saving mode: use deterministic heuristic classifier (no LLM call).
  if (!config.groq?.enableClassification) {
    return fallbackClassification(uniqueArticles);
  }
  const classificationKey = `llm:classify:${ticker}:${stableHash({
    model: config.groq.classificationModel,
    companyName,
    headlines: uniqueArticles.map((a) => [a.headline, a.date]),
  })}`;
  const cachedClassification = getCache(classificationKey);
  if (cachedClassification) {
    return cachedClassification;
  }

  const headlineList = uniqueArticles
    .map((a, i) => `${i + 1}. "${a.headline}" (${a.date})`)
    .join("\n");

  const prompt = `You are a financial sentiment analyst. Below are ${uniqueArticles.length} news headlines about ${companyName} (${ticker}).

Classify each headline as POSITIVE, NEGATIVE, or NEUTRAL from an investment perspective.
Also assign a topic category from this list:
[Financial Results, Leadership, Regulatory, Competition, Product Launch, Controversy, Market Expansion, M&A, Dividend, Partnership, Other]

Return ONLY a JSON array (no markdown, no explanation):
[
  { "index": 1, "sentiment": "POSITIVE", "topic": "Financial Results" },
  { "index": 2, "sentiment": "NEGATIVE", "topic": "Controversy" }
]

Headlines:
${headlineList}`;

  try {
    const response = await groqWithRetry(() =>
      getClient().chat.completions.create({
        model: config.groq.classificationModel,
        max_tokens: Math.min(700, 120 + uniqueArticles.length * 24),
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a financial sentiment classifier. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      })
    );

    const text = response.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("[LLM] Could not parse classification response");
      return fallbackClassification(articles);
    }

    const classified = JSON.parse(jsonMatch[0]);

    // Merge classification back into articles
    const classifiedResult = uniqueArticles.map((article, i) => {
      const match = classified.find((c) => c.index === i + 1);
      return {
        headline: article.headline,
        source: article.source,
        date: article.date,
        snippet: article.snippet,
        sentiment: match?.sentiment || "NEUTRAL",
        topic: match?.topic || "Other",
        confidence: match ? 0.85 : 0.50, // LLM classified vs unmatched fallback
        classifiedBy: "llm",
      };
    });
    setCache(classificationKey, classifiedResult, 6 * 3600);
    return classifiedResult;
  } catch (error) {
    console.error("[LLM] Classification failed:", error.message);
    return fallbackClassification(uniqueArticles);
  }
}

/**
 * Fallback: keyword-based classification when Groq API is unavailable.
 */
function fallbackClassification(articles) {
  const positiveKeywords = [
    "surge", "rise", "gain", "profit", "growth", "strong", "beat", "record",
    "upgrade", "bullish", "rally", "expansion", "outperform", "dividend",
    "increase", "jumps", "soars", "exceeds", "positive",
  ];
  const negativeKeywords = [
    "fall", "drop", "loss", "decline", "crash", "slump", "concern", "risk",
    "scandal", "fraud", "warning", "downgrade", "bearish", "plunge", "cut",
    "layoff", "fine", "penalty", "trouble", "threat",
  ];

  return articles.map((article) => {
    const hl = (article.headline || "").toLowerCase();
    const isPositive = positiveKeywords.some((kw) => hl.includes(kw));
    const isNegative = negativeKeywords.some((kw) => hl.includes(kw));

    let sentiment = "NEUTRAL";
    if (isPositive && !isNegative) sentiment = "POSITIVE";
    else if (isNegative && !isPositive) sentiment = "NEGATIVE";

    return {
      ...article,
      sentiment,
      topic: "Other",
      confidence: isPositive || isNegative ? 0.60 : 0.40, // Keyword match confidence
      classifiedBy: "fallback",
    };
  });
}

// ─── 2. Executive Summary Generation ────────────────────────────────────

/**
 * Generate executive summary and investment thesis from all report data.
 *
 * @param {string} companyName
 * @param {string} ticker
 * @param {object} data - Complete report data
 * @returns {Promise<{executiveSummary: string, strengths: string[], risks: string[], investmentThesis: string}>}
 */
export async function generateSynthesis(companyName, ticker, data) {
  const { financial, legal, sentiment, redFlags, compositeScore, rating } = data;

  if (!config.groq?.enableSynthesis) {
    return {
      executiveSummary: `${companyName} (${ticker}) has a CompanyIQ score of ${compositeScore}/100 (${rating}). Financial score is ${financial?.score ?? "N/A"}, legal score is ${legal?.score ?? "N/A"}, and sentiment score is ${sentiment?.score ?? "N/A"}.`,
      strengths: [],
      risks: (redFlags || []).slice(0, 5).map((f) => `${f.severity}: ${f.message}`),
      investmentThesis: "Synthesis disabled for cost control. Use detailed sections for full assessment.",
    };
  }

  const synthInput = {
    model: config.groq.synthesisModel,
    companyName,
    ticker,
    compositeScore,
    rating,
    financial: {
      latestRevenue: financial?.latestRevenue,
      score: financial?.score,
      ratios: {
        netProfitMargin: financial?.ratios?.netProfitMargin,
        ebitdaMargin: financial?.ratios?.ebitdaMargin,
        returnOnEquity: financial?.ratios?.returnOnEquity,
        currentRatio: financial?.ratios?.currentRatio,
        debtToEquity: financial?.ratios?.debtToEquity,
        revenueCAGR3yr: financial?.ratios?.revenueCAGR3yr,
        pe: financial?.ratios?.pe,
      },
    },
    legal: {
      score: legal?.score,
      promoterHolding: legal?.shareholding?.latest?.promoterHolding,
      pledgedPercent: legal?.shareholding?.latest?.pledgedPercent,
      directorChangeCount: legal?.directorChangeCount,
      fiiHolding: legal?.shareholding?.latest?.fiiHolding,
    },
    sentiment: {
      score: sentiment?.score,
      positive: sentiment?.positive,
      negative: sentiment?.negative,
      neutral: sentiment?.neutral,
      topThemes: (sentiment?.topThemes || []).slice(0, 5).map((t) => t.theme),
    },
    redFlags: (redFlags || []).slice(0, 8).map((f) => ({ severity: f.severity, message: f.message })),
  };

  const synthesisKey = `llm:synthesis:${ticker}:${stableHash(synthInput)}`;
  const cachedSynthesis = getCache(synthesisKey);
  if (cachedSynthesis) {
    return cachedSynthesis;
  }

  const prompt = `You are a senior equity research analyst writing a due diligence summary for "${companyName}" (${ticker}).

You have been given the following data, all extracted live from public sources:

FINANCIAL DATA:
- Revenue (latest annual): ₹${financial?.latestRevenue || "N/A"} Cr
- Net Profit Margin: ${financial?.ratios?.netProfitMargin?.toFixed(1) || "N/A"}%
- EBITDA Margin: ${financial?.ratios?.ebitdaMargin?.toFixed(1) || "N/A"}%
- ROE: ${financial?.ratios?.returnOnEquity?.toFixed(1) || "N/A"}%
- Current Ratio: ${financial?.ratios?.currentRatio || "N/A"}
- Debt-to-Equity: ${financial?.ratios?.debtToEquity || "N/A"}
- Revenue CAGR (3yr): ${financial?.ratios?.revenueCAGR3yr?.toFixed(1) || "N/A"}%
- P/E: ${financial?.ratios?.pe || "N/A"}
- Financial Score: ${financial?.score || "N/A"}/100

LEGAL & GOVERNANCE:
- Promoter Holding: ${legal?.shareholding?.latest?.promoterHolding || "N/A"}%
- Pledging: ${legal?.shareholding?.latest?.pledgedPercent || 0}%
- Director Changes (12mo): ${legal?.directorChangeCount || 0}
- FII Holding: ${legal?.shareholding?.latest?.fiiHolding || "N/A"}%
- Legal Score: ${legal?.score || "N/A"}/100

NEWS SENTIMENT:
- Positive: ${sentiment?.positive || 0}, Negative: ${sentiment?.negative || 0}, Neutral: ${sentiment?.neutral || 0}
- Top Themes: ${sentiment?.topThemes?.map((t) => t.theme).join(", ") || "N/A"}
- Sentiment Score: ${sentiment?.score || "N/A"}/100

RED FLAGS (top):
${(redFlags || []).slice(0, 8).map((f) => `${f.severity}: ${f.message}`).join("\n") || "None detected"}

OVERALL CompanyIQ SCORE: ${compositeScore}/100 — ${rating}

Generate the following sections in valid JSON format:

{
  "executiveSummary": "A 3 to 5 sentence plain conversational English summary that answers: is this company fundamentally strong or risky and why, what is the single most important positive signal, what is the single most important risk to watch, and what is the plain-English bottom line recommendation. End with a one-line bottom line wrapped in **bold**.",
  "strengths": ["Exactly 3 bullet points, each a one-line plain English description of a positive outlier signal"],
  "risks": ["Exactly 3 bullet points, each a one-line plain English description of a negative outlier risk or concern"],
  "investmentThesis": "2 paragraphs. Para 1: Bull case. Para 2: Bear case."
}

Be specific with numbers. Reference actual data points. Write in a professional, direct tone suitable for a CA or financial advisor. Do not add disclaimers.`;

  try {
    const response = await groqWithRetry(() =>
      getClient().chat.completions.create({
        model: config.groq.synthesisModel,
        max_tokens: config.groq.maxTokens,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a senior equity research analyst. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      })
    );

    const text = response.choices?.[0]?.message?.content || "";

    // Try to parse as JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        setCache(synthesisKey, parsed, 6 * 3600);
        return parsed;
      } catch {
        // Fall through to text parsing
      }
    }

    // Fallback: return raw text
    const fallback = {
      executiveSummary: text,
      strengths: [],
      risks: [],
      investmentThesis: "",
    };
    setCache(synthesisKey, fallback, 2 * 3600);
    return fallback;
  } catch (error) {
    console.error("[LLM] Synthesis failed:", error.message);
    return {
      executiveSummary: `CompanyIQ analysis of ${companyName} (${ticker}) yielded a score of ${compositeScore}/100 (${rating}). The AI summary could not be generated due to a temporary service issue. Please review the detailed data sections above for the complete analysis.`,
      strengths: ["Data available in detailed sections above"],
      risks: ["Data available in detailed sections above"],
      investmentThesis: "Please review the detailed financial, legal, and sentiment data above to form your investment thesis.",
    };
  }
}

export default { classifyHeadlines, generateSynthesis };
