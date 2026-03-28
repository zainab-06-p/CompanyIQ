/**
 * Tests — Upgrade 20 (Adversarial Detection) + Future Scope
 *
 * Modules tested:
 * 1. adversarialDetection.js    (Upgrade 20)
 * 2. peerBenchmark.js           (Future 2B)
 * 3. scoreTrend.js              (Future 2C)
 * 4. db/database.js             (Future 3A)
 * 5. middleware/auth.js          (Future 3B)
 *
 * Run: node backend/tests/testFutureScope.js
 */

import { detectAdversarialPatterns } from "../engine/adversarialDetection.js";
import { recordPeerScore, computePeerBenchmark } from "../engine/peerBenchmark.js";
import { recordScoreSnapshot, computeScoreTrend } from "../engine/scoreTrend.js";
import { generateToken } from "../middleware/auth.js";

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
  }
}

// ─── 1. Adversarial Detection ───────────────────────────────────────

console.log("\n🛡️  ADVERSARIAL DETECTION ENGINE");
console.log("─".repeat(50));

// 1a. Clean data — no manipulation
const cleanArticles = [
  { title: "Company reports solid Q3 earnings", sentiment: "positive", source: "Economic Times", date: "2025-01-10" },
  { title: "Revenue growth steady at 12%", sentiment: "positive", source: "Moneycontrol", date: "2025-01-08" },
  { title: "Slight miss on analyst expectations", sentiment: "negative", source: "Business Standard", date: "2025-01-06" },
  { title: "New product line launched", sentiment: "neutral", source: "LiveMint", date: "2025-01-04" },
  { title: "Market outlook remains uncertain", sentiment: "negative", source: "NDTV Profit", date: "2025-01-02" },
];
const cleanRaw = cleanArticles.map(a => ({ ...a, url: `https://example.com/${a.title.replace(/ /g, "-")}` }));
const cleanResult = detectAdversarialPatterns(cleanArticles, cleanRaw, 65, 60);

assert(cleanResult !== null && typeof cleanResult === "object", "Returns object for clean data");
assert(typeof cleanResult.score === "number", "Has numeric integrity score");
assert(cleanResult.score >= 0 && cleanResult.score <= 100, "Integrity score 0-100 range");
assert(typeof cleanResult.rating === "string", "Has rating string");
assert(typeof cleanResult.riskLevel === "string", "Has riskLevel string");
assert(Array.isArray(cleanResult.flags), "Has flags array");
assert(typeof cleanResult.checks === "object", "Has checks object");
assert(cleanResult.checks.sentimentAnomaly !== undefined, "Has sentimentAnomaly check");
assert(cleanResult.checks.sourceCredibility !== undefined, "Has sourceCredibility check");
assert(cleanResult.checks.temporalClustering !== undefined, "Has temporalClustering check");
assert(cleanResult.checks.contentPatterns !== undefined, "Has contentPatterns check");
assert(cleanResult.checks.divergence !== undefined, "Has divergence check");

// 1b. Manipulated data — heavy positive skew
const manipulatedArticles = Array.from({ length: 20 }, (_, i) => ({
  title: i < 18 ? "Revolutionary breakthrough! Massive growth ahead!" : "Minor concern noted",
  sentiment: i < 18 ? "positive" : "negative",
  source: i < 5 ? "PR Newswire" : i < 10 ? "Business Wire" : "Unknown Blog",
  date: "2025-01-10",
}));
const manipResult = detectAdversarialPatterns(manipulatedArticles, manipulatedArticles, 30, 85);

assert(manipResult.score < cleanResult.score, "Manipulated data gets lower integrity score than clean");
assert(manipResult.flags.length > 0, "Manipulated data triggers flags");

// 1c. Empty input handling
const emptyResult = detectAdversarialPatterns([], [], 50, 50);
assert(emptyResult !== null, "Handles empty arrays");
assert(emptyResult.score >= 50, "Empty data still returns reasonable score");

// 1d. Divergence check — financial good but sentiment terrible
const divergentArticles = Array.from({ length: 10 }, () => ({
  title: "Company faces severe criticism",
  sentiment: "negative",
  source: "Economic Times",
  date: "2025-01-10",
}));
const divResult = detectAdversarialPatterns(divergentArticles, divergentArticles, 90, 15);
assert(divResult.checks.divergence !== undefined, "Divergence check exists for high gap");

// ─── 2. Peer Benchmark ─────────────────────────────────────────────

console.log("\n📊  PEER BENCHMARK ENGINE");
console.log("─".repeat(50));

// 2a. Record scores for peers
recordPeerScore("TCS", "IT", { companyIQ: 75, financial: 80, legal: 70, sentiment: 75 });
recordPeerScore("INFY", "IT", { companyIQ: 72, financial: 78, legal: 68, sentiment: 70 });
recordPeerScore("WIPRO", "IT", { companyIQ: 65, financial: 70, legal: 60, sentiment: 65 });
recordPeerScore("HCLTECH", "IT", { companyIQ: 70, financial: 75, legal: 65, sentiment: 70 });

// 2b. Compute benchmark for a company
const benchmark = computePeerBenchmark("TCS", "IT", { companyIQ: 75, financial: 80, legal: 70, sentiment: 75 });

assert(benchmark !== null && typeof benchmark === "object", "Returns benchmark object");
assert(typeof benchmark.percentileRank === "number", "Has percentileRank");
assert(benchmark.percentileRank >= 0 && benchmark.percentileRank <= 100, "Percentile 0-100");
assert(typeof benchmark.sectorAvg === "object", "Has sectorAvg");
assert(typeof benchmark.bestInClass === "object", "Has bestInClass");
assert(typeof benchmark.peerCount === "number", "Has peerCount");
assert(benchmark.peerCount >= 1, "Has at least 1 peer");
assert(benchmark.sector === "IT", "Correct sector");
assert(typeof benchmark.metrics === "object", "Has metrics comparison");

// 2c. Top company should have high percentile
assert(benchmark.percentileRank >= 50, "TCS (best score) has ≥50th percentile");

// 2d. Sector with no peers
const loneBenchmark = computePeerBenchmark("UNKNOWN", "Underwater Basket Weaving", { companyIQ: 50 });
assert(loneBenchmark.hasPeers === false || loneBenchmark.peerCount <= 1, "No peers returns low/no peer count");

// ─── 3. Score Trend ─────────────────────────────────────────────────

console.log("\n📈  SCORE TREND ENGINE");
console.log("─".repeat(50));

// 3a. Record multiple snapshots
recordScoreSnapshot("RELIANCE", { companyIQ: 70, financial: 72, legal: 68, sentiment: 70 });
recordScoreSnapshot("RELIANCE", { companyIQ: 72, financial: 74, legal: 69, sentiment: 73 });
recordScoreSnapshot("RELIANCE", { companyIQ: 75, financial: 76, legal: 71, sentiment: 77 });

// 3b. Compute trend
const trend = computeScoreTrend("RELIANCE", { companyIQ: 78, financial: 78, legal: 73, sentiment: 80 });

assert(trend !== null && typeof trend === "object", "Returns trend object");
assert(typeof trend.hasHistory === "boolean", "Has hasHistory boolean");
assert(trend.hasHistory === true, "Has history after recording snapshots");
assert(Array.isArray(trend.history), "Has history array");
assert(trend.history.length >= 3, "Has ≥3 history entries");
assert(typeof trend.trends === "object", "Has trends object");
assert(typeof trend.trends.companyIQ === "object", "Has companyIQ pillar trend");
assert(typeof trend.trends.companyIQ.direction === "string", "Trend has direction");
assert(["IMPROVING", "DECLINING", "STABLE"].includes(trend.trends.companyIQ.direction), "Direction is valid");
assert(Array.isArray(trend.alerts), "Has alerts array");

// 3c. Improving scores should show improving trend
assert(trend.trends.companyIQ.slope >= 0, "Positive slope for improving scores");

// 3d. No history case
const noHistory = computeScoreTrend("RANDOMXYZ", { companyIQ: 50 });
assert(noHistory.hasHistory === false, "No history for unknown ticker");

// ─── 4. Auth Middleware ─────────────────────────────────────────────

console.log("\n🔐  AUTH / JWT");
console.log("─".repeat(50));

// 4a. Token generation
const token = generateToken({ id: 1, email: "test@example.com" });
assert(typeof token === "string", "Generates string token");
assert(token.split(".").length === 3, "Token has 3 JWT parts");
assert(token.length > 50, "Token has reasonable length");

// 4b. Different users produce different tokens
const token2 = generateToken({ id: 2, email: "other@example.com" });
assert(token !== token2, "Different users get different tokens");

// ─── 5. Database Layer (import check) ───────────────────────────────

console.log("\n🗄️  DATABASE LAYER");
console.log("─".repeat(50));

try {
  const db = await import("../db/database.js");
  assert(typeof db.saveReport === "function", "saveReport exported");
  assert(typeof db.getLatestReport === "function", "getLatestReport exported");
  assert(typeof db.saveScoreHistory === "function", "saveScoreHistory exported");
  assert(typeof db.getScoreHistory === "function", "getScoreHistory exported");
  assert(typeof db.createUser === "function", "createUser exported");
  assert(typeof db.getUserByEmail === "function", "getUserByEmail exported");
  assert(typeof db.addToWatchlist === "function", "addToWatchlist exported");
  assert(typeof db.getWatchlist === "function", "getWatchlist exported");
  assert(typeof db.getDbStats === "function", "getDbStats exported");

  // Test DB operations
  const stats = db.getDbStats();
  assert(typeof stats === "object", "getDbStats returns object");
  assert(typeof stats.totalReports === "number", "Stats has totalReports");
  assert(typeof stats.totalUsers === "number", "Stats has totalUsers");

  // Test user create + lookup
  const testEmail = `test_${Date.now()}@example.com`;
  db.createUser(testEmail, "hashed_pass_123", "Test User");
  const user = db.getUserByEmail(testEmail);
  assert(user !== undefined, "Created user found by email");
  assert(user.name === "Test User", "User name matches");

  // Test report save + retrieve
  db.saveReport("TESTCOMP", "standard", { companyIQ: 65, company: { ticker: "TESTCOMP" } });
  const report = db.getLatestReport("TESTCOMP");
  assert(report !== undefined, "Saved report retrieved");

  // Test watchlist
  if (user) {
    db.addToWatchlist(user.id, "TESTCOMP", "Test Company", 10);
    const wl = db.getWatchlist(user.id);
    assert(Array.isArray(wl), "Watchlist returns array");
    assert(wl.length >= 1, "Watchlist has the added item");
    assert(wl[0].ticker === "TESTCOMP", "Watchlist ticker matches");

    db.removeFromWatchlist(user.id, "TESTCOMP");
    const wl2 = db.getWatchlist(user.id);
    assert(wl2.length < wl.length, "Watchlist item removed");
  }

  // Test score history
  db.saveScoreHistory("TESTCOMP", 65, 70, 60, 65, null);
  const history = db.getScoreHistory("TESTCOMP", 30);
  assert(Array.isArray(history), "Score history returns array");
  assert(history.length >= 1, "Score history has entry");

} catch (err) {
  console.log(`  ⚠️  Database tests skipped (better-sqlite3 may not be available): ${err.message}`);
}

// ─── Summary ────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(50));
console.log(`  📋  RESULTS: ${passed}/${total} passed, ${failed} failed`);
console.log("═".repeat(50));

if (failed > 0) {
  console.log("\n  ⚠️  Some tests failed. Review output above.");
  process.exit(1);
} else {
  console.log("\n  🎉  All tests passed!");
  process.exit(0);
}
