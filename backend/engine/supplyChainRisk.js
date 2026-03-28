/**
 * Module 9 — Supply Chain & Operational Risk Analysis
 *
 * Evaluates operational risk through:
 *   - Customer/Revenue concentration risk
 *   - Supplier/Input cost dependency
 *   - Geographic concentration
 *   - Regulatory compliance signals
 *   - Operational efficiency metrics
 *
 * Input: financialData, legalData, sector
 * Output: { revenueConcentration, inputRisk, regulatoryRisk, operationalEfficiency, score, rating }
 */

// ─── Revenue/Customer Concentration ─────────────────────────────────────

export function analyzeRevenueConcentration(financialData) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const revenues = pl.map((y) => safe(y.revenue)).filter((v) => v > 0);

  // Revenue volatility as proxy for customer concentration
  const cv = computeCV(revenues);

  // Revenue diversification proxy from other income ratio
  const latestRevenue = safe(pl[0]?.revenue);
  const otherIncome = safe(pl[0]?.otherIncome);
  const otherIncomeRatio = latestRevenue > 0 ? (otherIncome / latestRevenue * 100) : 0;

  // Single-source risk score
  let concentrationScore;
  if (cv < 0.08) concentrationScore = 85; // Very stable = diversified
  else if (cv < 0.15) concentrationScore = 70;
  else if (cv < 0.25) concentrationScore = 50;
  else if (cv < 0.4) concentrationScore = 35;
  else concentrationScore = 20;

  // Other income diversification bonus
  if (otherIncomeRatio > 5 && otherIncomeRatio < 30) concentrationScore += 5;

  let risk;
  if (concentrationScore >= 70) risk = "LOW";
  else if (concentrationScore >= 50) risk = "MODERATE";
  else risk = "HIGH";

  return { score: clamp(concentrationScore, 0, 100), revenueCV: round2(cv), otherIncomeRatio: round2(otherIncomeRatio), risk };
}

// ─── Input Cost / Supplier Risk ─────────────────────────────────────────

export function analyzeInputRisk(financialData, sector) {
  const pl = financialData?.profitAndLoss?.annual || [];

  const rawMaterialRatios = pl.map((y) => {
    const rev = safe(y.revenue);
    const rm = safe(y.rawMaterial) + safe(y.manufacturingExpenses);
    return rev > 0 ? (rm / rev * 100) : 0;
  });

  const latestRM = rawMaterialRatios[0] || 0;
  const avgRM = average(rawMaterialRatios);
  const rmVolatility = computeCV(rawMaterialRatios.filter((r) => r > 0));

  // High input cost = supplier dependency
  let inputScore;
  if (latestRM > 60) inputScore = 25; // Very high dependency
  else if (latestRM > 45) inputScore = 40;
  else if (latestRM > 25) inputScore = 60;
  else if (latestRM > 10) inputScore = 75;
  else inputScore = 85; // Service-based, minimal inputs

  // Volatility penalty (large cost swings = supplier power)
  if (rmVolatility > 0.15) inputScore -= 10;
  else if (rmVolatility > 0.08) inputScore -= 5;

  // Sector context: commodity-dependent sectors are inherently riskier
  const commoditySectors = /^(mining|metals|chemicals|oil|gas|cement|steel|construction)/i;
  if (commoditySectors.test(sector)) inputScore -= 5;

  let risk;
  if (inputScore >= 65) risk = "LOW";
  else if (inputScore >= 40) risk = "MODERATE";
  else risk = "HIGH";

  return {
    score: clamp(inputScore, 0, 100),
    latestInputRatio: round2(latestRM),
    inputVolatility: round2(rmVolatility),
    risk,
  };
}

// ─── Regulatory Risk ────────────────────────────────────────────────────

export function analyzeRegulatoryRisk(legalData, sector) {
  const announcements = legalData?.announcements || [];

  // Regulatory compliance signals
  const regulatoryAnns = announcements.filter((a) =>
    /sebi|rbi|regulation|compliance|penalty|fine|show cause|adjudicat|violation|order.*against|notice.*received/i.test(a.subject || "")
  );

  const penalties = regulatoryAnns.filter((a) =>
    /penalty|fine|settlement|consent order/i.test(a.subject || "")
  );

  const investigations = regulatoryAnns.filter((a) =>
    /investigation|inquiry|inspection|show cause|notice/i.test(a.subject || "")
  );

  let riskScore;
  if (penalties.length === 0 && investigations.length === 0) riskScore = 85;
  else if (penalties.length <= 1 && investigations.length <= 1) riskScore = 60;
  else if (penalties.length <= 3) riskScore = 40;
  else riskScore = 20;

  // Heavily regulated sectors get extra scrutiny
  const heavilyRegulated = /^(banking|financial|insurance|pharma|telecom|power)/i;
  if (heavilyRegulated.test(sector)) riskScore -= 5;

  let risk;
  if (riskScore >= 65) risk = "LOW";
  else if (riskScore >= 40) risk = "MODERATE";
  else risk = "HIGH";

  return {
    score: clamp(riskScore, 0, 100),
    regulatoryMentions: regulatoryAnns.length,
    penalties: penalties.length,
    investigations: investigations.length,
    risk,
  };
}

// ─── Operational Efficiency ─────────────────────────────────────────────

export function analyzeOperationalEfficiency(financialData) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const bs = financialData?.balanceSheet || [];

  // Asset turnover
  const latestRevenue = safe(pl[0]?.revenue);
  const avgAssets = bs.length >= 2
    ? (safe(bs[0]?.totalAssets) + safe(bs[1]?.totalAssets)) / 2
    : safe(bs[0]?.totalAssets);
  const assetTurnover = avgAssets > 0 ? latestRevenue / avgAssets : 0;

  // Fixed asset turnover
  const fixedAssets = safe(bs[0]?.fixedAssets || bs[0]?.netBlock);
  const fixedAssetTurnover = fixedAssets > 0 ? latestRevenue / fixedAssets : 0;

  // Operating leverage (OPM stability)
  const margins = pl.map((y) => safe(y.revenue) > 0 ? safe(y.operatingProfit) / safe(y.revenue) * 100 : 0);
  const avgMargin = average(margins);
  const marginStability = 1 - computeCV(margins.filter((m) => m > 0));

  let efficiencyScore;
  if (assetTurnover > 1.5 && avgMargin > 15) efficiencyScore = 85;
  else if (assetTurnover > 1.0 && avgMargin > 10) efficiencyScore = 70;
  else if (assetTurnover > 0.5) efficiencyScore = 50;
  else efficiencyScore = 30;

  return {
    score: clamp(efficiencyScore, 0, 100),
    assetTurnover: round2(assetTurnover),
    fixedAssetTurnover: round2(fixedAssetTurnover),
    avgOPM: round2(avgMargin),
    marginStability: round2(marginStability),
  };
}

// ─── Composite Supply Chain Risk Score ──────────────────────────────────

export function computeSupplyChainRisk(financialData, legalData, sector) {
  const revenueConcentration = analyzeRevenueConcentration(financialData);
  const inputRisk = analyzeInputRisk(financialData, sector);
  const regulatoryRisk = analyzeRegulatoryRisk(legalData, sector);
  const operationalEfficiency = analyzeOperationalEfficiency(financialData);

  // Weighted: revenue 25%, input 25%, regulatory 25%, efficiency 25%
  const score = Math.round(
    revenueConcentration.score * 0.25 +
    inputRisk.score * 0.25 +
    regulatoryRisk.score * 0.25 +
    operationalEfficiency.score * 0.25
  );

  let rating;
  if (score >= 70) rating = "LOW_RISK";
  else if (score >= 50) rating = "MODERATE_RISK";
  else if (score >= 35) rating = "ELEVATED_RISK";
  else rating = "HIGH_RISK";

  // Generate commentary
  const parts = [];
  if (score >= 70) {
    parts.push(`Supply chain risk profile is manageable with diversified revenue sources and adequate operational resilience.`);
  } else if (score >= 50) {
    parts.push(`Moderate supply chain and operational risks exist that could impact performance under adverse conditions.`);
  } else {
    parts.push(`Elevated supply chain risks including revenue concentration or input cost dependency could materially impact the business during stress periods.`);
  }
  if (operationalEfficiency.assetTurnover > 1.5) {
    parts.push(`Strong asset utilization efficiency with ${operationalEfficiency.assetTurnover}x turnover.`);
  }
  const commentary = parts.join(" ");

  return { score: clamp(score, 0, 100), rating, commentary, revenueConcentration, inputRisk, regulatoryRisk, operationalEfficiency };
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
  const valid = arr.filter((v) => typeof v === "number" && !isNaN(v));
  return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
}

function computeCV(arr) {
  const valid = arr.filter((v) => v > 0);
  if (valid.length < 2) return 0;
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  if (mean === 0) return 0;
  const std = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length);
  return std / mean;
}
