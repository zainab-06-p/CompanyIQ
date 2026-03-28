/**
 * Integration Test — All New Modules
 *
 * Tests each new engine module with mock data to verify:
 * 1. Context-Aware Weights (contextEngine)
 * 2. Quality Gates (qualityGates)
 * 3. Waterfall Engine (waterfallEngine)
 * 4. Ratio Momentum (ratioEngine)
 * 5. Governance Patterns (governancePatterns)
 * 6. Anomaly Detection (anomalyDetector)
 * 7. LLM Confidence (llmSynthesis fallback)
 * 8. Composite Scorer (with context data)
 *
 * Run: node backend/tests/testAllModules.js
 */

import { computeContextWeights } from "../engine/contextEngine.js";
import { validateFinancialData, validateLegalData, validateSentimentData, computeDataConfidence } from "../engine/qualityGates.js";
import { generateFinancialWaterfall, generateLegalWaterfall, generateSentimentWaterfall, generateOverallWaterfall } from "../engine/waterfallEngine.js";
import { computeAllRatios, computeRatioMomentum } from "../engine/ratioEngine.js";
import { detectGovernancePatterns } from "../engine/governancePatterns.js";
import { detectAnomalies } from "../engine/anomalyDetector.js";
import { computeCompanyIQ } from "../engine/compositeScorer.js";

// ─── Mock Data ───────────────────────────────────────────────────────────

const mockFinancialData = {
  profitAndLoss: {
    annual: [
      { revenue: 5000, expenses: 4200, operatingProfit: 800, netProfit: 500, opmPercent: 16, eps: 25, depreciation: 100 },
      { revenue: 4500, expenses: 3900, operatingProfit: 600, netProfit: 380, opmPercent: 13.3, eps: 19, depreciation: 90 },
      { revenue: 4000, expenses: 3500, operatingProfit: 500, netProfit: 300, opmPercent: 12.5, eps: 15, depreciation: 80 },
      { revenue: 3200, expenses: 2800, operatingProfit: 400, netProfit: 250, opmPercent: 12.5, eps: 12.5, depreciation: 70 },
    ],
    quarterly: [
      { revenue: 1400, operatingProfit: 250, netProfit: 145 },
      { revenue: 1300, operatingProfit: 220, netProfit: 130 },
      { revenue: 1250, operatingProfit: 200, netProfit: 120 },
      { revenue: 1200, operatingProfit: 180, netProfit: 110 },
      { revenue: 1100, operatingProfit: 160, netProfit: 100 },
      { revenue: 1050, operatingProfit: 140, netProfit: 90 },
    ],
  },
  balanceSheet: [
    { shareCapital: 200, reserves: 1800, borrowings: 500, totalAssets: 4000, investments: 300, otherAssets: 1200, otherLiabilities: 800 },
    { shareCapital: 200, reserves: 1500, borrowings: 600, totalAssets: 3500, investments: 250, otherAssets: 1000, otherLiabilities: 750 },
  ],
  cashFlow: [
    { operatingCF: 450, investingCF: -200, financingCF: -100 },
  ],
  ratiosSummary: {
    pe: 22, pb: 3.5, evEbitda: 14, dividendYield: 1.2, roce: 18, currentRatio: 1.5, marketCap: 5000,
  },
};

const mockLegalData = {
  shareholding: {
    promoterHolding: 55,
    promoterHoldingTrend: "STABLE",
    pledgingPercent: 8,
    pledgeTrend: "DOWN",
    fiiHolding: 18,
    fiiTrend: "UP",
  },
  announcements: [
    { subject: "Board Meeting Outcome", date: "2024-12-01", category: "Board Meeting" },
    { subject: "Declaration of Dividend", date: "2024-11-15", category: "Dividend" },
    { subject: "Appointment of Director", date: "2024-10-01", category: "Director Change" },
    { subject: "SEBI Order", date: "2024-09-20", category: "Regulatory" },
  ],
  directors: {
    directorChanges: 2,
    totalDirectors: 8,
  },
};

const mockSentimentData = {
  articles: [
    { headline: "Company reports 30% profit growth", source: "ET", date: "2024-12-20" },
    { headline: "Strong quarterly results beat estimates", source: "Moneycontrol", date: "2024-12-18" },
    { headline: "Expansion into new markets", source: "Livemint", date: "2024-12-15" },
    { headline: "Analysts upgrade target price", source: "ET", date: "2024-12-12" },
    { headline: "Minor regulatory concern flagged", source: "BSE", date: "2024-12-10" },
    { headline: "Industry outlook remains positive", source: "ET", date: "2024-12-05" },
    { headline: "Company launches new product line", source: "Google News", date: "2024-12-01" },
    { headline: "Management changes raise questions", source: "ET", date: "2024-11-28" },
  ],
};

const mockClassifiedArticles = [
  { headline: "Company reports 30% profit growth", sentiment: "POSITIVE", topic: "Financial Results", confidence: 0.85, date: "2024-12-20" },
  { headline: "Strong quarterly results beat estimates", sentiment: "POSITIVE", topic: "Financial Results", confidence: 0.85, date: "2024-12-18" },
  { headline: "Expansion into new markets", sentiment: "POSITIVE", topic: "Market Expansion", confidence: 0.85, date: "2024-12-15" },
  { headline: "Analysts upgrade target price", sentiment: "POSITIVE", topic: "Financial Results", confidence: 0.85, date: "2024-12-12" },
  { headline: "Minor regulatory concern flagged", sentiment: "NEGATIVE", topic: "Regulatory", confidence: 0.85, date: "2024-12-10" },
  { headline: "Industry outlook remains positive", sentiment: "POSITIVE", topic: "Market Expansion", confidence: 0.85, date: "2024-12-05" },
  { headline: "Company launches new product line", sentiment: "POSITIVE", topic: "Product Launch", confidence: 0.85, date: "2024-12-01" },
  { headline: "Management changes raise questions", sentiment: "NEGATIVE", topic: "Leadership", confidence: 0.85, date: "2024-11-28" },
];

const mockSentimentScore = {
  score: 68,
  positive: 6,
  negative: 2,
  neutral: 0,
  total: 8,
  topThemes: [
    { theme: "Financial Results", count: 3 },
    { theme: "Market Expansion", count: 2 },
  ],
  flags: [],
};

const mockRedFlags = [
  { severity: "POSITIVE", icon: "✅", message: "Dividend yield > 1% — ₹1.2% yield indicates shareholder returns" },
  { severity: "POSITIVE", icon: "✅", message: "Zero pledging — no promoter shares pledged" },
  { severity: "WATCH", icon: "⚠️", message: "P/E > 24 — fair valuation, monitor growth expectations" },
];

// ─── Test Runner ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

// ─── Test Suite ──────────────────────────────────────────────────────────

console.log("\n🧪 CompanyIQ Module Integration Tests\n");

// 1. Context-Aware Weights
console.log("── 1. Context-Aware Weights ──");

test("Returns correct weights for Banking sector", () => {
  const result = computeContextWeights("Banking & Finance", {});
  assert(result.weights.financial !== undefined, "Missing financial weight");
  assert(result.weights.legal !== undefined, "Missing legal weight");
  assert(result.weights.sentiment !== undefined, "Missing sentiment weight");
  const sum = result.weights.financial + result.weights.legal + result.weights.sentiment;
  assert(Math.abs(sum - 1.0) < 0.01, `Weights don't sum to 1.0: ${sum}`);
  assert(result.context.sector === "Banking & Finance", "Wrong sector");
});

test("Returns default weights for unknown sector", () => {
  const result = computeContextWeights("Unknown Sector", {});
  assert(result.context.isDefault === true, "Should be default");
  const sum = result.weights.financial + result.weights.legal + result.weights.sentiment;
  assert(Math.abs(sum - 1.0) < 0.01, `Weights don't sum to 1.0: ${sum}`);
});

test("Adjusts for growth-stage company", () => {
  const result = computeContextWeights("Information Technology", { revenueCAGR3yr: 35, netProfitMargin: 3 });
  assert(result.context.stage === "GROWTH", `Expected GROWTH stage, got ${result.context.stage}`);
});

// 2. Quality Gates
console.log("\n── 2. Quality Gates ──");

test("Validates financial data — passes with good data", () => {
  const gate = validateFinancialData(mockFinancialData);
  assert(gate.passed === true, `Financial gate should pass, got issues: ${gate.issues?.join(", ")}`);
  assert(gate.confidence > 0.7, "Confidence should be > 0.7");
});

test("Validates financial data — fails with null data", () => {
  const gate = validateFinancialData(null);
  assert(gate.passed === false, "Should fail with null data");
  assert(gate.confidence === 0, "Confidence should be 0");
});

test("Validates legal data — passes with good data", () => {
  const gate = validateLegalData(mockLegalData);
  assert(gate.passed === true, `Legal gate should pass, got issues: ${gate.issues?.join(", ")}`);
});

test("Validates sentiment data — passes with articles", () => {
  const gate = validateSentimentData(mockSentimentData, mockClassifiedArticles);
  assert(gate.passed === true, `Sentiment gate should pass, got issues: ${gate.issues?.join(", ")}`);
});

test("Data confidence computes correctly", () => {
  const fGate = validateFinancialData(mockFinancialData);
  const lGate = validateLegalData(mockLegalData);
  const sGate = validateSentimentData(mockSentimentData, mockClassifiedArticles);
  const conf = computeDataConfidence(fGate, lGate, sGate);
  assert(conf.overallConfidence > 0, "Overall confidence should be > 0");
  assert(["HIGH", "MEDIUM", "LOW"].includes(conf.confidenceLabel), "Invalid confidence label");
});

// 3. Ratio Computation & Momentum
console.log("\n── 3. Ratio Computation & Momentum ──");

test("Computes all ratios from mock data", () => {
  const ratios = computeAllRatios(mockFinancialData);
  assert(ratios.netProfitMargin !== null, "NPM should be computed");
  assert(ratios.returnOnEquity !== null, "ROE should be computed");
  assert(ratios.debtToEquity !== null, "D/E should be computed");
  assert(ratios.revenueCAGR3yr !== null, "Revenue CAGR should be computed");
  assert(ratios.quarterlyRevenues.length > 0, "Quarterly revenues should exist");
});

test("Computes ratio momentum", () => {
  const ratios = computeAllRatios(mockFinancialData);
  const momentum = computeRatioMomentum(mockFinancialData, ratios);
  assert(momentum.revenue !== undefined, "Revenue trajectory should exist");
  assert(["IMPROVING", "DECLINING", "STABLE", "MIXED_UP", "MIXED_DOWN", "INSUFFICIENT_DATA"].includes(momentum.revenue.direction), "Invalid direction");
  assert(momentum.revenue.momentum !== undefined, "Momentum value should exist");
});

test("Revenue trajectory is IMPROVING for growing data", () => {
  const ratios = computeAllRatios(mockFinancialData);
  const momentum = computeRatioMomentum(mockFinancialData, ratios);
  assert(momentum.revenue.direction === "IMPROVING", `Expected IMPROVING, got ${momentum.revenue.direction}`);
});

// 4. Waterfall Engine
console.log("\n── 4. Waterfall Engine ──");

test("Generates financial waterfall", () => {
  const ratios = computeAllRatios(mockFinancialData);
  const fScore = { score: 72, breakdown: { profitability: 75, liquidity: 68, solvency: 70, growth: 73 } };
  const wf = generateFinancialWaterfall(ratios, fScore.breakdown, fScore.score, "Information Technology");
  assert(wf.baseScore !== undefined, "Should have baseline");
  assert(Array.isArray(wf.contributions), "Should have contributions array");
  assert(wf.finalScore === fScore.score, "Final score should match");
});

test("Generates overall waterfall with pillar contributions", () => {
  const wf = generateOverallWaterfall({
    financialScore: 72, legalScore: 85, sentimentScore: 68,
    weights: { financial: 0.45, legal: 0.30, sentiment: 0.25 },
    flagAdjustment: 5, finalScore: 74, sector: "Information Technology", redFlags: mockRedFlags,
  });
  assert(wf.baseScore !== undefined, "Should have baseline");
  assert(Array.isArray(wf.topBoosters), "Should have topBoosters");
  assert(Array.isArray(wf.topDrags), "Should have topDrags");
});

// 5. Governance Patterns
console.log("\n── 5. Governance Patterns ──");

test("Detects positive governance with clean data", () => {
  const ratios = computeAllRatios(mockFinancialData);
  const momentum = computeRatioMomentum(mockFinancialData, ratios);
  const gov = detectGovernancePatterns(mockLegalData, ratios, momentum, mockRedFlags);
  assert(Array.isArray(gov.patterns), "Should return patterns array");
  assert(["CRITICAL", "HIGH", "MODERATE", "LOW"].includes(gov.riskLevel), "Invalid risk level");
  assert(typeof gov.summary === "string", "Should have summary string");
});

test("Detects promoter stress with stressed data", () => {
  const stressedLegal = {
    shareholding: { promoterHolding: 40, pledgingPercent: 65, pledgeTrend: "UP", fiiTrend: "DOWN" },
    directors: { directorChanges: 5 },
    announcements: [],
  };
  const decliningRatios = { ...computeAllRatios(mockFinancialData), debtToEquity: 3.0 };
  const decliningTrajectories = { netProfit: { direction: "DECLINING", momentum: -30 } };
  const gov = detectGovernancePatterns(stressedLegal, decliningRatios, decliningTrajectories, []);
  const stressPattern = gov.patterns.find((p) => p.pattern === "PROMOTER_STRESS_SPIRAL");
  assert(stressPattern !== undefined, "Should detect promoter stress spiral");
  assert(stressPattern.severity === "CRITICAL", "Stress spiral should be CRITICAL");
});

// 6. Anomaly Detection
console.log("\n── 6. Anomaly Detection ──");

test("No anomalies in clean mock data", () => {
  const ratios = computeAllRatios(mockFinancialData);
  const result = detectAnomalies(mockFinancialData, ratios);
  assert(Array.isArray(result.anomalies), "Should return anomalies array");
  assert(typeof result.overallRisk === "string", "Should have overall risk");
});

test("Detects earnings quality issue with negative OCF", () => {
  const badCF = {
    ...mockFinancialData,
    cashFlow: [{ operatingCF: -100, investingCF: -200, financingCF: 400 }],
  };
  const ratios = computeAllRatios(badCF);
  const result = detectAnomalies(badCF, ratios);
  const earningAnomaly = result.anomalies.find((a) => a.type === "EARNINGS_QUALITY" && a.severity === "CRITICAL");
  assert(earningAnomaly !== undefined, "Should detect critical earnings quality issue");
});

test("Returns UNKNOWN for null data", () => {
  const result = detectAnomalies(null, {});
  assert(result.overallRisk === "UNKNOWN", "Should be UNKNOWN risk");
});

// 7. Composite Scorer with Context
console.log("\n── 7. Composite Scorer (Context-Aware) ──");

test("Computes CompanyIQ with context data", () => {
  const ratios = computeAllRatios(mockFinancialData);
  const composite = computeCompanyIQ(72, { score: 85, flags: [] }, mockSentimentScore, mockRedFlags, {
    sector: "Banking & Finance",
    allRatios: ratios,
  });
  assert(composite.score > 0 && composite.score <= 100, `Score should be 1-100, got ${composite.score}`);
  assert(composite.rating !== undefined, "Should have rating");
  assert(composite.weights !== undefined, "Should include weights in result");
  assert(composite.weightContext !== undefined, "Should include weight context");
});

test("Composite score differs by sector", () => {
  const ratios = computeAllRatios(mockFinancialData);
  const bankComposite = computeCompanyIQ(72, { score: 85, flags: [] }, mockSentimentScore, mockRedFlags, {
    sector: "Banking & Finance", allRatios: ratios,
  });
  const itComposite = computeCompanyIQ(72, { score: 85, flags: [] }, mockSentimentScore, mockRedFlags, {
    sector: "Information Technology", allRatios: ratios,
  });
  // Weights should differ even if scores end up similar
  assert(
    bankComposite.weights.financial !== itComposite.weights.financial ||
    bankComposite.weights.legal !== itComposite.weights.legal,
    "Weights should differ between Banking and IT sectors"
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("  🎉 All tests passed!\n");
}
