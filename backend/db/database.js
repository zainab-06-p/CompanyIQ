/**
 * Database Layer — SQLite
 *
 * Persistent storage for reports, score history, users, watchlists.
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 *
 * Tables:
 *   reports         — Full report JSON per analysis
 *   score_history   — Score snapshots over time
 *   users           — Authenticated users
 *   watchlist       — User watchlists
 *   payments        — Payment records
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercelRuntime = Boolean(process.env.VERCEL);
const DB_PATH = isVercelRuntime
  ? path.join("/tmp", "companyiq.db")
  : path.join(__dirname, "..", "data", "companyiq.db");

// Ensure data directory exists
import fs from "fs";
const dataDir = isVercelRuntime ? "/tmp" : path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Schema ─────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free_score',
    company_name TEXT,
    sector TEXT,
    company_iq INTEGER,
    rating TEXT,
    report_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reports_ticker ON reports(ticker);
  CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

  CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    company_iq INTEGER,
    financial_score REAL,
    legal_score REAL,
    sentiment_score REAL,
    deep_analysis_score REAL,
    recorded_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_history_ticker ON score_history(ticker);

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    supabase_user_id TEXT,
    name TEXT,
    plan_tier TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    company_name TEXT,
    alert_threshold INTEGER DEFAULT 5,
    last_score INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, ticker)
  );

  CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ticker TEXT NOT NULL,
    tier TEXT NOT NULL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    amount_paise INTEGER,
    status TEXT DEFAULT 'created',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS peer_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    sector TEXT NOT NULL,
    company_iq INTEGER,
    financial_score REAL,
    legal_score REAL,
    sentiment_score REAL,
    deep_analysis_score REAL,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(ticker)
  );

  CREATE INDEX IF NOT EXISTS idx_peer_sector ON peer_scores(sector);

  CREATE TABLE IF NOT EXISTS bse_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ticker TEXT NOT NULL,
    webhook_url TEXT,
    email TEXT,
    threshold TEXT DEFAULT 'all',
    last_checked_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, ticker)
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_ticker ON bse_alerts(ticker);

  CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    alert_id INTEGER,
    announcement_date TEXT,
    subject TEXT,
    category TEXT,
    triggered_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_alert_history_ticker ON alert_history(ticker);
`);

// Backward-compatible migrations for existing local DB files.
const userCols = db.prepare("PRAGMA table_info(users)").all();
if (!userCols.some((c) => c.name === "supabase_user_id")) {
  db.exec("ALTER TABLE users ADD COLUMN supabase_user_id TEXT");
}
if (!userCols.some((c) => c.name === "plan_tier")) {
  db.exec("ALTER TABLE users ADD COLUMN plan_tier TEXT");
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase ON users(supabase_user_id)");

// ─── Expose raw db instance for services ────────────────────────────────
export function getDb() {
  return db;
}

// ─── Prepared Statements ────────────────────────────────────────────────

const stmts = {
  // Reports
  insertReport: db.prepare(`
    INSERT INTO reports (ticker, tier, company_name, sector, company_iq, rating, report_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),

  getLatestReport: db.prepare(`
    SELECT * FROM reports WHERE ticker = ? ORDER BY created_at DESC LIMIT 1
  `),

  getLatestReportByTier: db.prepare(`
    SELECT * FROM reports WHERE ticker = ? AND tier = ? ORDER BY created_at DESC LIMIT 1
  `),

  getReportsByTicker: db.prepare(`
    SELECT id, ticker, tier, company_name, sector, company_iq, rating, created_at
    FROM reports WHERE ticker = ? ORDER BY created_at DESC LIMIT ?
  `),

  // Score History
  insertScoreHistory: db.prepare(`
    INSERT INTO score_history (ticker, company_iq, financial_score, legal_score, sentiment_score, deep_analysis_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  getScoreHistory: db.prepare(`
    SELECT * FROM score_history WHERE ticker = ? ORDER BY recorded_at DESC LIMIT ?
  `),

  // Users
  insertUser: db.prepare(`
    INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)
  `),

  insertSupabaseUser: db.prepare(`
    INSERT INTO users (email, password_hash, name, supabase_user_id)
    VALUES (?, ?, ?, ?)
  `),

  getUserByEmail: db.prepare(`
    SELECT * FROM users WHERE email = ?
  `),

  getUserBySupabaseId: db.prepare(`
    SELECT * FROM users WHERE supabase_user_id = ?
  `),

  getUserById: db.prepare(`
    SELECT id, email, name, supabase_user_id, plan_tier, created_at, last_login FROM users WHERE id = ?
  `),

  linkUserToSupabase: db.prepare(`
    UPDATE users SET supabase_user_id = ? WHERE id = ?
  `),

  updateUserPlanTier: db.prepare(`
    UPDATE users SET plan_tier = ? WHERE id = ?
  `),

  updateLastLogin: db.prepare(`
    UPDATE users SET last_login = datetime('now') WHERE id = ?
  `),

  // Watchlist
  addToWatchlist: db.prepare(`
    INSERT OR REPLACE INTO watchlist (user_id, ticker, company_name, alert_threshold, last_score)
    VALUES (?, ?, ?, ?, ?)
  `),

  removeFromWatchlist: db.prepare(`
    DELETE FROM watchlist WHERE user_id = ? AND ticker = ?
  `),

  getWatchlist: db.prepare(`
    SELECT * FROM watchlist WHERE user_id = ? ORDER BY created_at DESC
  `),

  updateWatchlistScore: db.prepare(`
    UPDATE watchlist SET last_score = ? WHERE user_id = ? AND ticker = ?
  `),

  // Payments
  insertPayment: db.prepare(`
    INSERT INTO payments (user_id, ticker, tier, razorpay_order_id, amount_paise, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  updatePaymentStatus: db.prepare(`
    UPDATE payments SET status = ?, razorpay_payment_id = ? WHERE razorpay_order_id = ?
  `),

  getUserPayments: db.prepare(`
    SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  `),

  // Peer Scores
  upsertPeerScore: db.prepare(`
    INSERT INTO peer_scores (ticker, sector, company_iq, financial_score, legal_score, sentiment_score, deep_analysis_score, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(ticker) DO UPDATE SET
      sector = excluded.sector,
      company_iq = excluded.company_iq,
      financial_score = excluded.financial_score,
      legal_score = excluded.legal_score,
      sentiment_score = excluded.sentiment_score,
      deep_analysis_score = excluded.deep_analysis_score,
      updated_at = excluded.updated_at
  `),

  getPeersBySector: db.prepare(`
    SELECT * FROM peer_scores WHERE sector = ? AND ticker != ?
  `),

  // Stats
  countReports: db.prepare(`SELECT COUNT(*) as count FROM reports`),
  countUsers: db.prepare(`SELECT COUNT(*) as count FROM users`),
  countScoreEntries: db.prepare(`SELECT COUNT(*) as count FROM score_history`),

  // Cache management
  deleteReportsByTicker: db.prepare(`DELETE FROM reports WHERE ticker = ?`),
  deleteAllReports: db.prepare(`DELETE FROM reports`),
};

// ─── Public API ─────────────────────────────────────────────────────────

// Reports
export function saveReport(ticker, tier, companyName, sector, companyIQ, rating, reportObj) {
  return stmts.insertReport.run(ticker, tier, companyName, sector, companyIQ, rating, JSON.stringify(reportObj));
}

export function getLatestReport(ticker) {
  const row = stmts.getLatestReport.get(ticker);
  if (row && row.report_json) {
    row.report = JSON.parse(row.report_json);
  }
  return row || null;
}

export function getLatestReportByTier(ticker, tier) {
  const row = stmts.getLatestReportByTier.get(ticker, tier);
  if (row && row.report_json) {
    row.report = JSON.parse(row.report_json);
  }
  return row || null;
}

export function getReportHistory(ticker, limit = 10) {
  return stmts.getReportsByTicker.all(ticker, limit);
}

export function deleteReportsByTicker(ticker) {
  return stmts.deleteReportsByTicker.run(ticker.toUpperCase());
}

export function deleteAllReports() {
  return stmts.deleteAllReports.run();
}

// Score History
export function saveScoreHistory(ticker, scores) {
  return stmts.insertScoreHistory.run(
    ticker,
    scores.companyIQ,
    scores.financial,
    scores.legal,
    scores.sentiment,
    scores.deepAnalysis
  );
}

export function getScoreHistory(ticker, limit = 50) {
  return stmts.getScoreHistory.all(ticker, limit).reverse(); // chronological order
}

// Users
export function createUser(email, passwordHash, name) {
  return stmts.insertUser.run(email, passwordHash, name);
}

export function getUserByEmail(email) {
  return stmts.getUserByEmail.get(email) || null;
}

export function getUserById(id) {
  return stmts.getUserById.get(id) || null;
}

export function getUserBySupabaseId(supabaseUserId) {
  return stmts.getUserBySupabaseId.get(supabaseUserId) || null;
}

export function ensureUserFromSupabase(supabaseUser) {
  if (!supabaseUser?.id || !supabaseUser?.email) return null;

  const supabaseUserId = supabaseUser.id;
  const email = String(supabaseUser.email).toLowerCase().trim();
  const displayName = supabaseUser.user_metadata?.name || null;

  const bySupabaseId = getUserBySupabaseId(supabaseUserId);
  if (bySupabaseId) return bySupabaseId;

  const byEmail = getUserByEmail(email);
  if (byEmail) {
    stmts.linkUserToSupabase.run(supabaseUserId, byEmail.id);
    return getUserById(byEmail.id);
  }

  const inserted = stmts.insertSupabaseUser.run(
    email,
    "__supabase_managed__",
    displayName,
    supabaseUserId
  );
  return getUserById(inserted.lastInsertRowid);
}

export function updateUserPlanTier(userId, tier) {
  return stmts.updateUserPlanTier.run(tier, userId);
}

export function updateLastLogin(id) {
  return stmts.updateLastLogin.run(id);
}

// Watchlist
export function addToWatchlist(userId, ticker, companyName, threshold = 5, lastScore = null) {
  return stmts.addToWatchlist.run(userId, ticker, companyName, threshold, lastScore);
}

export function removeFromWatchlist(userId, ticker) {
  return stmts.removeFromWatchlist.run(userId, ticker);
}

export function getWatchlist(userId) {
  return stmts.getWatchlist.all(userId);
}

export function updateWatchlistScore(userId, ticker, score) {
  return stmts.updateWatchlistScore.run(score, userId, ticker);
}

// Payments
export function createPayment(userId, ticker, tier, razorpayOrderId, amountPaise) {
  return stmts.insertPayment.run(userId, ticker, tier, razorpayOrderId, amountPaise, "created");
}

export function completePayment(razorpayOrderId, razorpayPaymentId) {
  return stmts.updatePaymentStatus.run("paid", razorpayPaymentId, razorpayOrderId);
}

export function getUserPayments(userId, limit = 20) {
  return stmts.getUserPayments.all(userId, limit);
}

// Peer Scores (DB-backed)
export function savePeerScore(ticker, sector, scores) {
  return stmts.upsertPeerScore.run(
    ticker, sector, scores.companyIQ, scores.financial, scores.legal, scores.sentiment, scores.deepAnalysis
  );
}

export function getPeersBySector(sector, excludeTicker) {
  return stmts.getPeersBySector.all(sector, excludeTicker);
}

// Stats
export function getDbStats() {
  return {
    totalReports: stmts.countReports.get().count,
    totalUsers: stmts.countUsers.get().count,
    scoreEntries: stmts.countScoreEntries.get().count,
  };
}

// Cleanup on process exit
process.on("exit", () => db.close());

export default {
  saveReport, getLatestReport, getLatestReportByTier, getReportHistory,
  saveScoreHistory, getScoreHistory,
  createUser, getUserByEmail, getUserById, getUserBySupabaseId, ensureUserFromSupabase, updateUserPlanTier, updateLastLogin,
  addToWatchlist, removeFromWatchlist, getWatchlist, updateWatchlistScore,
  createPayment, completePayment, getUserPayments,
  savePeerScore, getPeersBySector,
  getDbStats,
};
