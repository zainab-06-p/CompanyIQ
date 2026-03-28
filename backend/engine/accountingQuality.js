/**
 * Module 1 — Accounting Quality & Forensic Signals
 *
 * Detects whether reported financials are genuine or manipulated.
 * Computes:
 *   - Cash Flow vs Profit Divergence (CFO/NP ratio, FCF, FCF yield)
 *   - Beneish M-Score (8-variable manipulation detector)
 *   - Piotroski F-Score (9 binary strength tests)
 *   - Revenue Quality Signals (DSO, receivables vs revenue, inventory)
 *
 * Input: financialData (from agent), allRatios (from ratioEngine)
 * Output: { fScore, mScore, cfQuality, revenueQuality, overall }
 */

// ─── Piotroski F-Score (9 binary tests) ─────────────────────────────────

export function computePiotroskiFScore(financialData, allRatios) {
  const pl = financialData?.profitAndLoss || {};
  const bs = financialData?.balanceSheet || [];
  const cf = financialData?.cashFlow || [];
  const ratios = financialData?.ratiosSummary || {};

  const annual = pl.annual || [];
  const latestYear = annual[0] || {};
  const prevYear = annual[1] || {};

  const latestBS = bs[0] || {};
  const prevBS = bs[1] || {};
  const latestCF = cf[0] || {};

  const equity = safe(latestBS.shareCapital) + safe(latestBS.reserves);
  const prevEquity = safe(prevBS.shareCapital) + safe(prevBS.reserves);
  const totalAssets = safe(latestBS.totalAssets) || 1;
  const prevTotalAssets = safe(prevBS.totalAssets) || 1;

  const tests = [];

  // PROFITABILITY (4 tests)
  // F1: ROA > 0
  const roa = safe(latestYear.netProfit) / totalAssets;
  const prevRoa = safe(prevYear.netProfit) / prevTotalAssets;
  tests.push({ id: "F1", name: "ROA positive", passed: roa > 0, value: round4(roa) });

  // F2: Operating Cash Flow > 0
  const ocf = safe(latestCF.operatingCF);
  tests.push({ id: "F2", name: "Operating CF positive", passed: ocf > 0, value: ocf });

  // F3: ROA increasing YoY
  tests.push({ id: "F3", name: "ROA improving", passed: roa > prevRoa, value: round4(roa - prevRoa) });

  // F4: Accruals < 0 (Cash Flow > Net Income = quality earnings)
  const accruals = safe(latestYear.netProfit) - ocf;
  tests.push({ id: "F4", name: "Quality earnings (CF > NI)", passed: accruals < 0, value: round4(accruals / totalAssets) });

  // LEVERAGE / LIQUIDITY (3 tests)
  // F5: Long-term debt ratio falling
  const debtRatio = safe(latestBS.borrowings) / totalAssets;
  const prevDebtRatio = safe(prevBS.borrowings) / prevTotalAssets;
  tests.push({ id: "F5", name: "Leverage decreasing", passed: debtRatio <= prevDebtRatio, value: round4(debtRatio - prevDebtRatio) });

  // F6: Current ratio improving
  const cr = allRatios?.currentRatio || safe(ratios.currentRatio);
  const prevCR = prevBS.otherAssets && prevBS.otherLiabilities
    ? safe(prevBS.otherAssets) / Math.max(safe(prevBS.otherLiabilities), 1)
    : cr;
  tests.push({ id: "F6", name: "Current ratio improving", passed: cr >= prevCR, value: round4(cr) });

  // F7: No new equity dilution
  const sharesChange = safe(latestBS.shareCapital) - safe(prevBS.shareCapital);
  tests.push({ id: "F7", name: "No dilution", passed: sharesChange <= 0, value: sharesChange });

  // EFFICIENCY (2 tests)
  // F8: Gross margin improving
  const gm = safe(latestYear.revenue) > 0
    ? (safe(latestYear.revenue) - safe(latestYear.expenses)) / safe(latestYear.revenue)
    : 0;
  const prevGm = safe(prevYear.revenue) > 0
    ? (safe(prevYear.revenue) - safe(prevYear.expenses)) / safe(prevYear.revenue)
    : 0;
  tests.push({ id: "F8", name: "Gross margin improving", passed: gm >= prevGm, value: round4(gm - prevGm) });

  // F9: Asset turnover improving
  const at = safe(latestYear.revenue) / totalAssets;
  const prevAt = safe(prevYear.revenue) / prevTotalAssets;
  tests.push({ id: "F9", name: "Asset turnover improving", passed: at >= prevAt, value: round4(at - prevAt) });

  const score = tests.filter((t) => t.passed).length;
  let rating, color;
  if (score >= 8) { rating = "STRONG"; color = "green"; }
  else if (score >= 5) { rating = "MODERATE"; color = "yellow"; }
  else { rating = "WEAK"; color = "red"; }

  return { score, maxScore: 9, rating, color, tests };
}

// ─── Beneish M-Score (8-variable manipulation detector) ─────────────────

export function computeBeneishMScore(financialData) {
  const pl = financialData?.profitAndLoss || {};
  const bs = financialData?.balanceSheet || [];
  const cf = financialData?.cashFlow || [];

  const annual = pl.annual || [];
  if (annual.length < 2 || bs.length < 2) {
    return { score: null, rating: "INSUFFICIENT_DATA", components: {}, message: "Need 2+ years of data" };
  }

  const curr = annual[0];
  const prev = annual[1];
  const currBS = bs[0] || {};
  const prevBS = bs[1] || {};
  const currCF = cf[0] || {};

  const salesT = safe(curr.revenue) || 1;
  const salesT1 = safe(prev.revenue) || 1;
  const npT = safe(curr.netProfit);
  const ocfT = safe(currCF.operatingCF);
  const totalAssetsT = safe(currBS.totalAssets) || 1;
  const totalAssetsT1 = safe(prevBS.totalAssets) || 1;

  // Approximate receivables from other assets (Screener doesn't break them out)
  const receivablesT = safe(currBS.otherAssets) * 0.4;
  const receivablesT1 = safe(prevBS.otherAssets) * 0.4;
  const currentAssetsT = safe(currBS.otherAssets);
  const currentAssetsT1 = safe(prevBS.otherAssets);
  const ppeT = safe(currBS.fixedAssets);
  const ppeT1 = safe(prevBS.fixedAssets);
  const depT = ppeT * 0.08; // Approximate 8% depreciation rate
  const depT1 = ppeT1 * 0.08;
  const debtT = safe(currBS.borrowings) + safe(currBS.otherLiabilities);
  const debtT1 = safe(prevBS.borrowings) + safe(prevBS.otherLiabilities);
  const expensesT = safe(curr.expenses);
  const expensesT1 = safe(prev.expenses);

  // Estimate SGA as portion of expenses beyond COGS
  const cogT = salesT * 0.6; // Approximate COGS
  const sgaT = Math.max(expensesT - cogT - safe(curr.operatingProfit), 0);
  const cogT1 = salesT1 * 0.6;
  const sgaT1 = Math.max(expensesT1 - cogT1 - safe(prev.operatingProfit), 0);

  const gmT = (salesT - cogT) / salesT;
  const gmT1 = (salesT1 - cogT1) / salesT1;

  // 8 Components
  const DSRI = (receivablesT / salesT) / Math.max(receivablesT1 / salesT1, 0.001);
  const GMI = Math.max(gmT1, 0.001) / Math.max(gmT, 0.001);
  const AQI = (1 - (currentAssetsT + ppeT) / totalAssetsT) / Math.max(1 - (currentAssetsT1 + ppeT1) / totalAssetsT1, 0.001);
  const SGI = salesT / salesT1;
  const DEPI = ((depT1 / Math.max(depT1 + ppeT1, 1))) / Math.max(depT / Math.max(depT + ppeT, 1), 0.001);
  const SGAI = (sgaT / salesT) / Math.max(sgaT1 / salesT1, 0.001);
  const LVGI = (debtT / totalAssetsT) / Math.max(debtT1 / totalAssetsT1, 0.001);
  const TATA = (npT - ocfT) / totalAssetsT;

  const M = -4.84 + (0.920 * DSRI) + (0.528 * GMI) + (0.404 * AQI)
    + (0.892 * SGI) + (0.115 * DEPI) - (0.172 * SGAI)
    + (4.679 * TATA) - (0.327 * LVGI);

  let rating, color;
  if (M < -2.22) { rating = "UNLIKELY_MANIPULATOR"; color = "green"; }
  else if (M < -1.78) { rating = "POSSIBLE_MANIPULATOR"; color = "orange"; }
  else { rating = "PROBABLE_MANIPULATOR"; color = "red"; }

  return {
    score: round4(M),
    threshold: -2.22,
    rating,
    color,
    components: {
      DSRI: round4(DSRI), GMI: round4(GMI), AQI: round4(AQI), SGI: round4(SGI),
      DEPI: round4(DEPI), SGAI: round4(SGAI), LVGI: round4(LVGI), TATA: round4(TATA),
    },
  };
}

// ─── Cash Flow Quality Analysis ─────────────────────────────────────────

export function computeCashFlowQuality(financialData, allRatios) {
  const pl = financialData?.profitAndLoss || {};
  const cf = financialData?.cashFlow || [];
  const ratios = financialData?.ratiosSummary || {};

  const latestAnnual = pl.annual?.[0] || {};
  const latestCF = cf[0] || {};
  const netProfit = safe(latestAnnual.netProfit);
  const ocf = safe(latestCF.operatingCF);
  const investingCF = safe(latestCF.investingCF);
  const marketCap = safe(ratios.marketCap) || safe(allRatios?.marketCap);

  // CFO to Net Profit Ratio
  const cfoToNP = netProfit !== 0 ? ocf / netProfit : null;
  let cfoRating;
  if (cfoToNP === null) cfoRating = "NO_DATA";
  else if (cfoToNP > 1.0) cfoRating = "EXCELLENT";
  else if (cfoToNP >= 0.8) cfoRating = "NORMAL";
  else if (cfoToNP >= 0.5) cfoRating = "WATCH";
  else if (cfoToNP >= 0) cfoRating = "RED_FLAG";
  else cfoRating = "CRITICAL";

  // Free Cash Flow
  const capex = Math.abs(investingCF); // Investing CF is typically negative
  const fcf = ocf - capex;

  // FCF Yield
  const fcfYield = marketCap > 0 ? (fcf / marketCap) * 100 : null;
  let fcfYieldRating;
  if (fcfYield === null) fcfYieldRating = "NO_DATA";
  else if (fcfYield > 5) fcfYieldRating = "VALUE";
  else if (fcfYield >= 2) fcfYieldRating = "NORMAL";
  else fcfYieldRating = "CONSUMING_CASH";

  // FCF Conversion Rate
  const fcfConversion = netProfit > 0 ? (fcf / netProfit) * 100 : null;
  let fcfConversionRating;
  if (fcfConversion === null) fcfConversionRating = "NO_DATA";
  else if (fcfConversion > 80) fcfConversionRating = "HIGH_QUALITY";
  else if (fcfConversion >= 50) fcfConversionRating = "MODERATE";
  else fcfConversionRating = "LOW_QUALITY";

  return {
    cfoToNetProfit: { ratio: round4(cfoToNP), rating: cfoRating },
    fcf: { value: round2(fcf), yield: round4(fcfYield), yieldRating: fcfYieldRating },
    fcfConversion: { rate: round4(fcfConversion), rating: fcfConversionRating },
    capex: round2(capex),
    operatingCF: round2(ocf),
  };
}

// ─── Revenue Quality Signals ────────────────────────────────────────────

export function computeRevenueQuality(financialData) {
  const pl = financialData?.profitAndLoss || {};
  const bs = financialData?.balanceSheet || [];

  const annual = pl.annual || [];
  if (annual.length < 2 || bs.length < 2) {
    return { dsoTrend: null, receivablesGrowthRatio: null, rating: "INSUFFICIENT_DATA" };
  }

  const curr = annual[0];
  const prev = annual[1];
  const currBS = bs[0] || {};
  const prevBS = bs[1] || {};

  const revGrowth = safe(prev.revenue) > 0 ? (safe(curr.revenue) - safe(prev.revenue)) / safe(prev.revenue) : 0;

  // Approximate receivables from otherAssets (40%)
  const recCurr = safe(currBS.otherAssets) * 0.4;
  const recPrev = safe(prevBS.otherAssets) * 0.4;
  const recGrowth = recPrev > 0 ? (recCurr - recPrev) / recPrev : 0;

  // Receivables Growth vs Revenue Growth
  const recGrowthRatio = revGrowth !== 0 ? recGrowth / revGrowth : null;
  let recRating;
  if (recGrowthRatio === null) recRating = "NO_DATA";
  else if (recGrowthRatio < 1.0) recRating = "HIGH_QUALITY";
  else if (recGrowthRatio < 1.5) recRating = "NORMAL";
  else if (recGrowthRatio < 2.0) recRating = "WATCH";
  else recRating = "RED_FLAG";

  // DSO (Days Sales Outstanding)
  const dso = safe(curr.revenue) > 0 ? (recCurr / safe(curr.revenue)) * 365 : null;
  const prevDso = safe(prev.revenue) > 0 ? (recPrev / safe(prev.revenue)) * 365 : null;

  let dsoTrend;
  if (dso === null || prevDso === null) dsoTrend = "NO_DATA";
  else if (dso <= prevDso) dsoTrend = "STABLE_OR_IMPROVING";
  else if (dso - prevDso < 10) dsoTrend = "SLIGHTLY_RISING";
  else dsoTrend = "RED_FLAG";

  return {
    receivablesGrowthRatio: { ratio: round4(recGrowthRatio), rating: recRating },
    dso: { current: round2(dso), previous: round2(prevDso), trend: dsoTrend },
  };
}

// ─── Composite Accounting Quality Score ─────────────────────────────────

export function computeAccountingQuality(financialData, allRatios) {
  const fScore = computePiotroskiFScore(financialData, allRatios);
  const mScore = computeBeneishMScore(financialData);
  const cfQuality = computeCashFlowQuality(financialData, allRatios);
  const revenueQuality = computeRevenueQuality(financialData);

  // Composite score 0-100
  let score = 50; // Start at neutral

  // F-Score contribution (0-9 → 0-35 points)
  score += ((fScore.score / 9) * 35) - 17.5;

  // M-Score contribution (±15 points)
  if (mScore.rating === "UNLIKELY_MANIPULATOR") score += 15;
  else if (mScore.rating === "POSSIBLE_MANIPULATOR") score -= 5;
  else if (mScore.rating === "PROBABLE_MANIPULATOR") score -= 15;

  // CFO quality contribution (±10 points)
  if (cfQuality.cfoToNetProfit.rating === "EXCELLENT") score += 10;
  else if (cfQuality.cfoToNetProfit.rating === "NORMAL") score += 5;
  else if (cfQuality.cfoToNetProfit.rating === "RED_FLAG") score -= 8;
  else if (cfQuality.cfoToNetProfit.rating === "CRITICAL") score -= 10;

  // Revenue quality contribution (±5 points)
  if (revenueQuality.receivablesGrowthRatio?.rating === "HIGH_QUALITY") score += 5;
  else if (revenueQuality.receivablesGrowthRatio?.rating === "RED_FLAG") score -= 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let rating;
  if (score >= 75) rating = "CLEAN";
  else if (score >= 55) rating = "ACCEPTABLE";
  else if (score >= 35) rating = "WATCH";
  else rating = "RED_FLAG";

  // Generate narrative commentary
  const commentary = generateAccountingCommentary(score, rating, fScore, mScore, cfQuality);

  return {
    score,
    rating,
    commentary,
    fScore,
    mScore,
    cfQuality,
    revenueQuality,
  };
}

function generateAccountingCommentary(score, rating, fScore, mScore, cfQuality) {
  const parts = [];

  // F-Score interpretation
  if (fScore.score >= 7) {
    parts.push(`The Piotroski F-Score of ${fScore.score}/9 indicates strong financial health across profitability, leverage, and efficiency metrics.`);
  } else if (fScore.score >= 4) {
    parts.push(`The Piotroski F-Score of ${fScore.score}/9 suggests moderate financial strength with some areas for improvement.`);
  } else {
    parts.push(`A low Piotroski F-Score of ${fScore.score}/9 raises concerns about financial fundamentals — several key health tests were not passed.`);
  }

  // M-Score interpretation
  if (mScore.rating === "UNLIKELY_MANIPULATOR") {
    parts.push(`Beneish M-Score analysis shows no signs of earnings manipulation, indicating reliable reported financials.`);
  } else if (mScore.rating === "POSSIBLE_MANIPULATOR") {
    parts.push(`The Beneish M-Score falls in a grey zone — while not conclusive, some accounting patterns warrant closer scrutiny.`);
  } else if (mScore.rating === "PROBABLE_MANIPULATOR") {
    parts.push(`The Beneish M-Score flags potential earnings manipulation patterns that require careful due diligence before investment.`);
  }

  // Cash flow quality
  if (cfQuality.cfoToNetProfit.rating === "EXCELLENT") {
    parts.push(`Cash flow quality is excellent — operating cash flows exceed reported profits, confirming earnings quality.`);
  } else if (cfQuality.cfoToNetProfit.rating === "RED_FLAG" || cfQuality.cfoToNetProfit.rating === "CRITICAL") {
    parts.push(`Cash flow quality is a concern — operating cash flows significantly lag reported profits, suggesting accrual-driven earnings.`);
  }

  return parts.join(" ");
}

// ─── Utilities ──────────────────────────────────────────────────────────

function safe(v) {
  // Handle {value, state} wrapper objects from TinyFish agent
  if (v && typeof v === "object" && "value" in v && "state" in v) {
    return v.state === "FETCHED" ? v.value : null;
  }
  if (v && typeof v === "object" && "value" in v) {
    return v.value;
  }
  return (typeof v === "number" && !isNaN(v)) ? v : null;
}
function round2(v) { return v !== null && v !== undefined ? Math.round(v * 100) / 100 : null; }
function round4(v) { return v !== null && v !== undefined ? Math.round(v * 10000) / 10000 : null; }
