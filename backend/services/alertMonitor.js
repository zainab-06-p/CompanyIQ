/**
 * Alert Monitor — Background BSE Polling Service
 *
 * Polls BSE for new corporate announcements every 15 minutes.
 * When new announcements are detected for watched tickers,
 * fires webhook POST requests and logs email alerts.
 *
 * Started once at server startup via startAlertMonitor().
 */

import fetch from "node-fetch";
import { callTinyFish } from "../agents/tinyfish.js";
import { getDb } from "../db/database.js";

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let monitorInterval = null;

export function startAlertMonitor() {
  if (monitorInterval) return; // Already running

  console.log("[AlertMonitor] Starting BSE real-time alert monitor (15-min polling)");

  // Run one cycle immediately on startup, then every 15 minutes
  runAlertCycle().catch((err) =>
    console.error("[AlertMonitor] Initial cycle error:", err.message)
  );

  monitorInterval = setInterval(() => {
    runAlertCycle().catch((err) =>
      console.error("[AlertMonitor] Cycle error:", err.message)
    );
  }, POLL_INTERVAL_MS);
}

export function stopAlertMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("[AlertMonitor] Stopped");
  }
}

// ─── Main Polling Cycle ──────────────────────────────────────────────────

async function runAlertCycle() {
  const db = getDb();
  const alerts = db
    .prepare("SELECT * FROM bse_alerts WHERE is_active = 1")
    .all();

  if (alerts.length === 0) return;

  console.log(`[AlertMonitor] Checking ${alerts.length} active alert(s)...`);

  // Process serially to avoid hammering BSE with parallel TinyFish calls
  for (const alert of alerts) {
    try {
      await checkAlert(alert);
    } catch (err) {
      console.warn(
        `[AlertMonitor] Failed to check alert for ${alert.ticker}:`,
        err.message
      );
    }
  }
}

async function checkAlert(alert) {
  const db = getDb();

  // Use TinyFish to scrape latest BSE announcements for this ticker
  const result = await callTinyFish(
    "https://www.bseindia.com/corporates/ann.html",
    buildPollingGoal(alert.ticker),
    {
      browserProfile: "stealth",
      timeout: 120000, // 2 minutes max for a polling call
    }
  );

  // Update last_checked_at right away regardless of outcome
  db.prepare(
    "UPDATE bse_alerts SET last_checked_at = datetime('now') WHERE id = ?"
  ).run(alert.id);

  const raw = result?.resultJson;
  if (!raw?.announcements?.length) return;

  // Only consider announcements newer than last_checked_at
  const lastChecked = alert.last_checked_at
    ? new Date(alert.last_checked_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const newAnns = raw.announcements.filter((ann) => {
    if (!ann.date) return false;
    return new Date(ann.date) > lastChecked;
  });

  if (newAnns.length === 0) return;

  const filtered = applyThreshold(newAnns, alert.threshold);
  if (filtered.length === 0) return;

  console.log(
    `[AlertMonitor] ${filtered.length} new announcement(s) for ${alert.ticker}`
  );

  // Persist to alert_history
  for (const ann of filtered) {
    try {
      db.prepare(
        `INSERT INTO alert_history
           (ticker, alert_id, announcement_date, subject, category, triggered_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).run(alert.ticker, alert.id, ann.date, ann.subject, ann.category);
    } catch {
      // ignore duplicate inserts
    }
  }

  // Fire notifications
  await fireNotification(alert, filtered);
}

function buildPollingGoal(ticker) {
  return `On the BSE India corporate announcements page, search for the company with ticker "${ticker}".
Set the date filter to show today and yesterday. Submit the search.
Extract all announcements shown in the results.

For each announcement, extract:
- date (YYYY-MM-DD)
- subject (full headline text)
- category: classify as one of "Board Meeting", "Financial Results", "Director Change", "Pledge", "SEBI", "Dividend", "AGM", "Other"
- priority: "HIGH" if it's Financial Results, Director Change, Pledge, or SEBI; otherwise "NORMAL"

Return ONLY valid JSON:
{
  "announcements": [
    { "date": "YYYY-MM-DD", "subject": "", "category": "", "priority": "NORMAL" }
  ]
}
If no announcements found, return: { "announcements": [] }`;
}

function applyThreshold(announcements, threshold) {
  if (threshold === "high") {
    return announcements.filter((a) => a.priority === "HIGH");
  }
  // "all" — return everything
  return announcements;
}

async function fireNotification(alert, announcements) {
  const payload = {
    event: "bse_announcement",
    ticker: alert.ticker,
    newCount: announcements.length,
    announcements: announcements.slice(0, 5),
    triggeredAt: new Date().toISOString(),
    source: "CompanyIQ BSE Monitor",
  };

  // Fire webhook
  if (alert.webhook_url) {
    try {
      const resp = await fetch(alert.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      console.log(
        `[AlertMonitor] Webhook fired for ${alert.ticker} → HTTP ${resp.status}`
      );
    } catch (err) {
      console.warn(
        `[AlertMonitor] Webhook failed for ${alert.ticker}:`,
        err.message
      );
    }
  }

  // Email alert (console log for demo; replace with nodemailer/SendGrid in production)
  if (alert.email) {
    console.log(
      `[AlertMonitor] EMAIL → ${alert.email} | ${alert.ticker}: ${announcements.length} new announcement(s)`
    );
    console.log(`  Latest: ${announcements[0]?.subject}`);
  }
}
