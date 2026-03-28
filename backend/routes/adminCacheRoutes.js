/**
 * Admin Routes — Cache Management
 *
 * Provides endpoints to clear the analysis cache for specific tickers,
 * useful for development and forcing fresh analysis after code changes.
 */

import { Router } from "express";
import { deleteReportsByTicker, deleteAllReports } from "../db/database.js";
import { deleteCache, getCacheStats } from "../cache/cacheLayer.js";

const router = Router();

/**
 * DELETE /api/cache/clear/:ticker
 *
 * Clears all cached reports for a specific ticker from both
 * in-memory cache and the SQLite DB. Next analysis will run fresh.
 */
router.delete("/clear/:ticker", (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  // Clear in-memory cache (all key variants)
  const keys = [
    `report:${ticker}:free_score:full`,
    `report:${ticker}:free_score:fast`,
    `report:${ticker}:quick_scan:full`,
    `report:${ticker}:standard:full`,
  ];
  keys.forEach(k => deleteCache(k));

  // Clear DB
  let dbDeleted = 0;
  try {
    const result = deleteReportsByTicker(ticker);
    dbDeleted = result.changes;
  } catch (e) {
    console.error(`[AdminCache] Failed to clear DB for ${ticker}:`, e.message);
  }

  console.log(`[AdminCache] Cleared cache for ${ticker}: in-memory keys cleared, ${dbDeleted} DB record(s) deleted.`);

  res.json({
    ok: true,
    ticker,
    message: `Cache cleared for ${ticker}. Deleted ${dbDeleted} DB report(s) and ${keys.length} in-memory keys.`,
  });
});

/**
 * DELETE /api/cache/clear-all
 *
 * Clears ALL cached reports from the DB. Use with caution in production.
 */
router.delete("/clear-all", (req, res) => {
  let dbDeleted = 0;
  try {
    const result = deleteAllReports();
    dbDeleted = result.changes;
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }

  console.log(`[AdminCache] Cleared ALL ${dbDeleted} reports from DB.`);
  res.json({ ok: true, message: `Cleared all ${dbDeleted} report(s) from DB.` });
});

/**
 * GET /api/cache/stats
 *
 * Returns current cache statistics.
 */
router.get("/stats", (req, res) => {
  res.json({ ok: true, stats: getCacheStats() });
});

export default router;
