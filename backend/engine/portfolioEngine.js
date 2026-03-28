/**
 * Portfolio Analysis Engine
 *
 * Takes a list of holdings (each with a pre-fetched report) and computes:
 * - Portfolio health score (weighted CompanyIQ)
 * - Sector exposure breakdown
 * - Concentration risk (Herfindahl-Hirschman Index)
 * - Correlated red flags across holdings
 * - Diversification score
 * - Portfolio grade (A–F)
 */

/**
 * @param {Array<{ticker, shares, buyPrice, currentPrice, currentValue, report}>} holdings
 * @returns {object} Portfolio analysis result
 */
export function analyzePortfolio(holdings) {
  if (!holdings || holdings.length === 0) {
    return { error: true, message: "No holdings provided" };
  }

  // Compute current values and normalise weights
  const withValues = holdings.map((h) => ({
    ...h,
    currentValue: h.currentValue || h.currentPrice * h.shares || 0,
  }));

  const totalValue = withValues.reduce((s, h) => s + h.currentValue, 0);

  const weighted = withValues.map((h) => ({
    ...h,
    weight: totalValue > 0 ? (h.currentValue / totalValue) * 100 : 100 / holdings.length,
  }));

  const healthScore = computePortfolioHealthScore(weighted);
  const sectorExposure = computeSectorExposure(weighted);
  const concentration = computeConcentrationRisk(weighted);
  const correlatedFlags = findCorrelatedRedFlags(weighted);
  const diversification = computeDiversificationScore(weighted, sectorExposure, concentration);
  const topRisks = identifyTopRisks(weighted, correlatedFlags, concentration);
  const grade = gradePortfolio(healthScore, diversification, correlatedFlags);

  return {
    healthScore,
    grade,
    holdings: weighted.map((h) => ({
      ticker: h.ticker,
      name: h.report?.company?.name || h.ticker,
      sector: h.report?.company?.sector || "Unknown",
      weight: Math.round(h.weight * 10) / 10,
      companyIQ: h.report?.companyIQ ?? null,
      rating: h.report?.rating ?? null,
      ratingColor: h.report?.ratingColor ?? null,
      currentValue: h.currentValue,
      shares: h.shares,
      currentPrice: h.currentPrice,
      buyPrice: h.buyPrice,
      gainLossPct:
        h.buyPrice > 0
          ? Math.round(((h.currentPrice - h.buyPrice) / h.buyPrice) * 1000) / 10
          : null,
      redFlagCount: (h.report?.redFlags || []).length,
    })),
    sectorExposure,
    concentration,
    diversification,
    correlatedFlags,
    topRisks,
    totalValue,
    summary: buildPortfolioSummary(healthScore, grade, sectorExposure, concentration),
  };
}

// ─── Portfolio Health Score ──────────────────────────────────────────────

function computePortfolioHealthScore(holdings) {
  const withScores = holdings.filter(
    (h) => h.report && typeof h.report.companyIQ === "number"
  );

  if (withScores.length === 0) return null;

  const totalWeight = withScores.reduce((s, h) => s + h.weight, 0);
  const weightedSum = withScores.reduce(
    (s, h) => s + h.report.companyIQ * h.weight,
    0
  );

  const score = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);

  let rating, color;
  if (score >= 75) { rating = "STRONG"; color = "green"; }
  else if (score >= 55) { rating = "MODERATE"; color = "yellow"; }
  else if (score >= 35) { rating = "CAUTION"; color = "orange"; }
  else { rating = "WEAK"; color = "red"; }

  return {
    score,
    rating,
    color,
    coverageCount: withScores.length,
    totalCount: holdings.length,
  };
}

// ─── Sector Exposure ─────────────────────────────────────────────────────

function computeSectorExposure(holdings) {
  const map = {};

  for (const h of holdings) {
    const sector = h.report?.company?.sector || "Unknown";
    if (!map[sector]) {
      map[sector] = { weight: 0, companies: [], totalIQ: 0, iqCount: 0 };
    }
    map[sector].weight += h.weight;
    map[sector].companies.push(h.ticker);
    if (typeof h.report?.companyIQ === "number") {
      map[sector].totalIQ += h.report.companyIQ;
      map[sector].iqCount += 1;
    }
  }

  return Object.entries(map)
    .map(([sector, d]) => ({
      sector,
      weight: Math.round(d.weight * 10) / 10,
      companies: d.companies,
      avgIQ: d.iqCount > 0 ? Math.round(d.totalIQ / d.iqCount) : null,
      isConcentrated: d.weight > 40,
    }))
    .sort((a, b) => b.weight - a.weight);
}

// ─── Concentration Risk (HHI) ────────────────────────────────────────────

function computeConcentrationRisk(holdings) {
  // Herfindahl-Hirschman Index — sum of squares of % weights
  // >2500 = highly concentrated, 1500-2500 = moderate, <1500 = diversified
  const hhi = holdings.reduce((s, h) => s + Math.pow(h.weight, 2), 0);

  let level, color;
  if (hhi >= 2500) { level = "HIGH"; color = "red"; }
  else if (hhi >= 1500) { level = "MODERATE"; color = "yellow"; }
  else { level = "LOW"; color = "green"; }

  const sorted = [...holdings].sort((a, b) => b.weight - a.weight);
  const topHolding = sorted[0];
  const top5Weight = sorted.slice(0, 5).reduce((s, h) => s + h.weight, 0);

  return {
    hhi: Math.round(hhi),
    level,
    color,
    topHolding: {
      ticker: topHolding?.ticker,
      weight: Math.round((topHolding?.weight || 0) * 10) / 10,
    },
    top5Weight: Math.round(top5Weight * 10) / 10,
    stockCount: holdings.length,
  };
}

// ─── Correlated Red Flags ─────────────────────────────────────────────────

function findCorrelatedRedFlags(holdings) {
  const flagMap = {};

  for (const h of holdings) {
    const flags = h.report?.redFlags || [];
    for (const flag of flags) {
      // Group by category if available, else by first 60 chars of message
      const key = flag.category || (flag.message || "").substring(0, 60);
      if (!flagMap[key]) {
        flagMap[key] = {
          category: flag.category || key,
          severity: flag.severity,
          message: flag.message,
          affectedCompanies: [],
          totalWeight: 0,
        };
      }
      flagMap[key].affectedCompanies.push(h.ticker);
      flagMap[key].totalWeight += h.weight;
    }
  }

  // Only surface flags that affect multiple holdings (systemic risk)
  return Object.values(flagMap)
    .filter((f) => f.affectedCompanies.length >= 2)
    .sort((a, b) => b.totalWeight - a.totalWeight)
    .map((f) => ({
      ...f,
      totalWeight: Math.round(f.totalWeight * 10) / 10,
      isSystemic:
        f.affectedCompanies.length >= Math.ceil(holdings.length * 0.3),
    }));
}

// ─── Diversification Score ────────────────────────────────────────────────

function computeDiversificationScore(holdings, sectorExposure, concentration) {
  let score = 100;

  if (concentration.level === "HIGH") score -= 30;
  else if (concentration.level === "MODERATE") score -= 15;

  const maxSectorWeight = sectorExposure[0]?.weight || 0;
  if (maxSectorWeight > 60) score -= 25;
  else if (maxSectorWeight > 40) score -= 15;
  else if (maxSectorWeight > 30) score -= 5;

  if (holdings.length < 3) score -= 20;
  else if (holdings.length < 5) score -= 10;

  if (sectorExposure.length >= 5) score += 5;

  score = Math.max(0, Math.min(100, score));

  let level;
  if (score >= 75) level = "Well Diversified";
  else if (score >= 50) level = "Adequately Diversified";
  else if (score >= 25) level = "Moderately Concentrated";
  else level = "Highly Concentrated";

  return { score, level };
}

// ─── Top Risks ────────────────────────────────────────────────────────────

function identifyTopRisks(holdings, correlatedFlags, concentration) {
  const risks = [];

  if (concentration.level === "HIGH") {
    risks.push({
      type: "CONCENTRATION",
      severity: "HIGH",
      message: `${concentration.topHolding.ticker} holds ${concentration.topHolding.weight}% of portfolio — single-stock risk is elevated`,
    });
  }

  for (const flag of correlatedFlags.slice(0, 3)) {
    risks.push({
      type: "CORRELATED_FLAG",
      severity: flag.severity,
      message: `"${flag.message}" affects ${flag.affectedCompanies.join(", ")} (${flag.totalWeight}% of portfolio)`,
    });
  }

  const weakHoldings = holdings.filter(
    (h) => h.report?.rating === "WEAK" || h.report?.rating === "CRITICAL"
  );
  if (weakHoldings.length > 0) {
    risks.push({
      type: "WEAK_HOLDING",
      severity: weakHoldings.some((h) => h.report?.rating === "CRITICAL")
        ? "HIGH"
        : "WATCH",
      message: `${weakHoldings.map((h) => h.ticker).join(", ")} rated WEAK/CRITICAL — review these positions`,
    });
  }

  return risks.slice(0, 6);
}

// ─── Portfolio Grade ──────────────────────────────────────────────────────

function gradePortfolio(healthScore, diversification, correlatedFlags) {
  const hs = healthScore?.score || 50;
  const ds = diversification?.score || 50;
  const flagPenalty =
    correlatedFlags.filter((f) => f.severity === "CRITICAL").length * 10 +
    correlatedFlags.filter((f) => f.severity === "HIGH").length * 5;

  const composite = hs * 0.6 + ds * 0.4 - flagPenalty;

  if (composite >= 75) return { grade: "A", label: "Excellent Portfolio", color: "green" };
  if (composite >= 60) return { grade: "B", label: "Good Portfolio", color: "blue" };
  if (composite >= 45) return { grade: "C", label: "Average Portfolio", color: "yellow" };
  if (composite >= 30) return { grade: "D", label: "Below Average", color: "orange" };
  return { grade: "F", label: "Poor Portfolio", color: "red" };
}

// ─── Portfolio Summary ────────────────────────────────────────────────────

function buildPortfolioSummary(healthScore, grade, sectorExposure, concentration) {
  const parts = [];
  if (healthScore?.score != null) {
    parts.push(`Portfolio health: ${healthScore.score}/100 (${healthScore.rating})`);
  }
  if (grade) {
    parts.push(`Grade: ${grade.grade} — ${grade.label}`);
  }
  if (sectorExposure[0]) {
    parts.push(
      `Largest sector: ${sectorExposure[0].sector} at ${sectorExposure[0].weight}%`
    );
  }
  parts.push(`Concentration: ${concentration.level} (HHI: ${concentration.hhi})`);
  return parts.join(". ");
}
