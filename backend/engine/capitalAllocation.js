/**
 * Module 2 — Capital Allocation Quality
 *
 * Evaluates how management deploys capital.
 * Computes:
 *   - ROIC and WACC estimation → Economic Value Added spread
 *   - Capex analysis (intensity, maintenance vs growth, payback)
 *   - Dividend & buyback quality
 *
 * Input: financialData, allRatios
 * Output: { roicAnalysis, capexAnalysis, dividendAnalysis, score, rating }
 */

// ─── ROIC & WACC Analysis ──────────────────────────────────────────────

export function computeROICAnalysis(financialData, allRatios, sector) {
  const pl = financialData?.profitAndLoss || {};
  const bs = financialData?.balanceSheet || [];
  const ratios = financialData?.ratiosSummary || {};

  const annual = pl.annual || [];
  const latestYear = annual[0] || {};
  const latestBS = bs[0] || {};

  const revenue = safe(latestYear.revenue);
  const operatingProfit = safe(latestYear.operatingProfit);
  const netProfit = safe(latestYear.netProfit);
  const equity = safe(latestBS.shareCapital) + safe(latestBS.reserves);
  const totalDebt = safe(latestBS.borrowings);
  const totalAssets = safe(latestBS.totalAssets);
  const marketCap = safe(ratios.marketCap);

  // Tax rate estimation
  const taxRate = revenue > 0 && operatingProfit > 0 && netProfit > 0
    ? Math.max(0, Math.min(0.35, 1 - (netProfit / operatingProfit)))
    : 0.25; // Default 25% India corporate rate

  // NOPAT (Net Operating Profit After Tax)
  const nopat = operatingProfit * (1 - taxRate);

  // Invested Capital
  const cash = safe(latestBS.investments) * 0.3; // Conservative cash proxy
  const investedCapital = equity + totalDebt - cash;

  // ROIC
  const roic = investedCapital > 0 ? (nopat / investedCapital) * 100 : null;

  // WACC Estimation
  const riskFreeRate = 7.0; // India 10-yr govt bond ~7%
  const marketPremium = 6.0; // Equity risk premium for India
  const beta = estimateBeta(allRatios, sector);
  const costOfEquity = riskFreeRate + (beta * marketPremium);
  const costOfDebt = totalDebt > 0 ? 9.0 : 0; // Average corporate borrowing rate in India ~9%
  const totalValue = marketCap + totalDebt;
  const equityWeight = totalValue > 0 ? marketCap / totalValue : 1;
  const debtWeight = totalValue > 0 ? totalDebt / totalValue : 0;
  const wacc = (equityWeight * costOfEquity) + (debtWeight * costOfDebt * (1 - taxRate));

  // EVA Spread
  const spread = roic !== null ? roic - wacc : null;

  let spreadRating;
  if (spread === null) spreadRating = "NO_DATA";
  else if (spread > 5) spreadRating = "STRONG_VALUE_CREATION";
  else if (spread > 0) spreadRating = "MARGINAL_VALUE_CREATION";
  else spreadRating = "VALUE_DESTRUCTION";

  // ROCE from ratios
  const roce = safe(ratios.roce) || safe(allRatios?.roce);

  return {
    roic: round2(roic),
    nopat: round2(nopat),
    investedCapital: round2(investedCapital),
    wacc: round2(wacc),
    costOfEquity: round2(costOfEquity),
    costOfDebt: round2(costOfDebt),
    beta: round2(beta),
    taxRate: round2(taxRate * 100),
    spread: round2(spread),
    spreadRating,
    roce: round2(roce),
    sector: sector || null,
  };
}

// ─── Capex Analysis ─────────────────────────────────────────────────────

export function computeCapexAnalysis(financialData, allRatios, sector) {
  const pl = financialData?.profitAndLoss || {};
  const cf = financialData?.cashFlow || [];
  const bs = financialData?.balanceSheet || [];

  const latestYear = pl.annual?.[0] || {};
  const latestCF = cf[0] || {};
  const latestBS = bs[0] || {};

  const revenue = safe(latestYear.revenue);
  const operatingProfit = safe(latestYear.operatingProfit);
  const capex = Math.abs(safe(latestCF.investingCF));
  const depreciation = safe(latestBS.fixedAssets) * 0.08; // Approximate

  // Capex Intensity
  const capexIntensity = revenue > 0 ? (capex / revenue) * 100 : null;

  // Sector benchmarks
  const sectorNorms = {
    "Information Technology": { low: 2, high: 8 },
    "FMCG": { low: 3, high: 8 },
    "Banking": { low: 1, high: 5 },
    "Telecom": { low: 15, high: 25 },
    "Automobile": { low: 8, high: 15 },
    "Pharma": { low: 5, high: 12 },
    "default": { low: 5, high: 15 },
  };
  const norm = sectorNorms[sector] || sectorNorms.default;

  let intensityRating;
  if (capexIntensity === null) intensityRating = "NO_DATA";
  else if (capexIntensity < norm.low) intensityRating = "LOW_INVESTMENT";
  else if (capexIntensity <= norm.high) intensityRating = "NORMAL";
  else intensityRating = "HEAVY_INVESTMENT";

  // Maintenance vs Growth split
  const maintenanceCapex = depreciation;
  const growthCapex = Math.max(capex - depreciation, 0);

  // Capex Payback
  const ebitda = operatingProfit + depreciation;
  const investedCapital = safe(latestBS.shareCapital) + safe(latestBS.reserves) + safe(latestBS.borrowings);
  const paybackYears = ebitda > 0 ? investedCapital / ebitda : null;

  let paybackRating;
  if (paybackYears === null) paybackRating = "NO_DATA";
  else if (paybackYears < 5) paybackRating = "CAPITAL_EFFICIENT";
  else if (paybackYears <= 8) paybackRating = "MODERATE";
  else paybackRating = "HIGH_RISK";

  return {
    capexIntensity: round2(capexIntensity),
    sectorNorm: norm,
    intensityRating,
    maintenanceCapex: round2(maintenanceCapex),
    growthCapex: round2(growthCapex),
    totalCapex: round2(capex),
    paybackYears: round2(paybackYears),
    paybackRating,
  };
}

// ─── Dividend & Buyback Quality ─────────────────────────────────────────

export function computeDividendAnalysis(financialData, allRatios) {
  const pl = financialData?.profitAndLoss || {};
  const bs = financialData?.balanceSheet || [];
  const cf = financialData?.cashFlow || [];
  const ratios = financialData?.ratiosSummary || {};

  const latestYear = pl.annual?.[0] || {};
  const latestBS = bs[0] || {};
  const prevBS = bs[1] || {};
  const latestCF = cf[0] || {};

  const netProfit = safe(latestYear.netProfit);
  const eps = safe(latestYear.eps);
  const dividendYield = safe(ratios.dividendYield) || safe(allRatios?.dividendYield);
  const pe = safe(ratios.pe) || safe(allRatios?.pe);
  const marketCap = safe(ratios.marketCap) || safe(allRatios?.marketCap);

  // Estimate dividend from financing CF (outflow component)
  const financingCF = safe(latestCF.financingCF);
  const estimatedDividend = dividendYield > 0 && marketCap > 0
    ? (dividendYield / 100) * marketCap
    : Math.abs(financingCF) * 0.5; // Rough estimate

  // Payout ratio
  const payoutRatio = netProfit > 0 ? (estimatedDividend / netProfit) * 100 : null;

  let payoutRating;
  if (payoutRatio === null) payoutRating = "NO_DATA";
  else if (payoutRatio > 100) payoutRating = "UNSUSTAINABLE";
  else if (payoutRatio > 80) payoutRating = "HIGH_PAYOUT";
  else if (payoutRatio >= 20) payoutRating = "BALANCED";
  else payoutRating = "LOW_PAYOUT";

  // Coverage
  const dps = dividendYield > 0 && pe > 0 ? eps * (dividendYield / 100) * pe / 100 : null;
  const dividendCoverage = dps > 0 ? eps / dps : null;

  let coverageRating;
  if (dividendCoverage === null) coverageRating = "NO_DATA";
  else if (dividendCoverage > 2) coverageRating = "WELL_COVERED";
  else if (dividendCoverage >= 1.5) coverageRating = "ADEQUATE";
  else coverageRating = "AT_RISK";

  // Share dilution check
  const shareDilution = safe(latestBS.shareCapital) - safe(prevBS.shareCapital);
  const dilutionPct = safe(prevBS.shareCapital) > 0
    ? (shareDilution / safe(prevBS.shareCapital)) * 100
    : 0;

  let dilutionRating;
  if (dilutionPct < -0.5) dilutionRating = "BUYBACK";
  else if (dilutionPct <= 0.5) dilutionRating = "STABLE";
  else if (dilutionPct <= 3) dilutionRating = "MINOR_DILUTION";
  else dilutionRating = "SIGNIFICANT_DILUTION";

  return {
    dividendYield: round2(dividendYield),
    payoutRatio: round2(payoutRatio),
    payoutRating,
    dividendCoverage: round2(dividendCoverage),
    coverageRating,
    dilutionPct: round2(dilutionPct),
    dilutionRating,
  };
}

// ─── Composite Capital Allocation Score ─────────────────────────────────

export function computeCapitalAllocation(financialData, allRatios, sector) {
  const roicAnalysis = computeROICAnalysis(financialData, allRatios, sector);
  const capexAnalysis = computeCapexAnalysis(financialData, allRatios, sector);
  const dividendAnalysis = computeDividendAnalysis(financialData, allRatios);

  let score = 50;

  // ROIC-WACC spread (40% weight)
  if (roicAnalysis.spreadRating === "STRONG_VALUE_CREATION") score += 20;
  else if (roicAnalysis.spreadRating === "MARGINAL_VALUE_CREATION") score += 8;
  else if (roicAnalysis.spreadRating === "VALUE_DESTRUCTION") score -= 18;

  // Capex efficiency (30% weight)
  if (capexAnalysis.paybackRating === "CAPITAL_EFFICIENT") score += 12;
  else if (capexAnalysis.paybackRating === "MODERATE") score += 3;
  else if (capexAnalysis.paybackRating === "HIGH_RISK") score -= 10;

  // Dividend quality (20% weight)
  if (dividendAnalysis.payoutRating === "BALANCED") score += 8;
  else if (dividendAnalysis.payoutRating === "UNSUSTAINABLE") score -= 10;

  // Dilution penalty (10% weight)
  if (dividendAnalysis.dilutionRating === "BUYBACK") score += 5;
  else if (dividendAnalysis.dilutionRating === "SIGNIFICANT_DILUTION") score -= 8;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let rating;
  if (score >= 75) rating = "EXCELLENT";
  else if (score >= 55) rating = "GOOD";
  else if (score >= 35) rating = "FAIR";
  else rating = "POOR";

  // Generate narrative commentary
  const parts = [];
  if (roicAnalysis.spreadRating === "STRONG_VALUE_CREATION") {
    parts.push(`Capital allocation is creating strong shareholder value with ROIC of ${roicAnalysis.roic}% exceeding the cost of capital (WACC ${roicAnalysis.wacc}%), producing a positive spread of ${roicAnalysis.spread}%.`);
  } else if (roicAnalysis.spreadRating === "MARGINAL_VALUE_CREATION") {
    parts.push(`The company is marginally creating value — ROIC at ${roicAnalysis.roic}% slightly exceeds WACC at ${roicAnalysis.wacc}%, but the thin spread of ${roicAnalysis.spread}% leaves little room for error.`);
  } else if (roicAnalysis.spreadRating === "VALUE_DESTRUCTION") {
    parts.push(`Capital allocation is destroying value — the company earns below its cost of capital, meaning invested capital is not being deployed efficiently.`);
  }

  if (capexAnalysis.paybackRating === "CAPITAL_EFFICIENT") {
    parts.push(`Capex payback period of ${capexAnalysis.paybackYears} years indicates efficient capital deployment.`);
  } else if (capexAnalysis.paybackRating === "HIGH_RISK") {
    parts.push(`The capital payback period of ${capexAnalysis.paybackYears} years is extended, suggesting heavy investment yet to produce adequate returns.`);
  }

  if (dividendAnalysis.payoutRating === "BALANCED") {
    parts.push(`Dividend policy is well-balanced with a ${dividendAnalysis.payoutRatio}% payout ratio, returning capital to shareholders while retaining growth capacity.`);
  }

  const commentary = parts.join(" ");

  return { score, rating, commentary, roicAnalysis, capexAnalysis, dividendAnalysis };
}

// ─── Utilities ──────────────────────────────────────────────────────────

function estimateBeta(allRatios, sector) {
  // Start from the sector-specific beta rather than generic market average
  const sectorBetas = {
    'information technology': 0.85, 'software': 0.90,
    'banking': 1.10, 'financial services': 1.05, 'insurance': 0.90,
    'pharma': 0.75, 'healthcare': 0.80,
    'fmcg': 0.70, 'consumer goods': 0.75,
    'automobile': 1.10, 'tyres': 0.25, 'tyre': 0.25,
    'cement': 0.90, 'metals': 1.20, 'mining': 1.25,
    'oil & gas': 1.00, 'power': 0.80, 'renewable energy': 1.10,
    'infrastructure': 1.15, 'defence': 0.70,
    'telecom': 0.95, 'real estate': 1.30,
    'chemicals': 1.00, 'paints': 0.85,
    'retail': 0.95, 'diversified': 1.00,
  };
  const sectorKey = (sector || '').toLowerCase();
  const matchedKey = Object.keys(sectorBetas).find(k => sectorKey.includes(k));
  let beta = matchedKey ? sectorBetas[matchedKey] : 1.0; // Market average if unknown
  console.log(`[CapAlloc] Sector="${sector}" → base beta=${beta}`);

  // Adjust for financial leverage and growth volatility
  const de = safe(allRatios?.debtToEquity);
  const revGrowth = safe(allRatios?.revenueCAGR3yr);
  if (de > 1) beta += 0.2;
  if (de > 2) beta += 0.3;
  if (revGrowth > 20) beta += 0.15;
  if (revGrowth < 0) beta += 0.25;
  return Math.max(0.5, Math.min(2.5, beta));
}

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
