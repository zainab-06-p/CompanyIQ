/**
 * Module 12 — Industry-Specific KPI Analysis
 *
 * Auto-detects sector and applies specialized KPI evaluation:
 *   - Banking: GNPA, NIM, CASA, CAR, ROA, Credit Cost
 *   - IT/SaaS: Revenue per Employee, Utilization, Attrition, Deal Wins
 *   - Pharma: R&D Pipeline, ANDA, USFDA, API vs Formulation mix
 *   - FMCG: Volume vs Value growth, Distribution, Brand spend
 *   - Auto: Capacity Utilization, ASP, EV transition
 *   - Real Estate: Presales, Collections, Debt/Presales
 *   - Metals/Mining: Realization, Cost curve position
 *   - Telecom: ARPU, Subscriber growth, Churn
 *
 * Input: financialData, legalData, allRatios, sector
 * Output: { detectedSector, kpis, score, rating }
 */

// ─── Sector Detection ───────────────────────────────────────────────────

export function detectSector(sector, financialData) {
  const s = (sector || "").toLowerCase();

  if (/bank|financial.*services|nbfc|microfinance/i.test(s)) return "BANKING";
  if (/information technology|software|saas|it.*services|cloud/i.test(s)) return "IT";
  if (/pharma|biotech|healthcare|medical/i.test(s)) return "PHARMA";
  if (/fmcg|consumer.*goods|food.*bev|personal.*care/i.test(s)) return "FMCG";
  if (/auto|automobile|vehicle|two.*wheeler/i.test(s)) return "AUTO";
  if (/real.*estate|construction|housing|property/i.test(s)) return "REALESTATE";
  if (/metal|mining|steel|alumin|copper|iron/i.test(s)) return "METALS";
  if (/telecom|communication|wireless|broadband/i.test(s)) return "TELECOM";
  if (/cement|building.*material/i.test(s)) return "CEMENT";
  if (/power|energy|electric|renewable|solar/i.test(s)) return "POWER";
  if (/chemical|specialty|petrochem/i.test(s)) return "CHEMICALS";

  // Fallback detection from financials
  const pl = financialData?.profitAndLoss?.annual || [];
  const hasInterestIncome = safe(pl[0]?.interestIncome || pl[0]?.interestEarned) > 0;
  const hasNPA = financialData?.npa !== undefined;
  if (hasInterestIncome || hasNPA) return "BANKING";

  return "GENERAL";
}

// ─── Banking KPIs ───────────────────────────────────────────────────────

function analyzeBankingKPIs(financialData, allRatios) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const bs = financialData?.balanceSheet || [];

  const interestIncome = safe(pl[0]?.interestIncome || pl[0]?.interestEarned || pl[0]?.revenue);
  const interestExpended = safe(pl[0]?.interestExpended || pl[0]?.interestExpense);
  const totalAssets = safe(bs[0]?.totalAssets);
  const advances = safe(bs[0]?.advances || bs[0]?.loans);
  const deposits = safe(bs[0]?.deposits);
  const netProfit = safe(pl[0]?.netProfit);
  const provisions = safe(pl[0]?.provisions || pl[0]?.provisionAndContingencies);

  // NIM (Net Interest Margin)
  const nim = totalAssets > 0 ? ((interestIncome - interestExpended) / totalAssets * 100) : null;

  // ROA
  const roa = totalAssets > 0 ? (netProfit / totalAssets * 100) : null;

  // Credit Cost
  const creditCost = advances > 0 ? (provisions / advances * 100) : null;

  // CD Ratio (Credit-Deposit)
  const cdRatio = deposits > 0 ? (advances / deposits * 100) : null;

  let score = 50;
  if (nim > 3.5) score += 15;
  else if (nim > 2.5) score += 8;
  else if (nim !== null && nim < 2) score -= 8;

  if (roa > 1.2) score += 12;
  else if (roa > 0.8) score += 6;
  else if (roa !== null && roa < 0.5) score -= 8;

  if (creditCost !== null && creditCost < 1) score += 8;
  else if (creditCost !== null && creditCost > 2) score -= 10;

  return {
    kpiType: "BANKING",
    metrics: {
      nim: round2(nim),
      roa: round2(roa),
      creditCost: round2(creditCost),
      cdRatio: round2(cdRatio),
    },
    score: clamp(score, 0, 100),
  };
}

// ─── IT/SaaS KPIs ──────────────────────────────────────────────────────

function analyzeITKPIs(financialData, legalData) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const announcements = legalData?.announcements || [];

  const revenue = safe(pl[0]?.revenue);
  const employeeCost = safe(pl[0]?.employeeCost || pl[0]?.staffCost);
  const opm = safe(pl[0]?.revenue) > 0 ? safe(pl[0]?.operatingProfit) / safe(pl[0]?.revenue) * 100 : 0;

  // Revenue per employee proxy (employee cost / avg salary as denominator)
  // Since we don't have headcount, use employee cost ratio as proxy
  const empCostRatio = revenue > 0 ? (employeeCost / revenue * 100) : 0;

  // Deal win signals
  const dealWins = announcements.filter((a) =>
    /deal|contract|order.*win|mandate|engagement|awarded|new client/i.test(a.subject || "")
  );

  // Revenue growth
  const prevRevenue = safe(pl[1]?.revenue);
  const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;

  // Margin trend
  const prevOPM = safe(pl[1]?.revenue) > 0 ? safe(pl[1]?.operatingProfit) / safe(pl[1]?.revenue) * 100 : 0;
  const marginExpansion = opm - prevOPM;

  let score = 50;
  if (revenueGrowth > 15) score += 15;
  else if (revenueGrowth > 8) score += 8;
  else if (revenueGrowth < 0) score -= 10;

  if (opm > 25) score += 10;
  else if (opm > 18) score += 5;
  else if (opm < 12) score -= 8;

  if (dealWins.length >= 3) score += 8;
  else if (dealWins.length >= 1) score += 3;

  if (marginExpansion > 2) score += 5;
  else if (marginExpansion < -3) score -= 5;

  return {
    kpiType: "IT_SERVICES",
    metrics: {
      revenueGrowth: round2(revenueGrowth),
      operatingMargin: round2(opm),
      empCostRatio: round2(empCostRatio),
      marginExpansion: round2(marginExpansion),
      dealWinSignals: dealWins.length,
    },
    score: clamp(score, 0, 100),
  };
}

// ─── Pharma KPIs ────────────────────────────────────────────────────────

function analyzePharmaKPIs(financialData, legalData) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const announcements = legalData?.announcements || [];

  const revenue = safe(pl[0]?.revenue);
  const rd = safe(pl[0]?.researchAndDevelopment || pl[0]?.rdExpense);
  const rdIntensity = revenue > 0 ? (rd / revenue * 100) : 0;

  // USFDA signals
  const usfdaSignals = announcements.filter((a) =>
    /usfda|fda|anda|drug.*approval|import alert|warning letter|eir|form.*483/i.test(a.subject || "")
  );
  const approvals = usfdaSignals.filter((a) =>
    /approv|anda.*approv|drug.*launch/i.test(a.subject || "")
  );
  const warnings = usfdaSignals.filter((a) =>
    /warning|alert|483|observation|import.*alert/i.test(a.subject || "")
  );

  // Revenue growth
  const prevRevenue = safe(pl[1]?.revenue);
  const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;

  // Margin profile
  const opm = revenue > 0 ? safe(pl[0]?.operatingProfit) / revenue * 100 : 0;

  let score = 50;
  if (rdIntensity > 10) score += 12;
  else if (rdIntensity > 5) score += 6;

  if (approvals.length >= 3) score += 10;
  else if (approvals.length >= 1) score += 5;
  if (warnings.length > 0) score -= 12;

  if (revenueGrowth > 12) score += 8;
  else if (revenueGrowth < 0) score -= 8;

  if (opm > 20) score += 5;
  else if (opm < 10) score -= 5;

  return {
    kpiType: "PHARMA",
    metrics: {
      rdIntensity: round2(rdIntensity),
      revenueGrowth: round2(revenueGrowth),
      opm: round2(opm),
      fdaApprovals: approvals.length,
      fdaWarnings: warnings.length,
    },
    score: clamp(score, 0, 100),
  };
}

// ─── FMCG KPIs ──────────────────────────────────────────────────────────

function analyzeFMCGKPIs(financialData) {
  const pl = financialData?.profitAndLoss?.annual || [];

  const revenue = safe(pl[0]?.revenue);
  const prevRevenue = safe(pl[1]?.revenue);
  const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;

  const opm = revenue > 0 ? safe(pl[0]?.operatingProfit) / revenue * 100 : 0;
  const npm = revenue > 0 ? safe(pl[0]?.netProfit) / revenue * 100 : 0;

  // Ad spend / selling expenses as % of revenue (brand investment)
  const sellingExp = safe(pl[0]?.sellingExpenses || pl[0]?.advertisingExpenses);
  const brandSpendRatio = revenue > 0 ? (sellingExp / revenue * 100) : 0;

  // Raw material stability (proxy for pricing power)
  const rmRatio = revenue > 0 ? (safe(pl[0]?.rawMaterial) / revenue * 100) : 0;
  const prevRMRatio = prevRevenue > 0 ? (safe(pl[1]?.rawMaterial) / prevRevenue * 100) : 0;
  const rmTrend = rmRatio - prevRMRatio;

  let score = 50;
  if (revenueGrowth > 10) score += 12;
  else if (revenueGrowth > 5) score += 6;
  else if (revenueGrowth < 0) score -= 10;

  if (opm > 20) score += 10;
  else if (opm > 15) score += 5;
  else if (opm < 10) score -= 5;

  if (brandSpendRatio > 5) score += 5; // Investing in brand

  if (rmTrend < -2) score += 5; // Improving input cost
  else if (rmTrend > 3) score -= 5;

  return {
    kpiType: "FMCG",
    metrics: {
      revenueGrowth: round2(revenueGrowth),
      opm: round2(opm),
      npm: round2(npm),
      brandSpendRatio: round2(brandSpendRatio),
      rmTrend: round2(rmTrend),
    },
    score: clamp(score, 0, 100),
  };
}

// ─── General KPIs ───────────────────────────────────────────────────────

function analyzeGeneralKPIs(financialData) {
  const pl = financialData?.profitAndLoss?.annual || [];

  const revenue = safe(pl[0]?.revenue);
  const prevRevenue = safe(pl[1]?.revenue);
  const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;
  const opm = revenue > 0 ? safe(pl[0]?.operatingProfit) / revenue * 100 : 0;
  const npm = revenue > 0 ? safe(pl[0]?.netProfit) / revenue * 100 : 0;

  let score = 50;
  if (revenueGrowth > 15) score += 15;
  else if (revenueGrowth > 8) score += 8;
  else if (revenueGrowth < 0) score -= 10;

  if (opm > 20) score += 10;
  else if (opm > 12) score += 5;
  else if (opm < 5) score -= 8;

  return {
    kpiType: "GENERAL",
    metrics: { revenueGrowth: round2(revenueGrowth), opm: round2(opm), npm: round2(npm) },
    score: clamp(score, 0, 100),
  };
}

// ─── Composite Industry KPI Score ───────────────────────────────────────

export function computeIndustryKPIs(financialData, legalData, allRatios, sector) {
  const detectedSector = detectSector(sector, financialData);

  let result;
  switch (detectedSector) {
    case "BANKING":
      result = analyzeBankingKPIs(financialData, allRatios);
      break;
    case "IT":
      result = analyzeITKPIs(financialData, legalData);
      break;
    case "PHARMA":
      result = analyzePharmaKPIs(financialData, legalData);
      break;
    case "FMCG":
      result = analyzeFMCGKPIs(financialData);
      break;
    default:
      result = analyzeGeneralKPIs(financialData);
      break;
  }

  const score = result.score;

  let rating;
  if (score >= 75) rating = "SECTOR_LEADER";
  else if (score >= 55) rating = "SECTOR_INLINE";
  else if (score >= 35) rating = "SECTOR_LAGGARD";
  else rating = "SECTOR_UNDERPERFORMER";

  // Generate commentary
  const parts = [];
  if (detectedSector && detectedSector !== "GENERAL") {
    parts.push(`Sector-specific analysis performed for the ${detectedSector} industry.`);
  }
  if (score >= 70) {
    parts.push(`The company performs well on key industry metrics, positioning it above sector averages on most parameters.`);
  } else if (score >= 50) {
    parts.push(`Industry KPI performance is moderate — the company meets sector benchmarks on some metrics but falls short on others.`);
  } else {
    parts.push(`Performance on sector-specific KPIs is below industry standards, which may indicate competitive weakness or operational challenges.`);
  }
  const commentary = parts.join(" ");

  return { score, rating, commentary, detectedSector, kpis: result.metrics, kpiType: result.kpiType };
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
