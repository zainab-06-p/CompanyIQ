/**
 * Score Trend Tracker (Time-Series)
 *
 * Tracks CompanyIQ and pillar scores over time for each company.
 * Computes trend direction, linear slope, momentum, and alerts
 * when significant changes occur.
 *
 * Storage: In-memory cache with 180-day TTL (migrate to DB for persistence).
 */

import { getCache, setCache } from "../cache/cacheLayer.js";

const HISTORY_TTL = 180 * 24 * 3600; // 180 days

function getHistoryKey(ticker) {
  return `score_history:${ticker}`;
}

/**
 * Record a score snapshot for a company.
 *
 * @param {string} ticker
 * @param {object} scores - { companyIQ, financial, legal, sentiment, deepAnalysis }
 */
export function recordScoreSnapshot(ticker, scores) {
  if (!ticker) return;

  const key = getHistoryKey(ticker);
  const history = getCache(key) || [];

  history.push({
    ...scores,
    timestamp: new Date().toISOString(),
  });

  // Keep max 100 entries per company
  if (history.length > 100) history.splice(0, history.length - 100);

  setCache(key, history, HISTORY_TTL);
}

/**
 * Compute trend analysis for a company.
 *
 * @param {string} ticker
 * @param {object} currentScores - { companyIQ, financial, legal, sentiment, deepAnalysis }
 * @returns {{ hasHistory: boolean, dataPoints: number, trend: object, alerts: Array }}
 */
export function computeScoreTrend(ticker, currentScores) {
  const key = getHistoryKey(ticker);
  const history = getCache(key) || [];

  if (history.length < 2) {
    return {
      hasHistory: false,
      dataPoints: history.length,
      message: "Insufficient history for trend analysis. Trends populate after 2+ analyses.",
    };
  }

  // Compute trends per metric
  const metrics = ["companyIQ", "financial", "legal", "sentiment", "deepAnalysis"];
  const trends = {};

  for (const metric of metrics) {
    const values = history
      .map((h, i) => ({ x: i, y: h[metric] }))
      .filter(p => typeof p.y === "number");

    if (values.length < 2) {
      trends[metric] = { direction: "UNKNOWN", insufficient: true };
      continue;
    }

    // Linear regression: y = mx + b
    const n = values.length;
    const sumX = values.reduce((s, p) => s + p.x, 0);
    const sumY = values.reduce((s, p) => s + p.y, 0);
    const sumXY = values.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = values.reduce((s, p) => s + p.x * p.x, 0);

    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

    // Recent momentum: compare last entry vs 2nd to last
    const recent = values[values.length - 1].y;
    const previous = values[values.length - 2].y;
    const recentDelta = recent - previous;

    // Determine direction
    let direction;
    if (slope > 1.5) direction = "IMPROVING";
    else if (slope < -1.5) direction = "DECLINING";
    else direction = "STABLE";

    trends[metric] = {
      direction,
      slope: Math.round(slope * 100) / 100,
      recentDelta: Math.round(recentDelta * 10) / 10,
      current: currentScores[metric] ?? recent,
      min: Math.min(...values.map(v => v.y)),
      max: Math.max(...values.map(v => v.y)),
      avg: Math.round(values.reduce((s, v) => s + v.y, 0) / values.length),
      dataPoints: values.length,
    };
  }

  // Generate alerts
  const alerts = [];

  if (trends.companyIQ?.direction === "DECLINING" && (trends.companyIQ.slope || 0) < -3) {
    alerts.push({
      severity: "HIGH",
      message: `CompanyIQ in significant decline (slope: ${trends.companyIQ.slope}/analysis)`,
    });
  }

  if (trends.companyIQ?.recentDelta && trends.companyIQ.recentDelta <= -7) {
    alerts.push({
      severity: "HIGH",
      message: `CompanyIQ dropped ${Math.abs(trends.companyIQ.recentDelta)} points since last analysis`,
    });
  }

  if (trends.companyIQ?.direction === "IMPROVING" && (trends.companyIQ.slope || 0) > 3) {
    alerts.push({
      severity: "POSITIVE",
      message: `CompanyIQ showing strong improvement (slope: +${trends.companyIQ.slope}/analysis)`,
    });
  }

  // Streak detection: consecutive improvements or declines
  const iqHistory = history.map(h => h.companyIQ).filter(v => typeof v === "number");
  let streak = 0;
  let streakDir = null;
  for (let i = iqHistory.length - 1; i > 0; i--) {
    const delta = iqHistory[i] - iqHistory[i - 1];
    if (delta > 0) {
      if (streakDir === "up") streak++;
      else if (streakDir === null) { streakDir = "up"; streak = 1; }
      else break;
    } else if (delta < 0) {
      if (streakDir === "down") streak++;
      else if (streakDir === null) { streakDir = "down"; streak = 1; }
      else break;
    } else break;
  }

  if (streak >= 3) {
    alerts.push({
      severity: streakDir === "down" ? "WATCH" : "POSITIVE",
      message: `${streak} consecutive ${streakDir === "down" ? "declining" : "improving"} analyses`,
    });
  }

  return {
    hasHistory: true,
    dataPoints: history.length,
    trends,
    alerts,
    history: history.slice(-10).map(h => ({
      companyIQ: h.companyIQ,
      timestamp: h.timestamp,
    })),
  };
}

export default { recordScoreSnapshot, computeScoreTrend };
