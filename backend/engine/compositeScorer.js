/**
 * Composite Scorer — CompanyIQ Score
 *
 * Combines all pillar scores into a single 0–100 CompanyIQ Score.
 *
 * UPGRADED: Now uses context-aware weights from contextEngine.js
 * instead of hardcoded weights. Different sectors and company stages
 * get different weight distributions.
 *
 * Then applies red flag adjustments:
 *     CRITICAL → -25, HIGH → -15, WATCH → -8, POSITIVE → +5
 */

import { computeContextWeights } from "./contextEngine.js";

/**
 * Compute the final CompanyIQ composite score.
 *
 * @param {number} financialScore - 0–100 from Financial Scorer
 * @param {{ score: number, flags: Array }} legalResult - From Legal Scorer
 * @param {{ score: number, flags: Array }} sentimentResult - From Sentiment Scorer
 * @param {Array} [additionalRedFlags=[]] - From Red Flag Engine
 * @param {{ sector: string, allRatios: object }} [contextData={}] - For context-aware weights
 * @returns {{ score: number, rating: string, color: string, breakdown: object, weightContext: object }}
 */
export function computeCompanyIQ(financialScore, legalResult, sentimentResult, additionalRedFlags = [], contextData = {}) {
  // UPGRADE: Context-aware weights based on sector + company stage
  const { weights: WEIGHTS, context: weightContext } = computeContextWeights(
    contextData.sector || null,
    contextData.allRatios || {}
  );

  // Resolve actual scores — null means data unavailable
  // NaN defense: typeof NaN === 'number' so use Number.isFinite to exclude it
  const fScore = (typeof financialScore === "number" && Number.isFinite(financialScore)) ? financialScore : null;
  const lScore = (legalResult && typeof legalResult.score === "number" && Number.isFinite(legalResult.score)) ? legalResult.score : null;
  const sScore = (sentimentResult && typeof sentimentResult.score === "number" && Number.isFinite(sentimentResult.score)) ? sentimentResult.score : null;

  // Redistribute weights to available pillars instead of defaulting unavailable pillars to 50
  const pillars = [
    { key: "financial", score: fScore, weight: WEIGHTS.financial },
    { key: "legal", score: lScore, weight: WEIGHTS.legal },
    { key: "sentiment", score: sScore, weight: WEIGHTS.sentiment },
  ];
  const available = pillars.filter(p => p.score !== null);
  const unavailable = pillars.filter(p => p.score === null);

  let baseScore;
  if (available.length === 0) {
    // No data at all — neutral score
    baseScore = 50;
  } else {
    // Redistribute unavailable weight proportionally to available pillars
    const totalAvailableWeight = available.reduce((s, p) => s + p.weight, 0);
    baseScore = Math.round(
      available.reduce((s, p) => s + p.score * (p.weight / totalAvailableWeight), 0)
    );
  }

  // Confidence penalty: fewer pillars → less reliable score
  const confidencePenalty = unavailable.length > 0 ? unavailable.length * 3 : 0;
  baseScore = Math.max(0, baseScore - confidencePenalty);

  // Collect all flags from all sources
  const allFlags = [
    ...(legalResult?.flags || []),
    ...(sentimentResult?.flags || []),
    ...(additionalRedFlags || []),
  ];

  // Apply red flag adjustments with diminishing returns
  const FLAG_ADJUSTMENTS = {
    CRITICAL: -25,
    HIGH: -15,
    WATCH: -5,   // Reduced from -8; WATCH flags are informational, not severe
    POSITIVE: 5,
    INFO: 0,
  };

  let totalAdjustment = 0;
  // Track counts per severity for diminishing returns
  const severityCounts = {};
  for (const flag of allFlags) {
    const sev = flag.severity;
    severityCounts[sev] = (severityCounts[sev] || 0) + 1;
    const baseAdj = FLAG_ADJUSTMENTS[sev] || 0;
    // Diminishing returns: 2nd flag of same type = 70%, 3rd = 50%, 4th+ = 30%
    const nth = severityCounts[sev];
    const multiplier = nth === 1 ? 1.0 : nth === 2 ? 0.7 : nth === 3 ? 0.5 : 0.3;
    totalAdjustment += Math.round(baseAdj * multiplier);
  }

  // Cap total adjustment to prevent runaway deductions
  totalAdjustment = Math.max(-40, Math.min(20, totalAdjustment));

  const finalScore = Math.max(0, Math.min(100, baseScore + totalAdjustment));

  // Determine rating and color
  let rating, color;
  if (finalScore >= 80) {
    rating = "STRONG";
    color = "green";
  } else if (finalScore >= 60) {
    rating = "MODERATE";
    color = "yellow";
  } else if (finalScore >= 40) {
    rating = "CAUTION";
    color = "orange";
  } else {
    rating = "HIGH RISK";
    color = "red";
  }

  return {
    score: finalScore,
    rating,
    color,
    weights: WEIGHTS,
    breakdown: {
      financialScore: fScore,
      legalScore: lScore,
      sentimentScore: sScore,
      baseWeightedScore: baseScore,
      flagAdjustment: totalAdjustment,
      confidencePenalty,
      availablePillars: available.length,
      flagCount: {
        critical: allFlags.filter((f) => f.severity === "CRITICAL").length,
        high: allFlags.filter((f) => f.severity === "HIGH").length,
        watch: allFlags.filter((f) => f.severity === "WATCH").length,
        positive: allFlags.filter((f) => f.severity === "POSITIVE").length,
      },
    },
    weightContext,
  };
}

export function calculatePillarScore(ratios, maxWeights) {
  let finalScore = 0;
  let totalAvailableWeight = 0;
  let fetchedCount = 0;
  const totalCount = Object.keys(ratios).length;

  for (const [key, ratioObj] of Object.entries(ratios)) {
    if (ratioObj && ratioObj.status === 'FETCHED') {
      finalScore += (ratioObj.score * maxWeights[key]);
      totalAvailableWeight += maxWeights[key];
      fetchedCount++;
    }
  }

  const completeness = totalCount === 0 ? 0 : (fetchedCount / totalCount) * 100;
  let confidence = completeness >= 80 ? 'HIGH' : completeness >= 50 ? 'MEDIUM' : 'LOW';

  if (totalAvailableWeight === 0 || completeness < 30) {
    return { score: null, confidence: 'INSUFFICIENT_DATA', completeness };
  }

  const normalizedScore = (finalScore / totalAvailableWeight) * 100;
  return { score: normalizedScore, confidence, completeness };
}

export default { computeCompanyIQ, calculatePillarScore };
