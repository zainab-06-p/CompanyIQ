/**
 * Module 11 — Insider & Institutional Tracking
 *
 * Evaluates insider activity and institutional quality:
 *   - Insider transaction signals (buy/sell ratios)
 *   - Cluster buy/sell detection
 *   - Institutional holder quality (FII, DII, MF)
 *   - Promoter pledge tracking
 *   - F&O Put-Call Ratio sentiment (proxy from data available)
 *
 * Input: legalData, financialData
 * Output: { insiderActivity, institutionalQuality, pledgeAnalysis, score, rating }
 */

// ─── Insider Activity Analysis ──────────────────────────────────────────

export function analyzeInsiderActivity(legalData) {
  const announcements = legalData?.announcements || [];

  // Detect insider transaction announcements
  const insiderAnnouncements = announcements.filter((a) => {
    const text = (a.subject || "").toLowerCase();
    return text.includes("insider") || text.includes("sast") ||
      text.includes("promoter.*acqui") || text.includes("promoter.*sell") ||
      text.includes("buyback") || text.includes("acquisition of shares") ||
      text.includes("change in shareholding") || text.includes("substantial acquisition");
  });

  const buySignals = insiderAnnouncements.filter((a) =>
    /buy|acqui|purchase|allot|increase/i.test(a.subject || "")
  );
  const sellSignals = insiderAnnouncements.filter((a) =>
    /sell|dispose|disinvest|decrease|offload/i.test(a.subject || "")
  );

  const netSignal = buySignals.length - sellSignals.length;

  let sentiment;
  if (netSignal > 2) sentiment = "STRONG_BUY";
  else if (netSignal > 0) sentiment = "MILD_BUY";
  else if (netSignal === 0) sentiment = "NEUTRAL";
  else if (netSignal > -2) sentiment = "MILD_SELL";
  else sentiment = "STRONG_SELL";

  // Cluster detection: multiple insiders acting in same direction
  const isCluster = buySignals.length >= 3 || sellSignals.length >= 3;
  let clusterType = null;
  if (buySignals.length >= 3) clusterType = "CLUSTER_BUY";
  else if (sellSignals.length >= 3) clusterType = "CLUSTER_SELL";

  let score;
  if (sentiment === "STRONG_BUY") score = 85;
  else if (sentiment === "MILD_BUY") score = 65;
  else if (sentiment === "NEUTRAL") score = 50;
  else if (sentiment === "MILD_SELL") score = 35;
  else score = 20;

  if (isCluster && clusterType === "CLUSTER_BUY") score += 10;
  else if (isCluster && clusterType === "CLUSTER_SELL") score -= 10;

  return {
    score: clamp(score, 0, 100),
    totalInsiderEvents: insiderAnnouncements.length,
    buySignals: buySignals.length,
    sellSignals: sellSignals.length,
    netSignal,
    sentiment,
    isCluster,
    clusterType,
  };
}

// ─── Institutional Quality ──────────────────────────────────────────────

export function assessInstitutionalQuality(legalData) {
  const shareholding = legalData?.shareholding || {};

  const fii = safe(shareholding.fii || shareholding.fpiHolding);
  const dii = safe(shareholding.dii || shareholding.diiHolding);
  const mf = safe(shareholding.mutualFundHolding || shareholding.mf);
  const insurance = safe(shareholding.insuranceHolding || shareholding.insurance);

  const totalInstitutional = fii + dii;

  let score = 40;

  // FII presence — global quality validation
  if (fii >= 25) score += 25;
  else if (fii >= 15) score += 18;
  else if (fii >= 8) score += 10;
  else if (fii >= 3) score += 5;

  // DII domestic confidence
  if (dii >= 20) score += 15;
  else if (dii >= 10) score += 10;
  else if (dii >= 5) score += 5;

  // Mutual fund holding — higher = strong domestic conviction
  if (mf >= 15) score += 8;
  else if (mf >= 8) score += 4;

  // Insurance holding — long-term patient capital
  if (insurance >= 5) score += 5;

  let qualityTier;
  if (score >= 75) qualityTier = "BLUE_CHIP";
  else if (score >= 55) qualityTier = "INSTITUTIONAL_QUALITY";
  else if (score >= 35) qualityTier = "MIXED";
  else qualityTier = "RETAIL_DOMINATED";

  return {
    score: clamp(score, 0, 100),
    fii,
    dii,
    mf,
    insurance,
    totalInstitutional,
    qualityTier,
  };
}

// ─── Promoter Pledge Analysis ───────────────────────────────────────────

export function analyzePledgeRisk(legalData) {
  const shareholding = legalData?.shareholding || {};
  const quarterly = shareholding.quarterly || shareholding.trend || [];

  const pledgePercent = safe(shareholding.pledgePercent || shareholding.pledge);
  const promoter = safe(shareholding.promoterHolding || shareholding.promoter);

  // Pledge as % of promoter holding
  const pledgeToPromoter = promoter > 0 ? (pledgePercent / promoter * 100) : 0;

  // Pledge trend (quarterly)
  let pledgeTrend = "STABLE";
  if (quarterly.length >= 2) {
    const currentPledge = safe(quarterly[0]?.pledge);
    const prevPledge = safe(quarterly[1]?.pledge);
    if (currentPledge > prevPledge + 1) pledgeTrend = "INCREASING";
    else if (currentPledge < prevPledge - 1) pledgeTrend = "DECREASING";
  }

  let riskLevel;
  if (pledgePercent > 50) riskLevel = "CRITICAL";
  else if (pledgePercent > 30) riskLevel = "HIGH";
  else if (pledgePercent > 10) riskLevel = "MODERATE";
  else if (pledgePercent > 0) riskLevel = "LOW";
  else riskLevel = "NONE";

  let score;
  if (riskLevel === "NONE") score = 90;
  else if (riskLevel === "LOW") score = 70;
  else if (riskLevel === "MODERATE") score = 45;
  else if (riskLevel === "HIGH") score = 25;
  else score = 10; // CRITICAL

  // Trend modifier
  if (pledgeTrend === "DECREASING") score += 8;
  else if (pledgeTrend === "INCREASING") score -= 10;

  return {
    score: clamp(score, 0, 100),
    pledgePercent,
    pledgeToPromoter: round2(pledgeToPromoter),
    pledgeTrend,
    riskLevel,
  };
}

// ─── F&O Sentiment Proxy ────────────────────────────────────────────────

export function estimateFOSentiment(legalData) {
  // Without realtime F&O data, use announcement/activity based proxy
  const announcements = legalData?.announcements || [];

  const foRelated = announcements.filter((a) =>
    /derivative|futures|options|f&o|put.*call|margin|open interest/i.test(a.subject || "")
  );

  // Use bulk deal patterns as F&O proxy sentiment
  const bulkBuys = announcements.filter((a) =>
    /bulk deal.*buy|block deal.*buy|large.*acquisition/i.test(a.subject || "")
  ).length;
  const bulkSells = announcements.filter((a) =>
    /bulk deal.*sell|block deal.*sell|large.*disposal/i.test(a.subject || "")
  ).length;

  let sentiment;
  if (bulkBuys > bulkSells + 1) sentiment = "BULLISH";
  else if (bulkSells > bulkBuys + 1) sentiment = "BEARISH";
  else sentiment = "NEUTRAL";

  return {
    foSignals: foRelated.length,
    bulkBuys,
    bulkSells,
    sentiment,
    confidence: foRelated.length > 0 ? "DATA_AVAILABLE" : "LIMITED_DATA",
  };
}

// ─── Composite Insider Tracking Score ───────────────────────────────────

export function computeInsiderTracking(legalData, financialData) {
  const insiderActivity = analyzeInsiderActivity(legalData);
  const institutionalQuality = assessInstitutionalQuality(legalData);
  const pledgeAnalysis = analyzePledgeRisk(legalData);
  const foSentiment = estimateFOSentiment(legalData);

  // Weighted composite
  const score = Math.round(
    insiderActivity.score * 0.30 +
    institutionalQuality.score * 0.30 +
    pledgeAnalysis.score * 0.25 +
    (foSentiment.sentiment === "BULLISH" ? 70
      : foSentiment.sentiment === "NEUTRAL" ? 50 : 30) * 0.15
  );

  let rating;
  if (score >= 70) rating = "SMART_MONEY_POSITIVE";
  else if (score >= 50) rating = "INSTITUTIONAL_NEUTRAL";
  else if (score >= 35) rating = "CAUTION";
  else rating = "SMART_MONEY_EXIT";

  // Generate commentary
  const parts = [];
  if (insiderActivity.sentiment === "STRONG_BUY" || insiderActivity.sentiment === "MILD_BUY") {
    parts.push(`Insider activity is positive with net buying signals, suggesting management confidence in the company's outlook.`);
  } else if (insiderActivity.sentiment === "STRONG_SELL" || insiderActivity.sentiment === "MILD_SELL") {
    parts.push(`Net insider selling activity detected, which may indicate reduced management confidence or profit-taking.`);
  }
  if (pledgeAnalysis.riskLevel === "NONE") {
    parts.push(`Zero pledging of promoter shares indicates clean governance with no forced-selling risk.`);
  } else if (pledgeAnalysis.riskLevel === "HIGH" || pledgeAnalysis.riskLevel === "CRITICAL") {
    parts.push(`High promoter pledging at ${pledgeAnalysis.pledgePercent}% creates significant risk of forced selling in a market downturn.`);
  }
  if (institutionalQuality.qualityTier === "BLUE_CHIP") {
    parts.push(`Strong institutional ownership validates the company's quality and provides a stable shareholder base.`);
  }
  const commentary = parts.join(" ");

  return {
    score: clamp(score, 0, 100),
    rating,
    commentary,
    insiderActivity,
    institutionalQuality,
    pledgeAnalysis,
    foSentiment,
  };
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
