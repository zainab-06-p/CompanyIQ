/**
 * Financial Scorer
 *
 * Converts computed financial ratios into a 0–100 score.
 * Each ratio is scored against benchmarks, then category scores
 * are combined with weights.
 *
 * Weights: Profitability 30% | Liquidity 25% | Solvency 25% | Growth 20%
 */

// ─── Benchmarks ─────────────────────────────────────────────────────────

const BENCHMARKS = {
  // Profitability
  netProfitMargin:       { poor: 0,   avg: 5,    good: 12,  excellent: 20 },
  operatingProfitMargin: { poor: 0,   avg: 8,    good: 15,  excellent: 25 },
  ebitdaMargin:          { poor: 5,   avg: 15,   good: 25,  excellent: 35 },
  returnOnEquity:        { poor: 0,   avg: 8,    good: 15,  excellent: 22 },
  returnOnAssets:        { poor: 0,   avg: 3,    good: 8,   excellent: 15 },

  // Liquidity
  currentRatio:          { poor: 0.8, avg: 1.2,  good: 2.0, excellent: 3.0 },
  quickRatio:            { poor: 0.5, avg: 0.8,  good: 1.2, excellent: 2.0 },
  operatingCFRatio:      { poor: 0.1, avg: 0.3,  good: 0.5, excellent: 0.8 },

  // Solvency (inverse — lower is better)
  debtToEquity:          { excellent: 0,   good: 0.5, avg: 1.0, poor: 2.0, danger: 3.5 },
  debtToAssets:          { excellent: 0.1, good: 0.3, avg: 0.5, poor: 0.7, danger: 0.9 },
  interestCoverage:      { poor: 1.5, avg: 3,    good: 5,   excellent: 10 },

  // Growth
  revenueCAGR3yr:        { poor: 0,   avg: 8,    good: 15,  excellent: 25 },
  yoyRevenueGrowth:      { poor: 0,   avg: 10,   good: 20,  excellent: 35 },
  patCAGR3yr:            { poor: 0,   avg: 10,   good: 20,  excellent: 35 },
};

// ─── Category Weights ───────────────────────────────────────────────────

const CATEGORY_WEIGHTS = {
  profitability: 0.30,
  liquidity:     0.25,
  solvency:      0.25,
  growth:        0.20,
};

// ─── Main Scorer ────────────────────────────────────────────────────────

/**
 * Compute a 0–100 financial score from all ratios.
 *
 * @param {object} allRatios - Output from computeAllRatios()
 * @returns {number} - Score 0–100
 */
export function computeFinancialScore(allRatios) {
  // ── Diagnostic: log input ratios ──────────────────────────────────
  const ratioKeys = ['netProfitMargin','operatingProfitMargin','ebitdaMargin','returnOnEquity','returnOnAssets',
    'currentRatio','quickRatio','operatingCFRatio','debtToEquity','debtToAssets','interestCoverage',
    'revenueCAGR3yr','yoyRevenueGrowth','patCAGR3yr'];
  const present = ratioKeys.filter(k => allRatios[k] != null && Number.isFinite(allRatios[k]));
  const missing = ratioKeys.filter(k => allRatios[k] == null || !Number.isFinite(allRatios[k]));
  console.log(`[FinancialScorer] Ratios present (${present.length}/${ratioKeys.length}):`, present.map(k => `${k}=${allRatios[k]}`).join(', '));
  if (missing.length > 0) console.log(`[FinancialScorer] Ratios MISSING:`, missing.join(', '));

  // Profitability sub-score
  const profitabilityScore = average([
    scoreRatio(allRatios.netProfitMargin,       BENCHMARKS.netProfitMargin),
    scoreRatio(allRatios.operatingProfitMargin,  BENCHMARKS.operatingProfitMargin),
    scoreRatio(allRatios.ebitdaMargin,           BENCHMARKS.ebitdaMargin),
    scoreRatio(allRatios.returnOnEquity,         BENCHMARKS.returnOnEquity),
    scoreRatio(allRatios.returnOnAssets,          BENCHMARKS.returnOnAssets),
  ]);

  // Liquidity sub-score
  const liquidityScore = average([
    scoreRatio(allRatios.currentRatio,    BENCHMARKS.currentRatio),
    scoreRatio(allRatios.quickRatio,      BENCHMARKS.quickRatio),
    scoreRatio(allRatios.operatingCFRatio, BENCHMARKS.operatingCFRatio),
  ]);

  // Solvency sub-score (uses inverse scoring for debt ratios)
  const solvencyScore = average([
    scoreRatioInverse(allRatios.debtToEquity, BENCHMARKS.debtToEquity),
    scoreRatioInverse(allRatios.debtToAssets, BENCHMARKS.debtToAssets),
    scoreRatio(allRatios.interestCoverage,    BENCHMARKS.interestCoverage),
  ]);

  // Growth sub-score
  const growthScore = average([
    scoreRatio(allRatios.revenueCAGR3yr,    BENCHMARKS.revenueCAGR3yr),
    scoreRatio(allRatios.yoyRevenueGrowth,  BENCHMARKS.yoyRevenueGrowth),
    scoreRatio(allRatios.patCAGR3yr,        BENCHMARKS.patCAGR3yr),
  ]);

  // Weighted composite — also use Number.isFinite for NaN safety
  const categories = [
    { name: 'profitability', score: profitabilityScore, weight: CATEGORY_WEIGHTS.profitability },
    { name: 'liquidity', score: liquidityScore, weight: CATEGORY_WEIGHTS.liquidity },
    { name: 'solvency', score: solvencyScore, weight: CATEGORY_WEIGHTS.solvency },
    { name: 'growth', score: growthScore, weight: CATEGORY_WEIGHTS.growth }
  ];

  const availableCategories = categories.filter(c => typeof c.score === 'number' && Number.isFinite(c.score));
  const totalAvailableWeight = availableCategories.reduce((sum, c) => sum + c.weight, 0);

  console.log(`[FinancialScorer] Sub-scores: ${categories.map(c => `${c.name}=${c.score}`).join(', ')}`);
  console.log(`[FinancialScorer] Available categories: ${availableCategories.length}/4, weight=${totalAvailableWeight.toFixed(2)}`);

  let finalScore = null;
  if (totalAvailableWeight >= 0.6) {
    const rawScore = availableCategories.reduce((sum, c) => sum + c.score * (c.weight / totalAvailableWeight), 0);
    finalScore = clamp(Math.round(rawScore), 0, 100);
  } else if (availableCategories.length > 0) {
    // Fallback: if we have at least one category with data, compute unweighted average
    // This prevents null scores when data is partially missing
    const rawScore = availableCategories.reduce((sum, c) => sum + c.score, 0) / availableCategories.length;
    finalScore = clamp(Math.round(rawScore), 0, 100);
  }

  console.log(`[FinancialScorer] FINAL SCORE: ${finalScore ?? 50}`);

  return {
    score: finalScore ?? 50, // Never return null - default to neutral 50 if absolutely no data
    breakdown: {
      profitability: profitabilityScore !== null ? Math.round(profitabilityScore) : null,
      liquidity: liquidityScore !== null ? Math.round(liquidityScore) : null,
      solvency: solvencyScore !== null ? Math.round(solvencyScore) : null,
      growth: growthScore !== null ? Math.round(growthScore) : null,
    },
  };
}

// ─── Scoring Functions ──────────────────────────────────────────────────

/**
 * Score a ratio 0–100 (higher = better).
 * Linearly interpolates between benchmark thresholds.
 */
function scoreRatio(value, benchmark) {
  // Return null (exclude) for missing data — NOT 50 ("neutral").
  // NaN also excluded: typeof NaN === 'number' so previous null-only checks let it through.
  if (value == null || !Number.isFinite(value)) return null;

  if (value >= benchmark.excellent) return 95;
  if (value >= benchmark.good) {
    return 75 + ((value - benchmark.good) / (benchmark.excellent - benchmark.good)) * 20;
  }
  if (value >= benchmark.avg) {
    return 50 + ((value - benchmark.avg) / (benchmark.good - benchmark.avg)) * 25;
  }
  if (value >= benchmark.poor) {
    return 25 + ((value - benchmark.poor) / (benchmark.avg - benchmark.poor)) * 25;
  }
  // Below poor
  return Math.max(5, 25 * (value / Math.max(benchmark.poor, 0.01)));
}

/**
 * Score an inverse ratio 0–100 (lower = better), e.g. Debt-to-Equity.
 */
function scoreRatioInverse(value, benchmark) {
  if (value == null || !Number.isFinite(value)) return null; // Exclude missing/NaN from average

  if (value <= benchmark.excellent) return 95;
  if (value <= benchmark.good) {
    return 75 + ((benchmark.good - value) / (benchmark.good - benchmark.excellent)) * 20;
  }
  if (value <= benchmark.avg) {
    return 50 + ((benchmark.avg - value) / (benchmark.avg - benchmark.good)) * 25;
  }
  if (value <= benchmark.poor) {
    return 25 + ((benchmark.poor - value) / (benchmark.poor - benchmark.avg)) * 25;
  }
  if (value <= (benchmark.danger || benchmark.poor * 2)) {
    return 10;
  }
  return 5;
}

// ─── Utilities ──────────────────────────────────────────────────────────

function average(scores) {
  // NaN defense: filter out NaN as well as null/undefined
  const valid = scores.filter((s) => typeof s === 'number' && Number.isFinite(s));
  const missingPercent = scores.length > 0 ? (scores.length - valid.length) / scores.length : 0;
  // Allow up to 60% missing data (was 40%) to be more lenient with incomplete fetches
  if (missingPercent > 0.6) return null;
  if (valid.length === 0) return null;
  return valid.reduce((sum, s) => sum + s, 0) / valid.length;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export default { computeFinancialScore };
