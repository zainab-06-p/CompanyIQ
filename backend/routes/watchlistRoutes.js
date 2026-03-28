/**
 * Watchlist Routes — /api/watchlist
 *
 * Authenticated endpoints for managing company watchlists.
 * Supports add, remove, list, and score-change detection.
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  updateWatchlistScore,
} from "../db/database.js";
import { resolveCompany } from "../config/companyResolver.js";

const router = Router();

/**
 * GET /api/watchlist
 * Returns the user's full watchlist.
 */
router.get("/", requireAuth, (req, res) => {
  try {
    const items = getWatchlist(req.user.id);
    return res.json({ watchlist: items });
  } catch (error) {
    console.error("[Watchlist] Get error:", error.message);
    return res.status(500).json({ error: true, message: "Failed to get watchlist" });
  }
});

/**
 * POST /api/watchlist/add
 * Body: { company, alertThreshold? }
 */
router.post("/add", requireAuth, (req, res) => {
  try {
    const { company, alertThreshold } = req.body;

    if (!company) {
      return res.status(400).json({ error: true, message: "Company name or ticker required" });
    }

    const resolved = resolveCompany(company);
    if (!resolved) {
      return res.status(404).json({ error: true, message: `Company "${company}" not found` });
    }

    addToWatchlist(
      req.user.id,
      resolved.ticker,
      resolved.name,
      alertThreshold || 5,
      null
    );

    return res.status(201).json({
      message: `${resolved.name} added to watchlist`,
      company: { name: resolved.name, ticker: resolved.ticker, sector: resolved.sector },
    });
  } catch (error) {
    console.error("[Watchlist] Add error:", error.message);
    return res.status(500).json({ error: true, message: "Failed to add to watchlist" });
  }
});

/**
 * DELETE /api/watchlist/:ticker
 */
router.delete("/:ticker", requireAuth, (req, res) => {
  try {
    const { ticker } = req.params;
    removeFromWatchlist(req.user.id, ticker.toUpperCase());
    return res.json({ message: `${ticker} removed from watchlist` });
  } catch (error) {
    console.error("[Watchlist] Remove error:", error.message);
    return res.status(500).json({ error: true, message: "Failed to remove from watchlist" });
  }
});

/**
 * POST /api/watchlist/check-alerts
 * Checks watchlist items for score changes exceeding thresholds.
 * Does NOT re-run analysis — compares stored last_score with latest cached/DB score.
 */
router.post("/check-alerts", requireAuth, async (req, res) => {
  try {
    const items = getWatchlist(req.user.id);
    const alerts = [];

    for (const item of items) {
      // Use score history from DB
      const { getScoreHistory } = await import("../db/database.js");
      const history = getScoreHistory(item.ticker, 2);

      if (history.length >= 2) {
        const latest = history[history.length - 1];
        const previous = history[history.length - 2];
        const delta = latest.company_iq - previous.company_iq;

        if (Math.abs(delta) >= (item.alert_threshold || 5)) {
          alerts.push({
            ticker: item.ticker,
            companyName: item.company_name,
            previousScore: previous.company_iq,
            currentScore: latest.company_iq,
            delta,
            direction: delta > 0 ? "UP" : "DOWN",
            threshold: item.alert_threshold,
          });
        }

        // Update last known score
        updateWatchlistScore(req.user.id, item.ticker, latest.company_iq);
      }
    }

    return res.json({ alerts, checkedCount: items.length });
  } catch (error) {
    console.error("[Watchlist] Alert check error:", error.message);
    return res.status(500).json({ error: true, message: "Failed to check alerts" });
  }
});

export default router;
