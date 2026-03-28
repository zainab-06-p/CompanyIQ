/**
 * Module 3 — Management Quality Deep Analysis
 *
 * Evaluates management quality through:
 *   - Related Party Transaction (RPT) detection & materiality
 *   - Promoter background risk signals
 *   - Management track record (guidance accuracy approximation)
 *   - Capital allocation history scoring
 *
 * Input: financialData, legalData, allRatios
 * Output: { rptAnalysis, promoterRisk, trackRecord, score, rating }
 */

// ─── Related Party Transaction Analysis ─────────────────────────────────

export function analyzeRPT(legalData, financialData) {
  const announcements = legalData?.announcements || [];
  const annual = financialData?.profitAndLoss?.annual || [];
  const revenue = safe(annual[0]?.revenue);

  // Detect RPT-related announcements
  const rptAnnouncements = announcements.filter((a) => {
    const text = ((a.subject || "") + " " + (a.category || "")).toLowerCase();
    return text.includes("related party") || text.includes("rpt")
      || text.includes("arm's length") || text.includes("material transaction")
      || text.includes("inter-corporate") || text.includes("loan to subsidiary")
      || text.includes("corporate guarantee");
  });

  // Classify RPT types
  const rptTypes = {
    loans: 0,
    guarantees: 0,
    sales: 0,
    purchases: 0,
    rent: 0,
    management_fees: 0,
    other: 0,
  };

  for (const a of rptAnnouncements) {
    const text = ((a.subject || "") + " " + (a.category || "")).toLowerCase();
    if (text.includes("loan") || text.includes("lend")) rptTypes.loans++;
    else if (text.includes("guarantee")) rptTypes.guarantees++;
    else if (text.includes("sale") || text.includes("sell")) rptTypes.sales++;
    else if (text.includes("purchase") || text.includes("buy")) rptTypes.purchases++;
    else if (text.includes("rent") || text.includes("lease")) rptTypes.rent++;
    else if (text.includes("management fee") || text.includes("consulting")) rptTypes.management_fees++;
    else rptTypes.other++;
  }

  const totalRPTs = rptAnnouncements.length;

  // Estimate materiality based on count (proxy when amount unavailable)
  let materialityRating;
  if (totalRPTs === 0) materialityRating = "NONE_DETECTED";
  else if (totalRPTs <= 2) materialityRating = "LOW";
  else if (totalRPTs <= 5) materialityRating = "MODERATE";
  else if (totalRPTs <= 10) materialityRating = "MATERIAL";
  else materialityRating = "HIGH_RISK";

  // Red flags: loans + guarantees are the most concerning
  const tunnelingRisk = rptTypes.loans + rptTypes.guarantees;

  let tunnelingRating;
  if (tunnelingRisk === 0) tunnelingRating = "CLEAN";
  else if (tunnelingRisk <= 2) tunnelingRating = "WATCH";
  else tunnelingRating = "RED_FLAG";

  return {
    totalRPTs,
    rptTypes,
    materialityRating,
    tunnelingRisk,
    tunnelingRating,
    announcements: rptAnnouncements.slice(0, 10).map((a) => ({
      date: a.date, subject: a.subject, category: a.category,
    })),
  };
}

// ─── Promoter Risk Assessment ───────────────────────────────────────────

export function analyzePromoterRisk(legalData) {
  const shareholding = legalData?.shareholding || {};
  const announcements = legalData?.announcements || [];
  const directors = legalData?.directors || [];

  const risks = [];

  // Promoter holding level
  const promoterHolding = safe(shareholding.promoterHolding || shareholding.promoter);
  if (promoterHolding > 0) {
    if (promoterHolding < 30) {
      risks.push({ signal: "LOW_PROMOTER_HOLDING", severity: "HIGH", value: promoterHolding,
        message: `Promoter holding only ${promoterHolding}% — weak conviction or over-dilution` });
    } else if (promoterHolding < 40) {
      risks.push({ signal: "MODERATE_PROMOTER_HOLDING", severity: "WATCH", value: promoterHolding,
        message: `Promoter holding ${promoterHolding}% — moderate, watch for further decline` });
    }
  }

  // Pledge level
  const pledging = safe(shareholding.pledgePercent || shareholding.pledge);
  if (pledging > 50) {
    risks.push({ signal: "EXTREME_PLEDGING", severity: "CRITICAL", value: pledging,
      message: `${pledging}% shares pledged — extreme financial stress signal` });
  } else if (pledging > 30) {
    risks.push({ signal: "HIGH_PLEDGING", severity: "HIGH", value: pledging,
      message: `${pledging}% shares pledged — significant promoter leverage` });
  } else if (pledging > 10) {
    risks.push({ signal: "MODERATE_PLEDGING", severity: "WATCH", value: pledging,
      message: `${pledging}% shares pledged — monitor closely` });
  }

  // Director changes
  const directorChanges = announcements.filter((a) => {
    const text = ((a.subject || "") + " " + (a.category || "")).toLowerCase();
    return text.includes("director") && (text.includes("resign") || text.includes("cessation") || text.includes("change"));
  });

  if (directorChanges.length >= 4) {
    risks.push({ signal: "MASS_DIRECTOR_EXITS", severity: "CRITICAL", value: directorChanges.length,
      message: `${directorChanges.length} director changes — possible governance crisis` });
  } else if (directorChanges.length >= 2) {
    risks.push({ signal: "DIRECTOR_TURNOVER", severity: "WATCH", value: directorChanges.length,
      message: `${directorChanges.length} director changes in recent period` });
  }

  // Auditor changes
  const auditorChanges = announcements.filter((a) => {
    const text = ((a.subject || "") + " " + (a.category || "")).toLowerCase();
    return text.includes("auditor") && (text.includes("resign") || text.includes("change") || text.includes("cessation"));
  });

  if (auditorChanges.length > 0) {
    risks.push({ signal: "AUDITOR_CHANGE", severity: "HIGH", value: auditorChanges.length,
      message: "Auditor resignation/change detected — investigate reason" });
  }

  // Overall risk
  const criticalCount = risks.filter((r) => r.severity === "CRITICAL").length;
  const highCount = risks.filter((r) => r.severity === "HIGH").length;

  let overallRisk;
  if (criticalCount > 0) overallRisk = "CRITICAL";
  else if (highCount > 0) overallRisk = "HIGH";
  else if (risks.length > 0) overallRisk = "MODERATE";
  else overallRisk = "LOW";

  return { risks, overallRisk, promoterHolding, pledging };
}

// ─── Management Track Record ────────────────────────────────────────────

export function analyzeTrackRecord(financialData, allRatios) {
  const pl = financialData?.profitAndLoss || {};
  const annual = pl.annual || [];
  const bs = financialData?.balanceSheet || [];

  // Revenue trajectory consistency (proxy for execution quality)
  const revenues = annual.map((y) => safe(y.revenue)).filter((v) => v > 0);
  const profits = annual.map((y) => safe(y.netProfit));

  let revenueConsistency = 0;
  let profitConsistency = 0;
  for (let i = 0; i < revenues.length - 1; i++) {
    if (revenues[i] >= revenues[i + 1]) revenueConsistency++;
    if (profits[i] >= profits[i + 1]) profitConsistency++;
  }

  const totalPeriods = Math.max(revenues.length - 1, 1);
  const revenueGrowthRate = revenueConsistency / totalPeriods;
  const profitGrowthRate = profitConsistency / totalPeriods;

  // Margin stability (good management maintains margins)
  const margins = annual.map((y) => safe(y.revenue) > 0 ? safe(y.netProfit) / safe(y.revenue) : 0);
  const marginVolatility = computeStdDev(margins);

  let executionRating;
  if (revenueGrowthRate >= 0.8 && profitGrowthRate >= 0.6) executionRating = "EXCELLENT";
  else if (revenueGrowthRate >= 0.6 && profitGrowthRate >= 0.4) executionRating = "GOOD";
  else if (revenueGrowthRate >= 0.4) executionRating = "FAIR";
  else executionRating = "POOR";

  // Capital allocation quality from historical ROE trend
  const roeValues = [];
  for (let i = 0; i < Math.min(annual.length, bs.length); i++) {
    const eq = safe(bs[i]?.shareCapital) + safe(bs[i]?.reserves);
    if (eq > 0) roeValues.push(safe(annual[i]?.netProfit) / eq * 100);
  }

  const roeStability = roeValues.length >= 2 ? computeStdDev(roeValues) : null;
  let capitalScore;
  if (roeStability === null) capitalScore = 5;
  else if (roeStability < 3) capitalScore = 9;
  else if (roeStability < 8) capitalScore = 7;
  else if (roeStability < 15) capitalScore = 5;
  else capitalScore = 3;

  return {
    revenueGrowthConsistency: round2(revenueGrowthRate * 100),
    profitGrowthConsistency: round2(profitGrowthRate * 100),
    marginVolatility: round4(marginVolatility),
    executionRating,
    capitalAllocationScore: capitalScore,
    roeStability: round2(roeStability),
  };
}

// ─── Composite Management Quality Score ─────────────────────────────────

export function computeManagementQuality(financialData, legalData, allRatios) {
  const rptAnalysis = analyzeRPT(legalData, financialData);
  const promoterRisk = analyzePromoterRisk(legalData);
  const trackRecord = analyzeTrackRecord(financialData, allRatios);

  let score = 50;

  // Track record (40% weight)
  if (trackRecord.executionRating === "EXCELLENT") score += 20;
  else if (trackRecord.executionRating === "GOOD") score += 10;
  else if (trackRecord.executionRating === "FAIR") score += 0;
  else score -= 15;

  // Promoter risk (30% weight)
  if (promoterRisk.overallRisk === "LOW") score += 15;
  else if (promoterRisk.overallRisk === "MODERATE") score += 0;
  else if (promoterRisk.overallRisk === "HIGH") score -= 12;
  else score -= 20; // CRITICAL

  // RPT risk (20% weight)
  if (rptAnalysis.materialityRating === "NONE_DETECTED") score += 10;
  else if (rptAnalysis.materialityRating === "LOW") score += 5;
  else if (rptAnalysis.materialityRating === "MATERIAL") score -= 5;
  else if (rptAnalysis.materialityRating === "HIGH_RISK") score -= 10;

  // Capital allocation history (10% weight)
  score += (trackRecord.capitalAllocationScore - 5) * 2;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let rating;
  if (score >= 75) rating = "HIGH_QUALITY";
  else if (score >= 55) rating = "ADEQUATE";
  else if (score >= 35) rating = "BELOW_AVERAGE";
  else rating = "POOR";

  return { score, rating, commentary: generateMgmtCommentary(score, rating, rptAnalysis, promoterRisk, trackRecord), rptAnalysis, promoterRisk, trackRecord };
}

function generateMgmtCommentary(score, rating, rpt, promoter, track) {
  const parts = [];
  if (promoter.overallRisk === "LOW") {
    parts.push(`Promoter risk is low — stable holding pattern with clean governance signals suggest aligned management interests.`);
  } else if (promoter.overallRisk === "HIGH") {
    parts.push(`Promoter risk is elevated due to declining holdings or pledging activity, which may indicate reduced confidence or financial stress.`);
  }
  if (track.marginStability === "STABLE" || track.marginStability === "IMPROVING") {
    parts.push(`Management has demonstrated consistent execution with ${track.marginStability.toLowerCase()} operating margins, indicating disciplined cost control.`);
  } else if (track.marginStability === "VOLATILE") {
    parts.push(`Operating margins show volatility, suggesting the management may be facing challenges in maintaining consistent profitability.`);
  }
  if (score >= 70) {
    parts.push(`Overall, management quality is strong and supports long-term investment confidence.`);
  } else if (score < 40) {
    parts.push(`Management quality flags suggest caution — investors should closely monitor governance developments.`);
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

function computeStdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}
