/**
 * Module 10 — Valuation Engine
 *
 * Multi-model valuation framework:
 *   - DCF (Discounted Cash Flow) with bull/base/bear scenarios
 *   - Earnings Power Value (EPV) floor
 *   - Relative valuation matrix (PE, PB, EV/EBITDA)
 *   - Margin of Safety calculation
 *   - Composite valuation verdict
 *
 * Input: financialData, allRatios, sector
 * Output: { dcf, epv, relativeValuation, marginOfSafety, score, rating }
 */

// ─── DCF Valuation (3 Scenarios) ────────────────────────────────────────

export function computeDCF(financialData, allRatios, sector) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const cf = financialData?.cashFlow || [];
  const bs = financialData?.balanceSheet || [];

  // Get latest FCF
  const latestCFO = safe(cf[0]?.cashFromOperations || cf[0]?.operatingCashFlow);
  const capex = Math.abs(safe(cf[0]?.purchaseOfFixedAssets || cf[0]?.capex));
  const fcf = latestCFO - capex;

  // Get FCF from previous year for growth estimation
  const prevCFO = safe(cf[1]?.cashFromOperations || cf[1]?.operatingCashFlow);
  const prevCapex = Math.abs(safe(cf[1]?.purchaseOfFixedAssets || cf[1]?.capex));
  const prevFCF = prevCFO - prevCapex;

  const fcfGrowth = prevFCF > 0 ? (fcf - prevFCF) / prevFCF : 0;

  // Revenue growth for projection guidance
  const revenues = pl.map((y) => safe(y.revenue)).filter((v) => v > 0);
  const revenueGrowths = [];
  for (let i = 0; i < revenues.length - 1; i++) {
    if (revenues[i + 1] > 0) revenueGrowths.push((revenues[i] - revenues[i + 1]) / revenues[i + 1]);
  }
  const avgRevenueGrowth = average(revenueGrowths);

  // Discount rate (India-specific WACC proxy)
  const riskFreeRate = 0.07;
  const equityPremium = 0.06;
  const beta = getSectorBeta(sector);
  const costOfEquity = riskFreeRate + beta * equityPremium;
  const wacc = costOfEquity * 0.85 + 0.09 * 0.75 * 0.15; // 85% equity, 15% debt
  const terminalGrowth = 0.05; // 5% India long-term nominal GDP

  // Three scenarios
  const scenarios = {
    bull: { growthRate: Math.min(avgRevenueGrowth * 1.2, 0.30), projectionYears: 10 },
    base: { growthRate: Math.min(avgRevenueGrowth, 0.20), projectionYears: 10 },
    bear: { growthRate: Math.max(avgRevenueGrowth * 0.5, 0.02), projectionYears: 10 },
  };

  const results = {};
  for (const [scenario, params] of Object.entries(scenarios)) {
    let pvFCF = 0;
    let projectedFCF = Math.max(fcf, 0);

    for (let yr = 1; yr <= params.projectionYears; yr++) {
      projectedFCF *= (1 + params.growthRate);
      pvFCF += projectedFCF / Math.pow(1 + wacc, yr);
    }

    // Terminal value (Gordon Growth)
    const terminalFCF = projectedFCF * (1 + terminalGrowth);
    const terminalValue = wacc > terminalGrowth ? terminalFCF / (wacc - terminalGrowth) : 0;
    const pvTerminal = terminalValue / Math.pow(1 + wacc, params.projectionYears);

    const enterpriseValue = pvFCF + pvTerminal;
    const debt = safe(bs[0]?.borrowings) + safe(bs[0]?.otherLiabilities);
    const cash = safe(bs[0]?.cashAndEquivalents || bs[0]?.cash);
    const equityValue = Math.max(0, enterpriseValue - debt + cash);

    results[scenario] = {
      fcfGrowthUsed: round2(params.growthRate * 100),
      pvFreeCashFlows: Math.round(pvFCF),
      terminalValue: Math.round(pvTerminal),
      enterpriseValue: Math.round(enterpriseValue),
      equityValue: Math.round(equityValue),
    };
  }

  return {
    latestFCF: Math.round(fcf),
    wacc: round2(wacc * 100),
    terminalGrowthRate: round2(terminalGrowth * 100),
    scenarios: results,
  };
}

// ─── Earnings Power Value (EPV) ─────────────────────────────────────────

export function computeEPV(financialData, allRatios) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const bs = financialData?.balanceSheet || [];

  // Normalized earnings (average of last 3 years operating profit)
  const opProfits = pl.slice(0, 3).map((y) => safe(y.operatingProfit));
  const normalizedOP = average(opProfits);

  // After-tax operating earnings
  const taxRate = 0.25;
  const normalizedEarnings = normalizedOP * (1 - taxRate);

  // Cost of capital (WACC proxy)
  const wacc = 0.12;

  // EPV = Normalized Earnings / WACC
  const epv = wacc > 0 ? normalizedEarnings / wacc : 0;

  // Reproduction cost (net assets as floor)
  const netAssets = safe(bs[0]?.shareCapital) + safe(bs[0]?.reserves);

  // EPV premium over net assets → franchise value
  const franchiseValue = Math.max(0, epv - netAssets);
  const franchiseRatio = netAssets > 0 ? franchiseValue / netAssets : 0;

  return {
    normalizedEarnings: Math.round(normalizedEarnings),
    epvEnterprise: Math.round(epv),
    netAssets: Math.round(netAssets),
    franchiseValue: Math.round(franchiseValue),
    franchiseRatio: round2(franchiseRatio),
  };
}

// ─── Relative Valuation Matrix ──────────────────────────────────────────

export function computeRelativeValuation(financialData, allRatios, sector) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const bs = financialData?.balanceSheet || [];

  const latestEarnings = safe(pl[0]?.netProfit);
  const revenue = safe(pl[0]?.revenue);
  const ebitda = safe(pl[0]?.operatingProfit) + safe(pl[0]?.depreciation);
  const bookValue = safe(bs[0]?.shareCapital) + safe(bs[0]?.reserves);

  // Sector benchmarks (Indian market averages)
  const benchmarks = getSectorBenchmarks(sector);

  // Calculate implied values at sector multiples
  const peImplied = latestEarnings * benchmarks.pe;
  const pbImplied = bookValue * benchmarks.pb;
  const evEbitdaImplied = ebitda * benchmarks.evEbitda;
  const psImplied = revenue * benchmarks.ps;

  // Current multiples (from ratios if available)
  const currentPE = allRatios?.valuation?.pe ?? null;
  const currentPB = allRatios?.valuation?.pb ?? null;

  // Premium/discount to sector
  const pePremium = currentPE && benchmarks.pe ? ((currentPE / benchmarks.pe) - 1) * 100 : null;
  const pbPremium = currentPB && benchmarks.pb ? ((currentPB / benchmarks.pb) - 1) * 100 : null;

  return {
    impliedValues: {
      peImplied: Math.round(peImplied),
      pbImplied: Math.round(pbImplied),
      evEbitdaImplied: Math.round(evEbitdaImplied),
      psImplied: Math.round(psImplied),
    },
    sectorBenchmarks: benchmarks,
    premiumDiscount: {
      pePremium: round2(pePremium),
      pbPremium: round2(pbPremium),
    },
  };
}

// ─── Margin of Safety Calculation ───────────────────────────────────────

export function computeMarginOfSafety(dcf, epv, relativeVal) {
  // Average of valuations as intrinsic value estimate
  const valuations = [
    dcf?.scenarios?.base?.equityValue,
    dcf?.scenarios?.bear?.equityValue,
    epv?.epvEnterprise,
    relativeVal?.impliedValues?.peImplied,
  ].filter((v) => v && v > 0);

  const avgIntrinsicValue = average(valuations);
  const conservativeValue = valuations.length > 0 ? Math.min(...valuations) : 0;

  // Note: without market cap, we assess relative spread as quality indicator
  const valuationSpread = avgIntrinsicValue > 0 && conservativeValue > 0
    ? ((avgIntrinsicValue - conservativeValue) / avgIntrinsicValue * 100)
    : 0;

  let conviction;
  if (valuationSpread < 20) conviction = "HIGH"; // Models agree
  else if (valuationSpread < 40) conviction = "MODERATE";
  else conviction = "LOW"; // Wide disagreement between methods

  return {
    avgIntrinsicValue: Math.round(avgIntrinsicValue),
    conservativeValue: Math.round(conservativeValue),
    valuationSpread: round2(valuationSpread),
    conviction,
  };
}

// ─── Composite Valuation Score ──────────────────────────────────────────

export function computeValuation(financialData, allRatios, sector) {
  const dcf = computeDCF(financialData, allRatios, sector);
  const epv = computeEPV(financialData, allRatios);
  const relativeVal = computeRelativeValuation(financialData, allRatios, sector);
  const marginOfSafety = computeMarginOfSafety(dcf, epv, relativeVal);

  let score = 50;

  // DCF health: positive enterprise values across scenarios
  if (dcf.scenarios.bear?.equityValue > 0) score += 15;
  else if (dcf.scenarios.base?.equityValue > 0) score += 8;
  else score -= 10;

  // EPV franchise value: positive = moat exists
  if (epv.franchiseRatio > 1) score += 10;
  else if (epv.franchiseRatio > 0.3) score += 5;
  else score -= 5;

  // Relative valuation: premium/discount
  const pePremium = relativeVal.premiumDiscount.pePremium;
  if (pePremium !== null) {
    if (pePremium < -20) score += 10; // Undervalued
    else if (pePremium < 0) score += 5;
    else if (pePremium > 50) score -= 10; // Very expensive
    else if (pePremium > 20) score -= 5;
  }

  // Model conviction
  if (marginOfSafety.conviction === "HIGH") score += 8;
  else if (marginOfSafety.conviction === "LOW") score -= 5;

  score = clamp(score, 0, 100);

  let rating;
  if (score >= 75) rating = "UNDERVALUED";
  else if (score >= 55) rating = "FAIRLY_VALUED";
  else if (score >= 35) rating = "PREMIUM";
  else rating = "OVERVALUED";

  // Generate commentary
  const parts = [];
  if (marginOfSafety?.conviction === "STRONG_BUY") {
    parts.push(`Valuation analysis suggests a compelling opportunity — the current price offers significant margin of safety relative to intrinsic value estimates.`);
  } else if (marginOfSafety?.conviction === "BUY") {
    parts.push(`The stock appears reasonably valued with some upside potential relative to estimated intrinsic value.`);
  } else if (marginOfSafety?.conviction === "HOLD") {
    parts.push(`Current valuation is broadly fair — the stock is neither significantly undervalued nor overvalued based on fundamental analysis.`);
  } else if (marginOfSafety?.conviction === "OVERVALUED") {
    parts.push(`Valuation metrics suggest the stock is trading at a premium to intrinsic value, which may limit near-term upside.`);
  }
  if (dcf?.scenarios?.base?.intrinsicValue > 0) {
    parts.push(`DCF base-case intrinsic value is estimated at ₹${Math.round(dcf.scenarios.base.intrinsicValue).toLocaleString()} Cr.`);
  }
  const commentary = parts.join(" ");

  return { score, rating, commentary, dcf, epv, relativeValuation: relativeVal, marginOfSafety };
}

// ─── Sector Helpers ─────────────────────────────────────────────────────

function getSectorBeta(sector) {
  const betas = {
    "information technology": 0.85, "software": 0.90, "banking": 1.10,
    "financial services": 1.05, "pharma": 0.75, "fmcg": 0.70,
    "auto": 1.10, "automobile": 1.10, "tyres": 0.25, "tyre": 0.25,
    "cement": 0.90, "metals": 1.20, "oil": 1.00,
    "telecom": 0.95, "power": 0.80, "infrastructure": 1.15,
    "real estate": 1.30, "chemicals": 1.00, "auto ancillaries": 0.80,
  };
  const key = Object.keys(betas).find((k) => (sector || "").toLowerCase().includes(k));
  return key ? betas[key] : 1.0;
}

function getSectorBenchmarks(sector) {
  const benchmarks = {
    "information technology": { pe: 28, pb: 8, evEbitda: 18, ps: 5 },
    "banking": { pe: 15, pb: 2.5, evEbitda: 10, ps: 3 },
    "pharma": { pe: 30, pb: 5, evEbitda: 16, ps: 4 },
    "fmcg": { pe: 45, pb: 15, evEbitda: 30, ps: 8 },
    "auto": { pe: 22, pb: 4, evEbitda: 12, ps: 2 },
    "tyres": { pe: 18, pb: 2.5, evEbitda: 10, ps: 1.5 },
    "cement": { pe: 30, pb: 4.5, evEbitda: 14, ps: 3 },
    "metals": { pe: 12, pb: 1.5, evEbitda: 6, ps: 1 },
    "chemicals": { pe: 25, pb: 5, evEbitda: 15, ps: 3 },
    "telecom": { pe: 40, pb: 5, evEbitda: 8, ps: 3 },
    "real estate": { pe: 20, pb: 2, evEbitda: 12, ps: 2 },
  };
  const key = Object.keys(benchmarks).find((k) => (sector || "").toLowerCase().includes(k));
  return key ? benchmarks[key] : { pe: 20, pb: 3, evEbitda: 12, ps: 2 };
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
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function average(arr) {
  const valid = arr.filter((v) => typeof v === "number" && !isNaN(v) && v > 0);
  return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
}
