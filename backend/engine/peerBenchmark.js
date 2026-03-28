/**
 * Peer Benchmark Engine
 *
 * Compares a company's scores against sector peers.
 * Stores scores in cache as they're computed, building up a peer
 * database over time. Returns percentile rank, sector average,
 * and best-in-class within the sector.
 */

import { getCache, setCache } from "../cache/cacheLayer.js";

const SECTOR_CACHE_KEY = "peer_scores";
const CACHE_TTL = 90 * 24 * 3600; // 90 days

/**
 * Get or initialize the peer score store.
 */
function getPeerStore() {
  return getCache(SECTOR_CACHE_KEY) || {};
}

/**
 * Record a company's scores into the peer store for future comparisons.
 *
 * @param {string} ticker
 * @param {string} sector
 * @param {object} scores - { companyIQ, financial, legal, sentiment, deepAnalysis }
 */
export function recordPeerScore(ticker, sector, scores) {
  if (!ticker || !sector) return;

  const store = getPeerStore();
  if (!store[sector]) store[sector] = {};

  store[sector][ticker] = {
    ...scores,
    updatedAt: new Date().toISOString(),
  };

  setCache(SECTOR_CACHE_KEY, store, CACHE_TTL);
}

/**
 * Compute peer benchmark for a company within its sector.
 *
 * @param {string} ticker
 * @param {string} sector
 * @param {object} currentScores - { companyIQ, financial, legal, sentiment, deepAnalysis }
 * @returns {{ hasPeers: boolean, peerCount: number, metrics: object, percentileRank: number, sectorAvg: number, bestInClass: object }}
 */
export function computePeerBenchmark(ticker, sector, currentScores) {
  const store = getPeerStore();
  const sectorPeers = store[sector] || {};

  // Filter out the current company and collect peer scores
  const peerEntries = Object.entries(sectorPeers)
    .filter(([t]) => t !== ticker)
    .map(([t, s]) => ({ ticker: t, ...s }));

  if (peerEntries.length === 0) {
    return {
      hasPeers: false,
      peerCount: 0,
      message: "No peers analyzed yet in this sector. Scores accumulate as more companies are analyzed.",
    };
  }

  // Compute percentile rank for CompanyIQ
  const peerIQs = peerEntries.map(p => p.companyIQ).filter(v => typeof v === "number");
  const allIQs = [...peerIQs, currentScores.companyIQ].sort((a, b) => a - b);
  const rank = allIQs.indexOf(currentScores.companyIQ);
  const percentileRank = Math.round((rank / (allIQs.length - 1)) * 100) || 0;

  // Sector averages
  const avg = (arr) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

  const sectorAvg = {
    companyIQ: avg(peerIQs),
    financial: avg(peerEntries.map(p => p.financial).filter(v => typeof v === "number")),
    legal: avg(peerEntries.map(p => p.legal).filter(v => typeof v === "number")),
    sentiment: avg(peerEntries.map(p => p.sentiment).filter(v => typeof v === "number")),
    deepAnalysis: avg(peerEntries.map(p => p.deepAnalysis).filter(v => typeof v === "number")),
  };

  // Best in class
  const bestIQ = Math.max(...peerIQs, currentScores.companyIQ);
  const bestTicker = currentScores.companyIQ === bestIQ
    ? ticker
    : peerEntries.find(p => p.companyIQ === bestIQ)?.ticker || "Unknown";

  // Per-metric comparison
  const metrics = {};
  for (const key of ["companyIQ", "financial", "legal", "sentiment", "deepAnalysis"]) {
    const current = currentScores[key];
    const peerAvg = sectorAvg[key];
    if (typeof current === "number" && typeof peerAvg === "number") {
      const delta = current - peerAvg;
      metrics[key] = {
        current,
        sectorAvg: peerAvg,
        delta,
        position: delta > 5 ? "ABOVE" : delta < -5 ? "BELOW" : "INLINE",
      };
    }
  }

  return {
    hasPeers: true,
    peerCount: peerEntries.length,
    sector,
    percentileRank,
    sectorAvg,
    bestInClass: { ticker: bestTicker, companyIQ: bestIQ },
    metrics,
    peers: peerEntries.map(p => ({ ticker: p.ticker, companyIQ: p.companyIQ }))
      .sort((a, b) => b.companyIQ - a.companyIQ)
      .slice(0, 5),
  };
}

export default { recordPeerScore, computePeerBenchmark };
