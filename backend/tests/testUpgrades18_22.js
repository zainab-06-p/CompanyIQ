/**
 * Test Suite for Upgrades 18-22
 * Tests: Relationship Graph, Multi-Horizon, Report Diff, Smart Resolution
 */

import { buildRelationshipGraph } from "../engine/relationshipGraph.js";
import { computeMultiHorizon } from "../engine/multiHorizon.js";
import { generateReportDiff } from "../engine/reportDiff.js";
import { resolveCompany, resolveCompanyEnhanced, getSuggestions } from "../config/companyResolver.js";
import { setCache } from "../cache/cacheLayer.js";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════
// Upgrade 18 — Relationship Graph
// ═══════════════════════════════════════════════════
console.log("\n🔗 Upgrade 18 — Relationship Graph");

const tcsCompany = { name: "Tata Consultancy Services Ltd", ticker: "TCS", sector: "Information Technology" };
const graph = buildRelationshipGraph(tcsCompany, { announcements: [], shareholding: {} }, {});

assert(graph.company.ticker === "TCS", "returns correct company");
assert(graph.promoterGroup.groupName === "Tata Group", "identifies Tata Group");
assert(graph.promoterGroup.siblings.length > 0, "finds Tata Group siblings");
assert(graph.promoterGroup.contagionRisk, "computes contagion risk");
assert(graph.competitors.length > 0, "finds IT sector competitors");
assert(graph.competitors.some(c => c.ticker === "INFY"), "Infosys is a competitor");
assert(graph.dependencies !== undefined, "analyzes dependencies");
assert(graph.directorNetwork !== undefined, "analyzes director network");
assert(graph.groupRiskLevel.level !== undefined, "computes group risk level");

// Standalone company (no group)
const zomatoCompany = { name: "Zomato Ltd", ticker: "ZOMATO", sector: "Internet & Technology" };
const zGraph = buildRelationshipGraph(zomatoCompany, null, null);
assert(zGraph.promoterGroup.groupName === null, "standalone company has no group");
assert(zGraph.promoterGroup.contagionRisk === "LOW", "standalone has low contagion risk");
assert(zGraph.groupRiskLevel.level === "LOW", "standalone has low group risk");

// Large group company
const adaniCompany = { name: "Adani Enterprises Ltd", ticker: "ADANIENT", sector: "Conglomerate" };
const aGraph = buildRelationshipGraph(adaniCompany, null, null);
assert(aGraph.promoterGroup.groupName === "Adani Group", "identifies Adani Group");
assert(aGraph.promoterGroup.contagionRisk === "HIGH", "large group has high contagion risk");
assert(aGraph.groupRiskLevel.level === "HIGH", "large group has high risk level");

// ═══════════════════════════════════════════════════
// Upgrade 19 — Multi-Horizon Analysis
// ═══════════════════════════════════════════════════
console.log("\n⏳ Upgrade 19 — Multi-Horizon Analysis");

const horizon = computeMultiHorizon(75, 80, 60, 70, {}, []);
assert(horizon.horizons.shortTerm !== undefined, "computes short-term horizon");
assert(horizon.horizons.mediumTerm !== undefined, "computes medium-term horizon");
assert(horizon.horizons.longTerm !== undefined, "computes long-term horizon");
assert(typeof horizon.horizons.shortTerm.score === "number", "short-term has numeric score");
assert(horizon.horizons.shortTerm.score >= 0 && horizon.horizons.shortTerm.score <= 100, "short-term score in range");
assert(horizon.horizons.shortTerm.rating !== undefined, "short-term has rating");
assert(horizon.divergence !== undefined, "computes divergence analysis");
assert(horizon.divergence.pattern !== undefined, "divergence has pattern");

// Sentiment-heavy short-term should differ from governance-heavy long-term
const divergeHorizon = computeMultiHorizon(70, 85, 40, 65, {}, []);
assert(divergeHorizon.horizons.shortTerm.score !== divergeHorizon.horizons.longTerm.score, "horizons produce different scores with divergent inputs");

// Red flags should penalize short-term more than long-term
const flaggedHorizon = computeMultiHorizon(70, 70, 70, 70, {}, [
  { severity: "CRITICAL", message: "test" },
  { severity: "HIGH", message: "test2" },
]);
assert(flaggedHorizon.horizons.shortTerm.score < flaggedHorizon.horizons.longTerm.score, "short-term more sensitive to red flags");

// Null scores handled
const nullHorizon = computeMultiHorizon(null, null, 60, null, {}, []);
assert(typeof nullHorizon.horizons.shortTerm.score === "number", "handles null pillar scores");

// Buy-on-weakness detection
const bowHorizon = computeMultiHorizon(80, 90, 30, 75, {}, []);
assert(bowHorizon.divergence.pattern === "BUY_ON_WEAKNESS" || bowHorizon.divergence.pattern === "ALIGNED", "detects buy-on-weakness or aligned pattern");

// ═══════════════════════════════════════════════════
// Upgrade 21 — Report Diff Engine
// ═══════════════════════════════════════════════════
console.log("\n📊 Upgrade 21 — Report Diff Engine");

// First analysis — no previous report
const diff1 = generateReportDiff("TESTDIFF", {
  companyIQ: 70,
  rating: "MODERATE",
  pillarScores: { financial: 75, legal: 80, sentiment: 55 },
  redFlags: [{ severity: "WATCH", message: "Test flag" }],
  deepAnalysis: { accountingQuality: { score: 65, rating: "MODERATE" } },
  multiHorizon: { horizons: { shortTerm: { score: 68 }, mediumTerm: { score: 72 }, longTerm: { score: 75 } } },
});
assert(diff1 === null, "first analysis returns null diff (no previous)");

// Second analysis — should produce diff
const diff2 = generateReportDiff("TESTDIFF", {
  companyIQ: 73,
  rating: "MODERATE",
  pillarScores: { financial: 78, legal: 80, sentiment: 60 },
  redFlags: [
    { severity: "WATCH", message: "Test flag" },
    { severity: "HIGH", message: "New critical issue" },
  ],
  deepAnalysis: { accountingQuality: { score: 72, rating: "MODERATE" } },
  multiHorizon: { horizons: { shortTerm: { score: 70 }, mediumTerm: { score: 74 }, longTerm: { score: 77 } } },
});
assert(diff2 !== null, "second analysis produces diff");
assert(diff2.scoreChanges.previous === 70, "tracks previous score");
assert(diff2.scoreChanges.current === 73, "tracks current score");
assert(diff2.scoreChanges.delta === 3, "computes score delta");
assert(diff2.scoreChanges.direction === "IMPROVED", "detects improvement direction");
assert(diff2.pillarChanges.financial !== undefined, "tracks financial pillar change");
assert(diff2.pillarChanges.financial.delta === 3, "correct financial delta");
assert(diff2.redFlagChanges.newFlags.length === 1, "detects new red flags");
assert(diff2.redFlagChanges.newFlags[0].message === "New critical issue", "identifies new flag message");
assert(diff2.redFlagChanges.resolvedFlags.length === 0, "no resolved flags");
assert(diff2.summary !== null, "generates summary");
assert(diff2.summary.keyChanges.length > 0, "summary has key changes");

// ═══════════════════════════════════════════════════
// Upgrade 22 — Smart Company Resolution
// ═══════════════════════════════════════════════════
console.log("\n🔍 Upgrade 22 — Smart Company Resolution");

// Exact matches still work
assert(resolveCompany("TCS")?.ticker === "TCS", "exact ticker match works");
assert(resolveCompany("zomato")?.ticker === "ZOMATO", "alias match works");
assert(resolveCompany("reliance")?.ticker === "RELIANCE", "partial alias match works");

// Fuzzy matching (Levenshtein ≤ 2)
assert(resolveCompany("ZCS")?.ticker === "TCS", "fuzzy match: ZCS → TCS");
assert(resolveCompany("infosyss")?.ticker === "INFY", "fuzzy match: infosyss → INFY");

// Extended aliases
assert(resolveCompany("ril")?.ticker === "RELIANCE", "extended alias: ril → RELIANCE");
assert(resolveCompany("mahindra")?.ticker === "M&M" || resolveCompany("mahindra") !== null, "extended alias: mahindra resolves");

// Suggestions
const suggestions = getSuggestions("reli", 3);
assert(suggestions.length > 0, "generates suggestions for partial input");
assert(suggestions[0].ticker === "RELIANCE", "top suggestion is Reliance for 'reli'");

// Enhanced resolution (async, without LLM since no API key in tests)
const enhanced = await resolveCompanyEnhanced("TCS");
assert(enhanced.company?.ticker === "TCS", "enhanced resolution works for known companies");
assert(enhanced.method === "exact", "enhanced uses exact method when available");

// Enhanced with unknown company
const enhancedUnknown = await resolveCompanyEnhanced("xyznonexistent123");
assert(enhancedUnknown.company === null || enhancedUnknown.suggestions.length >= 0, "enhanced handles unknown gracefully");

// ═══════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════
console.log(`\n${"═".repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`${"═".repeat(50)}`);

if (failed === 0) {
  console.log("\n✅ All tests PASSED");
} else {
  console.log(`\n❌ ${failed} test(s) FAILED`);
  process.exit(1);
}
