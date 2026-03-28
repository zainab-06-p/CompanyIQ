/**
 * Waterfall Engine — SHAP-Style Score Explainability
 *
 * Generates detailed waterfalls showing what pushed each score up or down.
 * Derived from ResearchIQ's SHAP explainability — no black boxes.
 *
 * Output: ordered list of contributions (positive and negative) that
 * explain exactly how the final score was constructed from a base.
 */

// ─── Sector Median Baselines ────────────────────────────────────────────

const SECTOR_BASELINES = {
  "Banking & Finance": { financial: 55, legal: 70, sentiment: 50, overall: 58 },
  "Information Technology": { financial: 60, legal: 75, sentiment: 55, overall: 62 },
  "Internet & Technology": { financial: 45, legal: 65, sentiment: 55, overall: 53 },
  FMCG: { financial: 62, legal: 72, sentiment: 58, overall: 63 },
  Telecom: { financial: 50, legal: 65, sentiment: 50, overall: 55 },
  Pharmaceuticals: { financial: 58, legal: 68, sentiment: 52, overall: 58 },
  Automobile: { financial: 55, legal: 70, sentiment: 52, overall: 58 },
  Conglomerate: { financial: 55, legal: 68, sentiment: 52, overall: 57 },
  "Oil & Gas": { financial: 58, legal: 70, sentiment: 50, overall: 58 },
  "Metals & Mining": { financial: 52, legal: 68, sentiment: 48, overall: 55 },
};

const DEFAULT_BASELINE = { financial: 50, legal: 65, sentiment: 50, overall: 55 };

// ─── Financial Score Waterfall ───────────────────────────────────────────

/**
 * Generate waterfall for the financial pillar score.
 *
 * @param {object} allRatios - Computed ratios from ratioEngine
 * @param {object} financialBreakdown - From financialScorer { profitability, liquidity, solvency, growth }
 * @param {number} finalScore - Final financial score
 * @param {string} sector - Company sector
 * @returns {{ baseScore: number, contributions: Array, finalScore: number }}
 */
export function generateFinancialWaterfall(allRatios, financialBreakdown, finalScore, sector) {
  const baseline = (SECTOR_BASELINES[sector] || DEFAULT_BASELINE).financial;
  const contributions = [];

  // Profitability signals
  if (allRatios.netProfitMargin !== null) {
    const impact = allRatios.netProfitMargin > 12 ? "+strong" : allRatios.netProfitMargin > 5 ? "+moderate" : allRatios.netProfitMargin > 0 ? "neutral" : "-weak";
    if (allRatios.netProfitMargin > 12) {
      contributions.push({ factor: "Net Margin", value: `${allRatios.netProfitMargin.toFixed(1)}%`, impact: Math.min(8, Math.round((allRatios.netProfitMargin - 12) * 0.5)), direction: "positive" });
    } else if (allRatios.netProfitMargin < 2) {
      contributions.push({ factor: "Net Margin", value: `${allRatios.netProfitMargin.toFixed(1)}%`, impact: -Math.min(8, Math.round((2 - allRatios.netProfitMargin) * 1.5)), direction: "negative" });
    }
  }

  if (allRatios.returnOnEquity !== null) {
    if (allRatios.returnOnEquity > 18) {
      contributions.push({ factor: "ROE", value: `${allRatios.returnOnEquity.toFixed(1)}%`, impact: Math.min(7, Math.round((allRatios.returnOnEquity - 15) * 0.5)), direction: "positive" });
    } else if (allRatios.returnOnEquity < 8) {
      contributions.push({ factor: "ROE", value: `${allRatios.returnOnEquity.toFixed(1)}%`, impact: -Math.min(5, Math.round((8 - allRatios.returnOnEquity) * 0.5)), direction: "negative" });
    }
  }

  // Growth signals
  if (allRatios.revenueCAGR3yr !== null) {
    if (allRatios.revenueCAGR3yr > 20) {
      contributions.push({ factor: "Revenue CAGR 3yr", value: `${allRatios.revenueCAGR3yr.toFixed(0)}%`, impact: Math.min(9, Math.round(allRatios.revenueCAGR3yr * 0.2)), direction: "positive" });
    } else if (allRatios.revenueCAGR3yr < 0) {
      contributions.push({ factor: "Revenue CAGR 3yr", value: `${allRatios.revenueCAGR3yr.toFixed(0)}%`, impact: Math.max(-8, Math.round(allRatios.revenueCAGR3yr * 0.3)), direction: "negative" });
    }
  }

  // Solvency signals
  if (allRatios.debtToEquity !== null) {
    if (allRatios.debtToEquity < 0.3 && allRatios.debtToEquity >= 0) {
      contributions.push({ factor: "Debt-to-Equity", value: `${allRatios.debtToEquity.toFixed(2)}`, impact: 5, direction: "positive" });
    } else if (allRatios.debtToEquity > 2.0) {
      contributions.push({ factor: "Debt-to-Equity", value: `${allRatios.debtToEquity.toFixed(2)}`, impact: -Math.min(7, Math.round((allRatios.debtToEquity - 1.5) * 3)), direction: "negative" });
    }
  }

  // Liquidity signals
  if (allRatios.currentRatio !== null) {
    if (allRatios.currentRatio > 2.0) {
      contributions.push({ factor: "Current Ratio", value: `${allRatios.currentRatio.toFixed(2)}`, impact: 4, direction: "positive" });
    } else if (allRatios.currentRatio < 1.0) {
      contributions.push({ factor: "Current Ratio", value: `${allRatios.currentRatio.toFixed(2)}`, impact: -5, direction: "negative" });
    }
  }

  // Valuation flags
  if (allRatios.pe !== null && allRatios.pe > 60) {
    contributions.push({ factor: "P/E Ratio", value: `${allRatios.pe.toFixed(0)}x`, impact: -Math.min(6, Math.round((allRatios.pe - 40) * 0.1)), direction: "negative" });
  }

  // Sort by absolute impact descending
  contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return { baseScore: baseline, contributions, finalScore };
}

// ─── Legal Score Waterfall ───────────────────────────────────────────────

/**
 * Generate waterfall for the legal pillar score.
 *
 * @param {object} legalData - Raw legal data
 * @param {Array} legalFlags - Flags from legalScorer
 * @param {number} finalScore - Final legal score
 * @param {string} sector
 * @returns {{ baseScore: number, contributions: Array, finalScore: number }}
 */
export function generateLegalWaterfall(legalData, legalFlags, finalScore, sector) {
  const baseline = 100; // Legal starts at 100 and deducts
  const contributions = [];

  for (const flag of (legalFlags || [])) {
    let impact = 0;
    if (flag.severity === "CRITICAL") impact = -25;
    else if (flag.severity === "HIGH") impact = -15;
    else if (flag.severity === "WATCH") impact = -8;
    else if (flag.severity === "POSITIVE") impact = 5;

    if (impact !== 0) {
      contributions.push({
        factor: flag.message.split("—")[0].trim().substring(0, 60),
        value: flag.message,
        impact,
        direction: impact > 0 ? "positive" : "negative",
      });
    }
  }

  contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return { baseScore: baseline, contributions, finalScore };
}

// ─── Sentiment Score Waterfall ───────────────────────────────────────────

/**
 * Generate waterfall for the sentiment pillar score.
 *
 * @param {object} sentimentResult - From sentimentScorer
 * @param {Array} classifiedArticles
 * @param {string} sector
 * @returns {{ baseScore: number, contributions: Array, finalScore: number }}
 */
export function generateSentimentWaterfall(sentimentResult, classifiedArticles, sector) {
  const baseline = 50; // Neutral baseline
  const contributions = [];

  if (!sentimentResult || sentimentResult.total === 0) {
    return { baseScore: baseline, contributions: [{ factor: "No articles", value: "No data", impact: 0, direction: "neutral" }], finalScore: 50 };
  }

  // Positive ratio impact
  const posRatio = sentimentResult.positive / sentimentResult.total;
  const negRatio = sentimentResult.negative / sentimentResult.total;

  if (posRatio > 0.5) {
    contributions.push({
      factor: "Positive news dominance",
      value: `${Math.round(posRatio * 100)}% positive (${sentimentResult.positive} articles)`,
      impact: Math.min(15, Math.round(posRatio * 20)),
      direction: "positive",
    });
  }

  if (negRatio > 0.3) {
    contributions.push({
      factor: "Negative news pressure",
      value: `${Math.round(negRatio * 100)}% negative (${sentimentResult.negative} articles)`,
      impact: -Math.min(15, Math.round(negRatio * 25)),
      direction: "negative",
    });
  }

  // Theme-based contributions
  for (const theme of (sentimentResult.topThemes || []).slice(0, 3)) {
    const themeArticles = (classifiedArticles || []).filter((a) => a.topic === theme.theme);
    const themePositive = themeArticles.filter((a) => a.sentiment === "POSITIVE").length;
    const themeNegative = themeArticles.filter((a) => a.sentiment === "NEGATIVE").length;

    if (themeNegative > themePositive && themeNegative >= 2) {
      contributions.push({
        factor: `${theme.theme} narrative`,
        value: `${themeNegative} negative articles on this topic`,
        impact: -Math.min(5, themeNegative * 2),
        direction: "negative",
      });
    } else if (themePositive > themeNegative && themePositive >= 2) {
      contributions.push({
        factor: `${theme.theme} narrative`,
        value: `${themePositive} positive articles on this topic`,
        impact: Math.min(5, themePositive * 2),
        direction: "positive",
      });
    }
  }

  // Flags impact
  for (const flag of (sentimentResult.flags || [])) {
    if (flag.severity === "HIGH") {
      contributions.push({ factor: flag.message.substring(0, 50), value: flag.message, impact: -8, direction: "negative" });
    } else if (flag.severity === "POSITIVE") {
      contributions.push({ factor: flag.message.substring(0, 50), value: flag.message, impact: 5, direction: "positive" });
    }
  }

  contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return { baseScore: baseline, contributions, finalScore: sentimentResult.score };
}

// ─── Overall Score Waterfall ─────────────────────────────────────────────

/**
 * Generate the top-level CompanyIQ waterfall showing pillar contributions.
 *
 * @param {object} params
 * @param {number} params.financialScore
 * @param {number} params.legalScore
 * @param {number} params.sentimentScore
 * @param {object} params.weights - { financial, legal, sentiment }
 * @param {number} params.flagAdjustment
 * @param {number} params.finalScore
 * @param {string} params.sector
 * @param {Array} params.redFlags
 * @returns {{ baseScore: number, contributions: Array, finalScore: number, topBoosters: string[], topDrags: string[] }}
 */
export function generateOverallWaterfall({ financialScore, legalScore, sentimentScore, weights, flagAdjustment, finalScore, sector, redFlags }) {
  const baseline = (SECTOR_BASELINES[sector] || DEFAULT_BASELINE).overall;
  const contributions = [];

  // Pillar contributions relative to baseline expectation
  const expectedFinancial = (SECTOR_BASELINES[sector] || DEFAULT_BASELINE).financial;
  const expectedLegal = (SECTOR_BASELINES[sector] || DEFAULT_BASELINE).legal;
  const expectedSentiment = (SECTOR_BASELINES[sector] || DEFAULT_BASELINE).sentiment;

  const financialDelta = Math.round((financialScore - expectedFinancial) * weights.financial);
  const legalDelta = Math.round((legalScore - expectedLegal) * weights.legal);
  const sentimentDelta = Math.round((sentimentScore - expectedSentiment) * weights.sentiment);

  if (financialDelta !== 0) {
    contributions.push({
      factor: `Financial Health (${financialScore}/100)`,
      value: `${financialDelta > 0 ? "Above" : "Below"} sector median (${expectedFinancial})`,
      impact: financialDelta,
      direction: financialDelta > 0 ? "positive" : "negative",
    });
  }

  if (legalDelta !== 0) {
    contributions.push({
      factor: `Legal & Governance (${legalScore}/100)`,
      value: `${legalDelta > 0 ? "Above" : "Below"} sector median (${expectedLegal})`,
      impact: legalDelta,
      direction: legalDelta > 0 ? "positive" : "negative",
    });
  }

  if (sentimentDelta !== 0) {
    contributions.push({
      factor: `Market Sentiment (${sentimentScore}/100)`,
      value: `${sentimentDelta > 0 ? "Above" : "Below"} neutral baseline (${expectedSentiment})`,
      impact: sentimentDelta,
      direction: sentimentDelta > 0 ? "positive" : "negative",
    });
  }

  // Red flag adjustments
  if (flagAdjustment !== 0) {
    const criticalCount = (redFlags || []).filter((f) => f.severity === "CRITICAL").length;
    const positiveCount = (redFlags || []).filter((f) => f.severity === "POSITIVE").length;

    contributions.push({
      factor: "Red Flag Adjustments",
      value: `${criticalCount > 0 ? criticalCount + " critical, " : ""}${(redFlags || []).length} total flags`,
      impact: flagAdjustment,
      direction: flagAdjustment > 0 ? "positive" : "negative",
    });
  }

  contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  // Extract top 3 boosters and drags
  const topBoosters = contributions
    .filter((c) => c.direction === "positive")
    .slice(0, 3)
    .map((c) => c.factor);

  const topDrags = contributions
    .filter((c) => c.direction === "negative")
    .slice(0, 3)
    .map((c) => c.factor);

  return { baseScore: baseline, contributions, finalScore, topBoosters, topDrags };
}

export default {
  generateFinancialWaterfall,
  generateLegalWaterfall,
  generateSentimentWaterfall,
  generateOverallWaterfall,
};
