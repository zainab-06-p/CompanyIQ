/**
 * Module 6 — Shareholding Pattern Analysis
 *
 * Evaluates ownership quality and momentum:
 *   - Ownership structure (Promoter, FII, DII, Public)
 *   - QoQ velocity (change trends)
 *   - Concentration risk (HHI index)
 *   - Institutional quality signals
 *   - Bulk/Block deal detection
 *
 * Input: legalData
 * Output: { ownership, velocity, concentration, institutionalQuality, score, rating }
 */

// ─── Ownership Structure Analysis ───────────────────────────────────────

export function analyzeOwnership(shareholding) {
  if (!shareholding || typeof shareholding !== "object") {
    return { score: 50, structure: {}, quality: "UNKNOWN" };
  }

  const promoter = safe(shareholding.promoterHolding || shareholding.promoter);
  const fii = safe(shareholding.fii || shareholding.fpiHolding);
  const dii = safe(shareholding.dii || shareholding.diiHolding || shareholding.mutualFundHolding);
  const publicHolding = safe(shareholding.publicHolding || shareholding.public);

  let score = 50;

  // Promoter level
  if (promoter >= 50 && promoter <= 75) score += 15;
  else if (promoter >= 40) score += 8;
  else if (promoter >= 30) score += 2;
  else if (promoter < 25 && promoter > 0) score -= 10;

  // Institutional backing (FII + DII)
  const institutionalTotal = fii + dii;
  if (institutionalTotal >= 30) score += 12;
  else if (institutionalTotal >= 15) score += 6;
  else if (institutionalTotal < 5 && institutionalTotal > 0) score -= 5;

  // FII presence (global quality mark)
  if (fii >= 20) score += 5;
  else if (fii >= 10) score += 2;

  // DII presence (domestic confidence)
  if (dii >= 15) score += 3;

  let quality;
  if (score >= 70) quality = "STRONG";
  else if (score >= 55) quality = "ADEQUATE";
  else if (score >= 40) quality = "WEAK";
  else quality = "POOR";

  return {
    score: clamp(score, 0, 100),
    structure: { promoter, fii, dii, publicHolding, institutionalTotal },
    quality,
  };
}

// ─── Shareholding Velocity (QoQ Changes) ────────────────────────────────

export function analyzeVelocity(shareholding) {
  const quarterly = shareholding?.quarterly || shareholding?.trend || [];

  if (!Array.isArray(quarterly) || quarterly.length < 2) {
    return { score: 50, promoterTrend: "STABLE", fiiTrend: "STABLE", signals: [] };
  }

  const signals = [];
  const latest = quarterly[0];
  const previous = quarterly[1];
  const older = quarterly[2] || quarterly[1];

  const promoterChange = safe(latest.promoter) - safe(previous.promoter);
  const fiiChange = safe(latest.fii) - safe(previous.fii);
  const diiChange = safe(latest.dii) - safe(previous.dii);

  let score = 50;

  // Promoter velocity
  let promoterTrend = "STABLE";
  if (promoterChange > 2) {
    promoterTrend = "INCREASING";
    score += 8;
    signals.push({ type: "PROMOTER_BUYING", severity: "POSITIVE", change: promoterChange });
  } else if (promoterChange < -2) {
    promoterTrend = "DECREASING";
    score -= 10;
    signals.push({ type: "PROMOTER_SELLING", severity: "HIGH", change: promoterChange });
  }

  // Multi-quarter promoter decline (dangerous pattern)
  if (quarterly.length >= 3) {
    const prevChange = safe(previous.promoter) - safe(older.promoter);
    if (promoterChange < -1 && prevChange < -1) {
      signals.push({ type: "SUSTAINED_PROMOTER_DECLINE", severity: "CRITICAL" });
      score -= 12;
    }
  }

  // FII velocity
  let fiiTrend = "STABLE";
  if (fiiChange > 2) {
    fiiTrend = "INCREASING";
    score += 6;
    signals.push({ type: "FII_ACCUMULATION", severity: "POSITIVE", change: fiiChange });
  } else if (fiiChange < -2) {
    fiiTrend = "DECREASING";
    score -= 6;
    signals.push({ type: "FII_EXIT", severity: "WATCH", change: fiiChange });
  }

  // DII velocity
  if (diiChange > 3) {
    score += 4;
    signals.push({ type: "DII_ACCUMULATION", severity: "POSITIVE", change: diiChange });
  } else if (diiChange < -3) {
    score -= 3;
    signals.push({ type: "DII_REDUCTION", severity: "WATCH", change: diiChange });
  }

  return { score: clamp(score, 0, 100), promoterTrend, fiiTrend, signals };
}

// ─── Concentration Risk (HHI) ───────────────────────────────────────────

export function analyzeConcentration(shareholding) {
  const promoter = safe(shareholding?.promoterHolding || shareholding?.promoter);
  const fii = safe(shareholding?.fii || shareholding?.fpiHolding);
  const dii = safe(shareholding?.dii || shareholding?.diiHolding);
  const publicH = safe(shareholding?.publicHolding || shareholding?.public);

  // Herfindahl-Hirschman Index (normalized)
  const total = promoter + fii + dii + publicH;
  if (total === 0) return { hhi: 0, rating: "UNKNOWN" };

  const shares = [promoter, fii, dii, publicH].map((x) => (x / total) * 100);
  const hhi = shares.reduce((sum, s) => sum + s * s, 0);

  let rating;
  if (hhi > 6000) rating = "HIGHLY_CONCENTRATED";
  else if (hhi > 3500) rating = "CONCENTRATED";
  else if (hhi > 2000) rating = "MODERATE";
  else rating = "DIVERSIFIED";

  return { hhi: Math.round(hhi), rating };
}

// ─── Bulk/Block Deal Detection ──────────────────────────────────────────

export function detectBulkDeals(legalData) {
  const announcements = legalData?.announcements || [];

  const bulkDeals = announcements.filter((a) =>
    /bulk deal|block deal|large acquisition|open market|substantial acquisition/i.test(a.subject || "")
  );

  const buyDeals = bulkDeals.filter((a) =>
    /buy|acquire|purchase|accumulation/i.test(a.subject || "")
  );
  const sellDeals = bulkDeals.filter((a) =>
    /sell|disp|offload|exit/i.test(a.subject || "")
  );

  let signal;
  if (buyDeals.length > sellDeals.length) signal = "NET_BUYING";
  else if (sellDeals.length > buyDeals.length) signal = "NET_SELLING";
  else signal = "NEUTRAL";

  return { totalDeals: bulkDeals.length, buyDeals: buyDeals.length, sellDeals: sellDeals.length, signal };
}

// ─── Composite Shareholding Score ───────────────────────────────────────

export function computeShareholdingAnalysis(legalData) {
  const rawShareholding = legalData?.shareholding;

  // Guard: empty array or missing data means the agent didn't fetch shareholding.
  // Return null score so the composite scorer treats it as unavailable data, not zero.
  const isMissing = !rawShareholding ||
    (Array.isArray(rawShareholding) && rawShareholding.length === 0);
  if (isMissing) {
    return { score: null, rating: 'INSUFFICIENT_DATA', ownership: null, velocity: null, concentration: null, bulkDeals: null };
  }

  const shareholding = rawShareholding;

  const ownership = analyzeOwnership(shareholding);
  const velocity = analyzeVelocity(shareholding);
  const concentration = analyzeConcentration(shareholding);
  const bulkDeals = detectBulkDeals(legalData);

  // Weighted composite: ownership 35%, velocity 35%, concentration 15%, deals 15%
  let score = Math.round(
    ownership.score * 0.35 +
    velocity.score * 0.35 +
    (concentration.rating === "DIVERSIFIED" ? 70
      : concentration.rating === "MODERATE" ? 55
      : concentration.rating === "CONCENTRATED" ? 35 : 20) * 0.15 +
    (bulkDeals.signal === "NET_BUYING" ? 70
      : bulkDeals.signal === "NEUTRAL" ? 50 : 30) * 0.15
  );

  score = clamp(score, 0, 100);

  let rating;
  if (score >= 70) rating = "STRONG_OWNERSHIP";
  else if (score >= 50) rating = "ACCEPTABLE";
  else if (score >= 35) rating = "WEAK_OWNERSHIP";
  else rating = "RED_FLAG";

  // Generate commentary
  const parts = [];
  if (ownership?.structure?.promoter > 50) {
    parts.push(`Promoter holding at ${ownership.structure.promoter}% demonstrates strong insider conviction and alignment with minority shareholders.`);
  } else if (ownership?.structure?.promoter > 30) {
    parts.push(`Promoter holding at ${ownership.structure.promoter}% is adequate but investors should monitor for any declining trend.`);
  } else if (ownership?.structure?.promoter > 0) {
    parts.push(`Relatively low promoter holding at ${ownership.structure.promoter}% may indicate reduced skin-in-the-game.`);
  }
  if (velocity?.promoterTrend === "INCREASING") {
    parts.push(`Promoters have been increasing their stake, signaling confidence in the company's future prospects.`);
  } else if (velocity?.promoterTrend === "DECREASING") {
    parts.push(`Promoter stake is declining, which warrants monitoring for potential concerns about company direction.`);
  }
  if (concentration?.hhi > 5000) {
    parts.push(`Ownership is highly concentrated, which can be positive for decisive management but limits free float.`);
  }
  const commentary = parts.join(" ");

  return { score, rating, commentary, ownership, velocity, concentration, bulkDeals };
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
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
