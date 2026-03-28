/**
 * Multi-Horizon Analysis Engine — Upgrade 19
 *
 * Provides three investment horizon perspectives using
 * different weight profiles for the same underlying data:
 * - Short-term (1-6 months): Sentiment-heavy
 * - Medium-term (6-24 months): Financial-heavy
 * - Long-term (2-5 years): Governance-heavy
 *
 * Also detects divergence patterns (buy-on-weakness, sell-on-strength).
 */

// ─── Horizon Weight Profiles ────────────────────────────────────────

const HORIZON_WEIGHTS = {
  shortTerm: {
    label: "Short-Term (1-6 months)",
    weights: { financial: 0.20, legal: 0.10, sentiment: 0.40, deepAnalysis: 0.30 },
    focus: "News momentum, FII flows, analyst sentiment, upcoming events",
    keyQuestion: "Will this stock move up or down in the near term?",
  },
  mediumTerm: {
    label: "Medium-Term (6-24 months)",
    weights: { financial: 0.40, legal: 0.20, sentiment: 0.15, deepAnalysis: 0.25 },
    focus: "Earnings trajectory, margin trends, competitive position, management execution",
    keyQuestion: "Is this company executing on its growth plan?",
  },
  longTerm: {
    label: "Long-Term (2-5 years)",
    weights: { financial: 0.25, legal: 0.35, sentiment: 0.10, deepAnalysis: 0.30 },
    focus: "Governance quality, capital allocation, moat durability, structural trends",
    keyQuestion: "Will this company still be valuable in 5 years?",
  },
};

/**
 * Compute multi-horizon scores from pillar scores and deep analysis.
 *
 * @param {number|null} financialScore - Financial pillar score (0-100)
 * @param {number|null} legalScore - Legal/governance pillar score (0-100)
 * @param {number|null} sentimentScore - Sentiment pillar score (0-100)
 * @param {number|null} deepAnalysisScore - Deep analysis average score (0-100)
 * @param {object} deepAnalysis - Full deep analysis module results
 * @param {Array} redFlags - Red flag list
 * @returns {object} Multi-horizon analysis result
 */
export function computeMultiHorizon(financialScore, legalScore, sentimentScore, deepAnalysisScore, deepAnalysis = {}, redFlags = []) {
  const horizons = {};

  for (const [key, config] of Object.entries(HORIZON_WEIGHTS)) {
    const { weights } = config;

    // Use available scores, redistribute weight for missing pillars
    const pillars = [
      { key: "financial", score: financialScore, weight: weights.financial },
      { key: "legal", score: legalScore, weight: weights.legal },
      { key: "sentiment", score: sentimentScore, weight: weights.sentiment },
      { key: "deepAnalysis", score: deepAnalysisScore, weight: weights.deepAnalysis },
    ];

    const available = pillars.filter(p => typeof p.score === "number" && Number.isFinite(p.score));
    const totalWeight = available.reduce((s, p) => s + p.weight, 0);

    let score;
    if (available.length === 0) {
      score = 50;
    } else {
      score = Math.round(
        available.reduce((s, p) => s + p.score * (p.weight / totalWeight), 0)
      );
    }

    // Apply red flag penalty proportional to horizon sensitivity
    const criticalFlags = redFlags.filter(f => f.severity === "CRITICAL").length;
    const highFlags = redFlags.filter(f => f.severity === "HIGH").length;

    // Short-term is more sensitive to red flags
    const flagSensitivity = key === "shortTerm" ? 1.5 : key === "mediumTerm" ? 1.0 : 0.7;
    const flagPenalty = Math.min(30, Math.round((criticalFlags * 12 + highFlags * 5) * flagSensitivity));
    score = Math.max(0, Math.min(100, score - flagPenalty));

    // Horizon-specific adjustments using deep analysis modules
    if (key === "shortTerm") {
      // Short-term benefits from positive insider activity
      const insiderScore = deepAnalysis.insiderTracking?.score;
      if (typeof insiderScore === "number" && insiderScore > 70) {
        score = Math.min(100, score + 3);
      }
    } else if (key === "mediumTerm") {
      // Medium-term benefits from strong capital allocation
      const capAllocScore = deepAnalysis.capitalAllocation?.score;
      if (typeof capAllocScore === "number" && capAllocScore > 70) {
        score = Math.min(100, score + 3);
      }
    } else if (key === "longTerm") {
      // Long-term benefits from strong moat + ESG
      const moatScore = deepAnalysis.moatAnalysis?.score;
      const esgScore = deepAnalysis.esgAnalysis?.score;
      if (typeof moatScore === "number" && moatScore > 70) {
        score = Math.min(100, score + 2);
      }
      if (typeof esgScore === "number" && esgScore > 70) {
        score = Math.min(100, score + 2);
      }
    }

    const { rating, color } = getRating(score);

    horizons[key] = {
      ...config,
      score,
      rating,
      color,
      flagPenalty,
    };
  }

  // Detect divergence patterns
  const divergence = detectDivergence(horizons);

  return {
    horizons,
    divergence,
  };
}

/**
 * Detect divergence patterns between horizons.
 */
function detectDivergence(horizons) {
  const st = horizons.shortTerm?.score ?? 50;
  const lt = horizons.longTerm?.score ?? 50;
  const diff = lt - st;

  if (diff >= 8) {
    return {
      pattern: "BUY_ON_WEAKNESS",
      message: `Short-term score (${st}) is ${diff} points below long-term score (${lt}). This suggests temporary headwinds on a fundamentally strong company — potential buy-on-weakness opportunity.`,
      severity: "POSITIVE",
    };
  } else if (diff <= -8) {
    return {
      pattern: "SELL_ON_STRENGTH",
      message: `Short-term score (${st}) is ${Math.abs(diff)} points above long-term score (${lt}). Near-term momentum may not sustain — fundamentals lag market sentiment.`,
      severity: "WATCH",
    };
  } else {
    return {
      pattern: "ALIGNED",
      message: `Horizons are well-aligned (spread: ${Math.abs(diff)} points). Consistent risk profile across timeframes.`,
      severity: "INFO",
    };
  }
}

/**
 * Convert score to rating and color.
 */
function getRating(score) {
  if (score >= 80) return { rating: "STRONG", color: "green" };
  if (score >= 60) return { rating: "MODERATE", color: "yellow" };
  if (score >= 40) return { rating: "CAUTION", color: "orange" };
  return { rating: "HIGH RISK", color: "red" };
}

export default { computeMultiHorizon };
