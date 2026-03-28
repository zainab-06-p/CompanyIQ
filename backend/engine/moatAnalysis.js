/**
 * Module 4 — Economic Moat Analysis
 *
 * Evaluates competitive advantage (moat) through:
 *   - 5 Moat Sources: Switching Costs, Network Effects, Cost Advantage, Intangible Assets, Efficient Scale
 *   - Porter's 5 Forces proxy (from financial data)
 *   - Moat trajectory (widening / stable / narrowing)
 *
 * Input: financialData, allRatios, sector
 * Output: { moatSources, porterForces, moatScore, moatTrajectory, rating }
 */

// ─── Moat Source Scoring ────────────────────────────────────────────────

export function scoreMoatSources(financialData, allRatios, sector) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const bs = financialData?.balanceSheet || [];

  // 1. Switching Costs (higher margins + consistent revenue = sticky customers)
  const margins = pl.map((y) => safe(y.revenue) > 0 ? safe(y.operatingProfit) / safe(y.revenue) * 100 : 0);
  const avgMargin = average(margins);
  const revenueVolatility = computeCV(pl.map((y) => safe(y.revenue)));

  let switchingCosts = 5;
  if (avgMargin > 25 && revenueVolatility < 0.15) switchingCosts = 9;
  else if (avgMargin > 20 && revenueVolatility < 0.25) switchingCosts = 7;
  else if (avgMargin > 12 && revenueVolatility < 0.35) switchingCosts = 5;
  else if (avgMargin < 8 || revenueVolatility > 0.5) switchingCosts = 2;

  // Sector bonus: IT Services, SaaS have inherently sticky customers
  const stickyBySector = /^(information technology|software|saas|cloud)/i.test(sector);
  if (stickyBySector) switchingCosts = Math.min(10, switchingCosts + 1);

  // 2. Network Effects (proxy: revenue growth acceleration + scale)
  const revenues = pl.map((y) => safe(y.revenue)).filter((v) => v > 0);
  const growthRates = [];
  for (let i = 0; i < revenues.length - 1; i++) {
    if (revenues[i + 1] > 0) growthRates.push((revenues[i] - revenues[i + 1]) / revenues[i + 1]);
  }
  let networkEffects = 3;
  if (growthRates.length >= 2) {
    const recentGrowth = growthRates[0] || 0;
    const olderGrowth = growthRates[growthRates.length - 1] || 0;
    const acceleration = recentGrowth - olderGrowth;
    if (acceleration > 0.05 && recentGrowth > 0.15) networkEffects = 8;
    else if (recentGrowth > 0.1) networkEffects = 6;
    else if (recentGrowth > 0.05) networkEffects = 4;
    else networkEffects = 2;
  }
  const networkBySector = /^(marketplace|platform|payments|social)/i.test(sector);
  if (networkBySector) networkEffects = Math.min(10, networkEffects + 2);

  // 3. Cost Advantage (low-cost producer = higher margins than peers)
  const opmRatio = allRatios?.profitability?.operatingMargin ?? avgMargin;
  let costAdvantage = 5;
  if (opmRatio > 30) costAdvantage = 9;
  else if (opmRatio > 20) costAdvantage = 7;
  else if (opmRatio > 12) costAdvantage = 5;
  else if (opmRatio > 5) costAdvantage = 3;
  else costAdvantage = 2;

  // 4. Intangible Assets (brand proxies: margin premium, no tangible asset dependency)
  const assetsArr = bs.map((y) => safe(y.totalAssets)).filter((v) => v > 0);
  const fixedArr = bs.map((y) => safe(y.fixedAssets) || safe(y.netBlock)).filter((v) => v > 0);
  let intangibles = 5;
  if (assetsArr.length > 0 && fixedArr.length > 0) {
    const assetLightness = 1 - (fixedArr[0] / assetsArr[0]);
    if (assetLightness > 0.7 && avgMargin > 20) intangibles = 9;
    else if (assetLightness > 0.5 && avgMargin > 15) intangibles = 7;
    else if (assetLightness < 0.3 && avgMargin < 10) intangibles = 3;
  }
  const brandBySector = /^(fmcg|consumer|luxury|pharma)/i.test(sector);
  if (brandBySector) intangibles = Math.min(10, intangibles + 1);

  // 5. Efficient Scale (limited market with scale incumbency)
  const latestRevenue = revenues[0] || 0;
  let efficientScale = 5;
  // Scale proxy: if large revenue with stable margins → market discipline
  if (latestRevenue > 50000 && avgMargin > 15) efficientScale = 8;
  else if (latestRevenue > 10000 && avgMargin > 12) efficientScale = 6;
  else if (latestRevenue < 1000) efficientScale = 3;

  const utilityBySector = /^(utilities|telecom|infrastructure|mining)/i.test(sector);
  if (utilityBySector) efficientScale = Math.min(10, efficientScale + 1);

  return {
    switchingCosts: { score: switchingCosts, max: 10 },
    networkEffects: { score: networkEffects, max: 10 },
    costAdvantage: { score: costAdvantage, max: 10 },
    intangibleAssets: { score: intangibles, max: 10 },
    efficientScale: { score: efficientScale, max: 10 },
  };
}

// ─── Porter's 5 Forces Proxy ────────────────────────────────────────────

export function estimatePorterForces(financialData, allRatios, sector) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const margins = pl.map((y) => safe(y.revenue) > 0 ? safe(y.operatingProfit) / safe(y.revenue) * 100 : 0);
  const avgMargin = average(margins);
  const marginTrend = margins.length >= 2 ? margins[0] - margins[margins.length - 1] : 0;
  const debtEquity = allRatios?.leverage?.debtToEquity ?? null;

  // Competitive Rivalry: margin compression = intense rivalry
  let rivalry;
  if (marginTrend < -5) rivalry = { intensity: "HIGH", score: 3 };
  else if (marginTrend < -2) rivalry = { intensity: "MODERATE", score: 5 };
  else rivalry = { intensity: "LOW", score: 8 };

  // Buyer Power: low margins = high buyer power
  let buyerPower;
  if (avgMargin < 8) buyerPower = { power: "HIGH", score: 3 };
  else if (avgMargin < 18) buyerPower = { power: "MODERATE", score: 6 };
  else buyerPower = { power: "LOW", score: 8 };

  // Supplier Power: high COGS ratio = supplier dependence
  const latestCOGS = safe(pl[0]?.rawMaterial) + safe(pl[0]?.manufacturingExpenses);
  const latestRevenue = safe(pl[0]?.revenue);
  const cogsRatio = latestRevenue > 0 ? (latestCOGS / latestRevenue) : 0.5;
  let supplierPower;
  if (cogsRatio > 0.7) supplierPower = { power: "HIGH", score: 3 };
  else if (cogsRatio > 0.4) supplierPower = { power: "MODERATE", score: 6 };
  else supplierPower = { power: "LOW", score: 8 };

  // Threat of New Entrants: high margins + high capital = barriers exist
  let newEntrants;
  const capitalIntenseSectors = /^(banking|telecom|infra|utilities|mining|cement)/i;
  if (capitalIntenseSectors.test(sector) || avgMargin > 25) newEntrants = { threat: "LOW", score: 8 };
  else if (avgMargin > 12) newEntrants = { threat: "MODERATE", score: 5 };
  else newEntrants = { threat: "HIGH", score: 3 };

  // Threat of Substitutes: low switching cost sectors
  let substitutes;
  const highSubSectors = /^(commodity|chemicals|metals|textiles)/i;
  if (highSubSectors.test(sector)) substitutes = { threat: "HIGH", score: 3 };
  else substitutes = { threat: "MODERATE", score: 6 };

  return { rivalry, buyerPower, supplierPower, newEntrants, substitutes };
}

// ─── Moat Trajectory ────────────────────────────────────────────────────

function assessMoatTrajectory(financialData, allRatios) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const margins = pl.map((y) => safe(y.revenue) > 0 ? safe(y.operatingProfit) / safe(y.revenue) * 100 : 0);
  const revenueGrowths = [];
  const revenues = pl.map((y) => safe(y.revenue));
  for (let i = 0; i < revenues.length - 1; i++) {
    if (revenues[i + 1] > 0) revenueGrowths.push((revenues[i] - revenues[i + 1]) / revenues[i + 1]);
  }

  const marginTrend = margins.length >= 3
    ? (margins[0] + (margins[1] || margins[0])) / 2 - (margins[margins.length - 1] + (margins[margins.length - 2] || margins[margins.length - 1])) / 2
    : 0;

  const avgGrowth = average(revenueGrowths);

  if (marginTrend > 2 && avgGrowth > 0.08) return "WIDENING";
  if (marginTrend > -2 && avgGrowth > 0) return "STABLE";
  if (marginTrend < -3 || avgGrowth < -0.05) return "ERODING";
  return "STABLE";
}

// ─── Composite Moat Score ───────────────────────────────────────────────

export function computeMoatAnalysis(financialData, allRatios, sector) {
  const sources = scoreMoatSources(financialData, allRatios, sector);
  const porter = estimatePorterForces(financialData, allRatios, sector);
  const trajectory = assessMoatTrajectory(financialData, allRatios);

  // Moat score: weighted average of 5 sources (each 0-10, scale to 0-100)
  const moatRaw =
    sources.switchingCosts.score * 0.25 +
    sources.networkEffects.score * 0.15 +
    sources.costAdvantage.score * 0.25 +
    sources.intangibleAssets.score * 0.2 +
    sources.efficientScale.score * 0.15;

  // Porter's complement: average of 5 forces → higher = stronger competitive position
  const porterAvg = (
    porter.rivalry.score +
    porter.buyerPower.score +
    porter.supplierPower.score +
    porter.newEntrants.score +
    porter.substitutes.score
  ) / 5;

  // Blend: 60% moat sources + 40% Porter
  let score = Math.round((moatRaw * 0.6 + porterAvg * 0.4) * 10);

  // Trajectory modifier
  if (trajectory === "WIDENING") score = Math.min(100, score + 5);
  else if (trajectory === "ERODING") score = Math.max(0, score - 8);

  score = Math.max(0, Math.min(100, score));

  let rating;
  if (score >= 75) rating = "WIDE_MOAT";
  else if (score >= 55) rating = "NARROW_MOAT";
  else if (score >= 35) rating = "FRAGILE_MOAT";
  else rating = "NO_MOAT";

  // Generate commentary
  const moatCommentary = (() => {
    const p = [];
    if (rating === "WIDE_MOAT") {
      p.push(`The company possesses a wide economic moat with strong competitive advantages that are likely to sustain above-average returns for the foreseeable future.`);
    } else if (rating === "NARROW_MOAT") {
      p.push(`A narrow moat exists — the company has identifiable competitive advantages, but they face moderate threats from competition and market dynamics.`);
    } else if (rating === "FRAGILE_MOAT") {
      p.push(`The competitive position is fragile with limited differentiation. The company must continuously invest to maintain its market standing.`);
    } else {
      p.push(`No meaningful economic moat was identified — the company operates in a highly competitive environment without significant barriers to entry.`);
    }
    if (trajectory === "WIDENING") p.push(`Encouragingly, the moat appears to be widening based on improving financial metrics.`);
    else if (trajectory === "NARROWING") p.push(`The moat shows signs of narrowing, with competitive advantages potentially eroding.`);
    return p.join(" ");
  })();

  return { score, rating, commentary: moatCommentary, moatTrajectory: trajectory, moatSources: sources, porterForces: porter };
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
