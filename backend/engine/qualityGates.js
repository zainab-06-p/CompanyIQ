/**
 * Data Quality Gates
 *
 * Validates each agent's output before it enters scoring.
 * Failed sources are excluded with warnings rather than silently wrong.
 *
 * Derived from ResearchIQ: specialists that failed quality gates were
 * excluded entirely rather than contaminating the ensemble.
 *
 * Each gate returns:
 *   { passed: boolean, confidence: number (0-1), issues: string[], sourceStatus: object }
 */

// ─── Financial Agent Quality Gate ────────────────────────────────────────

/**
 * Validate financial agent data completeness.
 *
 * @param {object|null} financialData - Raw output from runFinancialAgent()
 * @returns {{ passed: boolean, confidence: number, issues: string[], sourceStatus: object }}
 */
export function validateFinancialData(financialData) {
  const issues = [];
  const sourceStatus = {
    profitAndLoss: "missing",
    balanceSheet: "missing",
    cashFlowRatios: "missing",
  };
  let dataPoints = 0;
  const totalExpected = 3; // P&L, BS, CF

  if (!financialData) {
    return {
      passed: false,
      confidence: 0,
      issues: ["Financial agent returned no data"],
      sourceStatus,
    };
  }

  // Check P&L data
  const quarterly = financialData.profitAndLoss?.quarterly || [];
  const annual = financialData.profitAndLoss?.annual || [];

  if (quarterly.length >= 4 && annual.length >= 1) {
    sourceStatus.profitAndLoss = "complete";
    dataPoints++;
  } else if (quarterly.length > 0 || annual.length > 0) {
    sourceStatus.profitAndLoss = "partial";
    dataPoints += 0.5;
    issues.push(
      `P&L data partial: ${quarterly.length} quarters (need 4+), ${annual.length} years`
    );
  } else {
    issues.push("No P&L data extracted from Screener.in");
  }

  // Check Balance Sheet data
  const bs = financialData.balanceSheet || [];
  if (bs.length >= 1 && bs[0].totalAssets > 0) {
    sourceStatus.balanceSheet = "complete";
    dataPoints++;
  } else if (bs.length > 0) {
    sourceStatus.balanceSheet = "partial";
    dataPoints += 0.5;
    issues.push("Balance sheet data partial — missing key fields");
  } else {
    issues.push("No balance sheet data extracted");
  }

  // Check Cash Flow / Ratios data
  const cf = financialData.cashFlow || [];
  const ratios = financialData.ratiosSummary;

  if ((cf.length >= 1 && cf[0].operatingCF !== null) || ratios) {
    sourceStatus.cashFlowRatios = ratios ? "complete" : "partial";
    dataPoints += ratios ? 1 : 0.5;
    if (!ratios) {
      issues.push("Ratios summary not available — using computed ratios only");
    }
  } else {
    issues.push("No cash flow or ratio data available");
  }

  // Revenue sanity check
  const latestRevenue = annual[0]?.revenue || quarterly[0]?.revenue;
  if (latestRevenue !== null && latestRevenue !== undefined && latestRevenue <= 0) {
    issues.push("Revenue ≤ 0 — possible data extraction error");
  }

  const confidence = dataPoints / totalExpected;
  const passed = confidence >= 0.33; // At least 1 of 3 sources

  return { passed, confidence: Math.round(confidence * 100) / 100, issues, sourceStatus };
}

// ─── Legal Agent Quality Gate ────────────────────────────────────────────

/**
 * Validate legal agent data completeness.
 *
 * @param {object|null} legalData - Raw output from runLegalAgent()
 * @returns {{ passed: boolean, confidence: number, issues: string[], sourceStatus: object }}
 */
export function validateLegalData(legalData) {
  const issues = [];
  const sourceStatus = {
    announcements: "missing",
    shareholding: "missing",
    directors: "missing",
  };
  let dataPoints = 0;
  const totalExpected = 3;

  if (!legalData) {
    return {
      passed: false,
      confidence: 0,
      issues: ["Legal agent returned no data"],
      sourceStatus,
    };
  }

  // Check announcements
  const announcements = legalData.announcements || [];
  if (announcements.length >= 3) {
    sourceStatus.announcements = "complete";
    dataPoints++;
  } else if (announcements.length > 0) {
    sourceStatus.announcements = "partial";
    dataPoints += 0.5;
    issues.push(`Only ${announcements.length} announcements found (expected 3+)`);
  } else {
    issues.push("No BSE announcements retrieved");
  }

  // Check shareholding data
  const sh = legalData.shareholding;
  if (sh?.latest?.promoterHolding !== undefined && sh?.latest?.promoterHolding !== null) {
    sourceStatus.shareholding = "complete";
    dataPoints++;

    // Trend data bonus
    if (!sh.trend || sh.trend.length < 2) {
      sourceStatus.shareholding = "partial";
      dataPoints -= 0.25;
      issues.push("Shareholding trend data unavailable — cannot assess direction");
    }
  } else {
    issues.push("No shareholding pattern data available");
  }

  // Check directors
  const directors = legalData.directors;
  if (directors && (Array.isArray(directors) ? directors.length > 0 : Object.keys(directors).length > 0)) {
    sourceStatus.directors = "complete";
    dataPoints++;
  } else {
    sourceStatus.directors = "missing";
    issues.push("Director information not available");
  }

  const confidence = dataPoints / totalExpected;
  const passed = confidence >= 0.33;

  return { passed, confidence: Math.round(confidence * 100) / 100, issues, sourceStatus };
}

// ─── Sentiment Agent Quality Gate ────────────────────────────────────────

/**
 * Validate sentiment agent data completeness.
 *
 * @param {object|null} sentimentData - Raw output from runSentimentAgent()
 * @param {Array} classifiedArticles - LLM-classified articles
 * @returns {{ passed: boolean, confidence: number, issues: string[], sourceStatus: object }}
 */
export function validateSentimentData(sentimentData, classifiedArticles = []) {
  const issues = [];
  const sourceStatus = {
    googleNews: "missing",
    economicTimes: "missing",
    llmClassification: "missing",
  };
  let dataPoints = 0;
  const totalExpected = 3;

  if (!sentimentData) {
    return {
      passed: false,
      confidence: 0,
      issues: ["Sentiment agent returned no data"],
      sourceStatus,
    };
  }

  const articles = sentimentData.articles || [];

  // Check Google News articles
  const googleArticles = articles.filter((a) => a.source === "Google News" || a.source === "google");
  if (googleArticles.length >= 5) {
    sourceStatus.googleNews = "complete";
    dataPoints++;
  } else if (googleArticles.length > 0) {
    sourceStatus.googleNews = "partial";
    dataPoints += 0.5;
    issues.push(`Only ${googleArticles.length} Google News articles (recommend 5+)`);
  } else {
    // All articles from one source is still usable
    if (articles.length >= 5) {
      sourceStatus.googleNews = "partial";
      dataPoints += 0.5;
    } else {
      issues.push("Insufficient news articles for reliable sentiment");
    }
  }

  // Check ET articles
  const etArticles = articles.filter((a) => a.source === "Economic Times" || a.source === "et");
  if (etArticles.length >= 3) {
    sourceStatus.economicTimes = "complete";
    dataPoints++;
  } else if (etArticles.length > 0 || articles.length >= 8) {
    sourceStatus.economicTimes = "partial";
    dataPoints += 0.5;
  } else {
    issues.push("Economic Times articles unavailable");
  }

  // Check LLM classification
  if (classifiedArticles.length > 0 && classifiedArticles.some((a) => a.sentiment)) {
    const classifiedCount = classifiedArticles.filter(
      (a) => a.sentiment && a.sentiment !== "NEUTRAL"
    ).length;
    if (classifiedCount >= 3) {
      sourceStatus.llmClassification = "complete";
      dataPoints++;
    } else {
      sourceStatus.llmClassification = "partial";
      dataPoints += 0.5;
      issues.push("LLM classified few articles with clear sentiment");
    }
  } else if (articles.length > 0) {
    sourceStatus.llmClassification = "partial";
    dataPoints += 0.25;
    issues.push("LLM classification may have used fallback keyword matching");
  } else {
    issues.push("No articles available for sentiment classification");
  }

  // Date coverage check
  const hasRecentArticle = articles.some((a) => {
    const dateStr = a.date || "";
    return dateStr.includes("hour") || dateStr.includes("minute") || dateStr.includes("1 day");
  });
  if (!hasRecentArticle && articles.length > 0) {
    issues.push("No articles from last 24 hours — sentiment may be stale");
  }

  const confidence = dataPoints / totalExpected;
  const passed = articles.length >= 3; // Need at least 3 articles

  return { passed, confidence: Math.round(confidence * 100) / 100, issues, sourceStatus };
}

// ─── Aggregate Quality Report ────────────────────────────────────────────

/**
 * Compute overall data confidence score from all gate results.
 *
 * @param {object} financialGate - Result from validateFinancialData
 * @param {object} legalGate - Result from validateLegalData
 * @param {object} sentimentGate - Result from validateSentimentData
 * @returns {{
 *   overallConfidence: number,
 *   confidenceLabel: string,
 *   confidenceBand: { low: number, high: number },
 *   sourcesTotal: number,
 *   sourcesPassed: number,
 *   allIssues: string[],
 *   pillarStatus: object
 * }}
 */
export function computeDataConfidence(financialGate, legalGate, sentimentGate) {
  const gates = [
    { name: "Financial", gate: financialGate, weight: 0.45 },
    { name: "Legal", gate: legalGate, weight: 0.30 },
    { name: "Sentiment", gate: sentimentGate, weight: 0.25 },
  ];

  let weightedConfidence = 0;
  let sourcesPassed = 0;
  const allIssues = [];
  const pillarStatus = {};

  for (const { name, gate, weight } of gates) {
    weightedConfidence += gate.confidence * weight;
    if (gate.passed) sourcesPassed++;
    allIssues.push(...gate.issues.map((i) => `[${name}] ${i}`));
    pillarStatus[name.toLowerCase()] = {
      passed: gate.passed,
      confidence: gate.confidence,
      sources: gate.sourceStatus,
    };
  }

  const overallConfidence = Math.round(weightedConfidence * 100);

  // Confidence band: higher confidence = narrower band
  const bandWidth = overallConfidence >= 80 ? 3 : overallConfidence >= 50 ? 5 : 8;

  let confidenceLabel;
  if (overallConfidence >= 80) confidenceLabel = "HIGH";
  else if (overallConfidence >= 50) confidenceLabel = "MEDIUM";
  else confidenceLabel = "LOW";

  return {
    overallConfidence,
    confidenceLabel,
    confidenceBand: bandWidth,
    sourcesTotal: 3,
    sourcesPassed,
    allIssues,
    pillarStatus,
  };
}

export default {
  validateFinancialData,
  validateLegalData,
  validateSentimentData,
  computeDataConfidence,
};
