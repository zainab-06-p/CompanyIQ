/**
 * CompanyIQ — Express Server Entry Point
 *
 * Registers all routes, middleware, CORS, error handling.
 * Run: node --watch server.js
 */

import express from "express";
import cors from "cors";
import config from "./config/env.js";

// Routes
import scoreRoutes from "./routes/scoreRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import compareRoutes from "./routes/compareRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import watchlistRoutes from "./routes/watchlistRoutes.js";
import portfolioRoutes from "./routes/portfolioRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import adminCacheRoutes from "./routes/adminCacheRoutes.js";
import { startAlertMonitor } from "./services/alertMonitor.js";
import { supabaseEnabled } from "./config/supabase.js";

// Cache (for stats endpoint)
import { getCacheStats } from "./cache/cacheLayer.js";

// Database
import { getDbStats } from "./db/database.js";

// Input sanitization
import { sanitizeInput } from "./middleware/inputValidation.js";

const app = express();

// ─── Global Middleware ──────────────────────────────────────────────────

app.use(
  cors({
    origin: config.cors?.origin || ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(sanitizeInput);

// Request logging (lightweight)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path !== "/api/health") {
      console.log(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ─── Health Check ───────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "CompanyIQ API",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    cache: getCacheStats(),
    database: getDbStats(),
  });
});

// ─── API Routes ─────────────────────────────────────────────────────────

app.use("/api/score", scoreRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/compare", compareRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/cache", adminCacheRoutes);

// ─── 404 Handler ────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// ─── Global Error Handler ───────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error("[Server] Unhandled error:", err);
  res.status(500).json({
    error: true,
    message: "Internal server error. Please try again.",
  });
});

// ─── Environment Validation ─────────────────────────────────────────────

function validateEnv() {
  const warnings = [];
  const errors = [];

  if (!config.tinyfish?.apiKey) {
    errors.push("TINYFISH_API_KEY is missing — agents will not work");
  }
  if (!config.groq?.apiKey) {
    warnings.push("GROQ_API_KEY is missing — AI synthesis will use fallbacks");
  }
  if (!config.razorpay?.keyId || !config.razorpay?.keySecret) {
    warnings.push("RAZORPAY keys missing — payment features disabled (demo mode still works)");
  }
  if (!supabaseEnabled) {
    warnings.push("Supabase keys missing — cloud auth/history features disabled");
  }

  if (errors.length > 0) {
    console.error("\n⛔ CRITICAL ENVIRONMENT ERRORS:");
    errors.forEach((e) => console.error(`  ✗ ${e}`));
  }
  if (warnings.length > 0) {
    console.warn("\n⚠️  Environment Warnings:");
    warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
  }
  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ All environment variables configured");
  }

  return errors.length === 0;
}

// ─── Start ──────────────────────────────────────────────────────────────

const PORT = config.server.port || 3001;

const envOk = validateEnv();

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  CompanyIQ API Server                      ║
║  Running on http://localhost:${PORT}          ║
║  Press Ctrl+C to stop                      ║
╚════════════════════════════════════════════╝
  `);
  console.log("Endpoints:");
  console.log(`  GET  /api/health                — Health check`);
  console.log(`  GET  /api/score/:company        — Free CompanyIQ score`);
  console.log(`  GET  /api/progress/:company     — SSE progress stream`);
  console.log(`  POST /api/report/create-order   — Create Razorpay order`);
  console.log(`  POST /api/report/generate       — Generate paid report`);
  console.log(`  GET  /api/companies/search?q=   — Company autocomplete`);
  console.log(`  GET  /api/companies/all         — All supported companies`);
  console.log(`  GET  /api/companies/resolve/:x  — Resolve company`);
  console.log(`  GET  /api/compare?a=&b=         — Compare two companies`);
  console.log(`       /api/compare?...&cacheOnly=1 — Strict cache-only compare`);
  console.log(`  POST /api/auth/register          — User registration`);
  console.log(`  POST /api/auth/login             — User login`);
  console.log(`  POST /api/auth/resend-confirmation — Resend verification email`);
  console.log(`  GET  /api/auth/me                — Current user profile`);
  console.log(`  POST /api/auth/select-plan       — Choose plan tier`);
  console.log(`  GET  /api/watchlist               — Get watchlist`);
  console.log(`  POST /api/watchlist/add           — Add to watchlist`);
  console.log(`  DEL  /api/watchlist/:ticker       — Remove from watchlist`);
  console.log(`  POST /api/portfolio/analyze       — Portfolio risk analysis`);
  console.log(`       /api/portfolio/analyze?cacheOnly=1 — Strict cache-only portfolio`);
  console.log(`  GET  /api/history                — User report history`);
  console.log(`  POST /api/history/track          — Track report in history`);
  console.log(`  POST /api/alerts/setup            — Setup BSE real-time alert`);
  console.log(`  GET  /api/alerts                  — List active alerts`);
  console.log(`  GET  /api/alerts/history/:ticker  — Alert trigger history`);
  console.log("");

  // Start BSE real-time alert monitor (background polling)
  if (envOk || config.tinyfish?.apiKey) {
    startAlertMonitor();
  }
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────

function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
  server.close(() => {
    console.log("[Server] HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[Server] Forced shutdown after timeout.");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
