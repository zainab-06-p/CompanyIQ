/**
 * Alert Routes — /api/alerts
 *
 * Setup, manage, and query real-time BSE announcement alerts.
 * Alerts are monitored by the background alertMonitor service.
 */

import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { getDb } from "../db/database.js";

const router = Router();

/**
 * POST /api/alerts/setup
 * Body: { ticker, webhookUrl?, email?, threshold? }
 * threshold: "all" (default) | "high" (Financial Results, Director Change, Pledge, SEBI only)
 */
router.post("/setup", optionalAuth, (req, res) => {
  try {
    const { ticker, webhookUrl, email, threshold = "all" } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: true, message: "ticker is required" });
    }

    if (!webhookUrl && !email) {
      return res.status(400).json({
        error: true,
        message: "At least one of webhookUrl or email is required",
      });
    }

    // Validate webhook URL — must be http(s) only to prevent SSRF
    if (webhookUrl) {
      try {
        const parsed = new URL(webhookUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({
            error: true,
            message: "webhookUrl must use http or https protocol",
          });
        }
      } catch {
        return res.status(400).json({
          error: true,
          message: "Invalid webhookUrl — must be a full URL including protocol",
        });
      }
    }

    if (!["all", "high"].includes(threshold)) {
      return res.status(400).json({
        error: true,
        message: "threshold must be 'all' or 'high'",
      });
    }

    const db = getDb();
    const userId = req.user?.id ?? null;

    db.prepare(
      `INSERT INTO bse_alerts (user_id, ticker, webhook_url, email, threshold, is_active)
       VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(ticker, COALESCE(user_id, 0)) DO UPDATE SET
         webhook_url = excluded.webhook_url,
         email       = excluded.email,
         threshold   = excluded.threshold,
         is_active   = 1`
    ).run(userId, ticker.toUpperCase(), webhookUrl || null, email || null, threshold);

    return res.status(201).json({
      message: `Alert configured for ${ticker.toUpperCase()}`,
      ticker: ticker.toUpperCase(),
      webhookUrl: webhookUrl || null,
      email: email || null,
      threshold,
      info: "BSE announcements will be checked every 15 minutes",
    });
  } catch (err) {
    console.error("[Alerts] Setup failed:", err.message);
    return res.status(500).json({ error: true, message: "Failed to set up alert" });
  }
});

/**
 * GET /api/alerts
 * Returns active alerts for the authenticated user (or anonymous alerts if not authed).
 */
router.get("/", optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user?.id ?? null;
    const alerts = userId
      ? db
          .prepare(
            "SELECT id, ticker, webhook_url, email, threshold, last_checked_at, created_at FROM bse_alerts WHERE user_id = ? AND is_active = 1"
          )
          .all(userId)
      : db
          .prepare(
            "SELECT id, ticker, webhook_url, email, threshold, last_checked_at, created_at FROM bse_alerts WHERE user_id IS NULL AND is_active = 1"
          )
          .all();

    return res.json({ alerts });
  } catch (err) {
    return res.status(500).json({ error: true, message: "Failed to get alerts" });
  }
});

/**
 * DELETE /api/alerts/:ticker
 */
router.delete("/:ticker", optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const ticker = req.params.ticker.toUpperCase();
    const userId = req.user?.id ?? null;

    if (userId) {
      db.prepare(
        "UPDATE bse_alerts SET is_active = 0 WHERE ticker = ? AND user_id = ?"
      ).run(ticker, userId);
    } else {
      db.prepare(
        "UPDATE bse_alerts SET is_active = 0 WHERE ticker = ? AND user_id IS NULL"
      ).run(ticker);
    }

    return res.json({ message: `Alert removed for ${ticker}` });
  } catch (err) {
    return res.status(500).json({ error: true, message: "Failed to remove alert" });
  }
});

/**
 * GET /api/alerts/history/:ticker
 * Returns triggered alert history for a ticker (most recent 50).
 */
router.get("/history/:ticker", (req, res) => {
  try {
    const db = getDb();
    const ticker = req.params.ticker.toUpperCase();
    const history = db
      .prepare(
        "SELECT * FROM alert_history WHERE ticker = ? ORDER BY triggered_at DESC LIMIT 50"
      )
      .all(ticker);

    return res.json({ ticker, history });
  } catch (err) {
    return res.status(500).json({ error: true, message: "Failed to get alert history" });
  }
});

export default router;
