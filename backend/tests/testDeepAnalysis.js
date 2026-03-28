/**
 * Comprehensive Test Suite for 12 Deep Analysis Modules
 *
 * Tests all modules with mock TCS-like Indian company data.
 * Run: node tests/testDeepAnalysis.js
 */

import { computeAccountingQuality } from "../engine/accountingQuality.js";
import { computeCapitalAllocation } from "../engine/capitalAllocation.js";
import { computeManagementQuality } from "../engine/managementQuality.js";
import { computeMoatAnalysis } from "../engine/moatAnalysis.js";
import { computeESGAnalysis } from "../engine/esgAnalysis.js";
import { computeShareholdingAnalysis } from "../engine/shareholdingAnalysis.js";
import { computeCreditAnalysis } from "../engine/creditAnalysis.js";
import { computeTechInnovation } from "../engine/techInnovation.js";
import { computeSupplyChainRisk } from "../engine/supplyChainRisk.js";
import { computeValuation } from "../engine/valuationEngine.js";
import { computeInsiderTracking } from "../engine/insiderTracking.js";
import { computeIndustryKPIs } from "../engine/industryKPIs.js";

// ─── Mock Data (TCS-like IT company) ────────────────────────────────────

const mockFinancialData = {
  profitAndLoss: {
    annual: [
      { revenue: 240893, operatingProfit: 64558, netProfit: 46099, depreciation: 5520,
        employeeCost: 138000, rawMaterial: 0, manufacturingExpenses: 0, otherExpenses: 32815,
        interestExpense: 120, otherIncome: 5200, sellingExpenses: 2400,
        researchAndDevelopment: 4800 },
      { revenue: 225458, operatingProfit: 59372, netProfit: 42147, depreciation: 5100,
        employeeCost: 130000, rawMaterial: 0, manufacturingExpenses: 0, otherExpenses: 30886,
        interestExpense: 110, otherIncome: 4800, sellingExpenses: 2200,
        researchAndDevelopment: 4200 },
      { revenue: 195000, operatingProfit: 52000, netProfit: 38000, depreciation: 4800,
        employeeCost: 118000, rawMaterial: 0, manufacturingExpenses: 0, otherExpenses: 24000,
        interestExpense: 100, otherIncome: 4200, sellingExpenses: 2000 },
      { revenue: 165000, operatingProfit: 42000, netProfit: 30000, depreciation: 4200,
        employeeCost: 105000, rawMaterial: 0, manufacturingExpenses: 0, otherExpenses: 18000,
        interestExpense: 90, otherIncome: 3500 },
    ],
  },
  balanceSheet: [
    { totalAssets: 120000, shareCapital: 365, reserves: 89000, borrowings: 1200,
      currentAssets: 72000, currentLiabilities: 45000, fixedAssets: 22000, netBlock: 22000,
      tradeReceivables: 42000, inventory: 0, tradepayables: 12000,
      cashAndEquivalents: 15000, otherLiabilities: 800, longTermBorrowings: 800,
      shortTermBorrowings: 400, totalAssets: 120000 },
    { totalAssets: 110000, shareCapital: 365, reserves: 82000, borrowings: 1100,
      currentAssets: 66000, currentLiabilities: 40000, fixedAssets: 20000, netBlock: 20000,
      tradeReceivables: 38000, inventory: 0, tradepayables: 11000,
      cashAndEquivalents: 13000, otherLiabilities: 700, longTermBorrowings: 700,
      shortTermBorrowings: 400 },
    { totalAssets: 95000, shareCapital: 365, reserves: 72000, borrowings: 950,
      currentAssets: 58000, currentLiabilities: 35000, fixedAssets: 17000,
      cashAndEquivalents: 11000 },
  ],
  cashFlow: [
    { cashFromOperations: 52000, purchaseOfFixedAssets: -6000, repaymentOfBorrowings: -300 },
    { cashFromOperations: 48000, purchaseOfFixedAssets: -5500, repaymentOfBorrowings: -250 },
    { cashFromOperations: 40000, purchaseOfFixedAssets: -4800 },
  ],
};

const mockLegalData = {
  shareholding: {
    promoterHolding: 72.3, promoter: 72.3,
    fii: 12.5, fpiHolding: 12.5,
    dii: 8.5, diiHolding: 8.5,
    mutualFundHolding: 5.2,
    publicHolding: 6.7, public: 6.7,
    pledgePercent: 0, pledge: 0,
    quarterly: [
      { promoter: 72.3, fii: 12.5, dii: 8.5, pledge: 0 },
      { promoter: 72.1, fii: 12.2, dii: 8.8, pledge: 0 },
      { promoter: 72.0, fii: 11.8, dii: 9.0, pledge: 0 },
    ],
  },
  announcements: [
    { date: "2024-12-15", subject: "Board Meeting - Quarterly Results", category: "Board Meeting" },
    { date: "2024-11-20", subject: "New deal win with major US client", category: "General" },
    { date: "2024-10-05", subject: "Appointment of Independent Director Mrs. Sharma", category: "Director Change" },
    { date: "2024-09-15", subject: "Digital transformation partnership with Cloud provider", category: "General" },
    { date: "2024-08-10", subject: "CSR spending report - exceeds 2% mandate", category: "CSR" },
    { date: "2024-07-01", subject: "Annual sustainability and BRSR report filed", category: "ESG" },
    { date: "2024-06-15", subject: "New patent filed for AI-based testing framework", category: "General" },
  ],
  directors: [
    { name: "Mr. N Chandrasekaran", designation: "Chairman (Non-Executive)" },
    { name: "Mr. K Krithivasan", designation: "CEO and Managing Director" },
    { name: "Mrs. Hanne Sorensen", designation: "Independent Director" },
    { name: "Mr. O P Bhatt", designation: "Independent Director" },
    { name: "Mrs. Aarthi Subramanian", designation: "Executive Director" },
    { name: "Dr. Pradeep Kumar Khosla", designation: "Independent Director" },
    { name: "Mr. Aman Mehta", designation: "Independent Director" },
  ],
};

const mockAllRatios = {
  profitability: { operatingMargin: 26.8, netMargin: 19.1, roe: 51.5, roce: 58.2 },
  liquidity: { currentRatio: 1.6, quickRatio: 1.6 },
  leverage: { debtToEquity: 0.013, interestCoverage: 538 },
  valuation: { pe: 30, pb: 14 },
};

const sector = "Information Technology";

// ─── Test Runner ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

// ─── Module 1: Accounting Quality ───────────────────────────────────────
console.log("\n📊 Module 1 — Accounting Quality");

test("produces valid composite score", () => {
  const result = computeAccountingQuality(mockFinancialData, mockAllRatios);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.rating === "string", "Missing rating");
});

test("computes Piotroski F-Score", () => {
  const result = computeAccountingQuality(mockFinancialData, mockAllRatios);
  assert(result.fScore !== undefined, "Missing F-Score");
  assert(result.fScore.score >= 0 && result.fScore.score <= 9, "F-Score out of range");
});

test("computes Beneish M-Score", () => {
  const result = computeAccountingQuality(mockFinancialData, mockAllRatios);
  assert(result.mScore !== undefined, "Missing M-Score");
  assert(typeof result.mScore.score === "number" || result.mScore.score === null, "Invalid M-Score type");
});

test("handles null financial data gracefully", () => {
  const result = computeAccountingQuality(null, {});
  assert(result.score >= 0 && result.score <= 100, "Should handle null data");
});

// ─── Module 2: Capital Allocation ───────────────────────────────────────
console.log("\n💰 Module 2 — Capital Allocation");

test("produces valid composite score", () => {
  const result = computeCapitalAllocation(mockFinancialData, mockAllRatios, sector);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.rating === "string", "Missing rating");
});

test("computes ROIC analysis", () => {
  const result = computeCapitalAllocation(mockFinancialData, mockAllRatios, sector);
  assert(result.roicAnalysis !== undefined, "Missing ROIC analysis");
});

test("computes capex analysis", () => {
  const result = computeCapitalAllocation(mockFinancialData, mockAllRatios, sector);
  assert(result.capexAnalysis !== undefined, "Missing capex analysis");
});

// ─── Module 3: Management Quality ───────────────────────────────────────
console.log("\n👔 Module 3 — Management Quality");

test("produces valid composite score", () => {
  const result = computeManagementQuality(mockFinancialData, mockLegalData, mockAllRatios);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.rating === "string", "Missing rating");
});

test("analyzes RPT transactions", () => {
  const result = computeManagementQuality(mockFinancialData, mockLegalData, mockAllRatios);
  assert(result.rptAnalysis !== undefined, "Missing RPT analysis");
  assert(typeof result.rptAnalysis.totalRPTs === "number", "Missing RPT count");
});

test("assesses promoter risk", () => {
  const result = computeManagementQuality(mockFinancialData, mockLegalData, mockAllRatios);
  assert(result.promoterRisk !== undefined, "Missing promoter risk");
  assert(typeof result.promoterRisk.overallRisk === "string", "Missing overall risk rating");
});

test("handles empty legal data", () => {
  const result = computeManagementQuality(mockFinancialData, {}, mockAllRatios);
  assert(result.score >= 0 && result.score <= 100, "Should handle empty legal data");
});

// ─── Module 4: Moat Analysis ────────────────────────────────────────────
console.log("\n🏰 Module 4 — Moat Analysis");

test("produces valid composite score with trajectory", () => {
  const result = computeMoatAnalysis(mockFinancialData, mockAllRatios, sector);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(["WIDE_MOAT", "NARROW_MOAT", "FRAGILE_MOAT", "NO_MOAT"].includes(result.rating), "Invalid moat rating");
  assert(typeof result.moatTrajectory === "string", "Missing trajectory");
});

test("scores 5 moat sources", () => {
  const result = computeMoatAnalysis(mockFinancialData, mockAllRatios, sector);
  assert(result.moatSources, "Missing moat sources");
  assert(result.moatSources.switchingCosts?.score >= 0, "Missing switching costs");
  assert(result.moatSources.networkEffects?.score >= 0, "Missing network effects");
  assert(result.moatSources.costAdvantage?.score >= 0, "Missing cost advantage");
});

test("estimates Porter's 5 Forces", () => {
  const result = computeMoatAnalysis(mockFinancialData, mockAllRatios, sector);
  assert(result.porterForces, "Missing Porter forces");
  assert(result.porterForces.rivalry, "Missing rivalry analysis");
});

// ─── Module 5: ESG Analysis ─────────────────────────────────────────────
console.log("\n🌱 Module 5 — ESG Analysis");

test("produces valid composite with G/S/E breakdown", () => {
  const result = computeESGAnalysis(mockFinancialData, mockLegalData, sector);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(result.governance?.score >= 0, "Missing governance score");
  assert(result.social?.score >= 0, "Missing social score");
  assert(result.environmental?.score >= 0, "Missing environmental score");
});

test("detects board independence", () => {
  const result = computeESGAnalysis(mockFinancialData, mockLegalData, sector);
  assert(result.governance.independentDirectors >= 3, "Should detect independent directors");
});

test("detects CEO-Chair separation", () => {
  const result = computeESGAnalysis(mockFinancialData, mockLegalData, sector);
  assert(result.governance.ceoChairSeparated === true, "TCS CEO ≠ Chairman");
});

// ─── Module 6: Shareholding Analysis ────────────────────────────────────
console.log("\n📈 Module 6 — Shareholding Analysis");

test("produces valid composite score", () => {
  const result = computeShareholdingAnalysis(mockLegalData);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.rating === "string", "Missing rating");
});

test("analyzes ownership structure", () => {
  const result = computeShareholdingAnalysis(mockLegalData);
  assert(result.ownership?.structure?.promoter === 72.3, "Wrong promoter holding");
});

test("detects shareholding velocity", () => {
  const result = computeShareholdingAnalysis(mockLegalData);
  assert(result.velocity, "Missing velocity analysis");
  assert(typeof result.velocity.promoterTrend === "string", "Missing promoter trend");
});

test("computes concentration HHI", () => {
  const result = computeShareholdingAnalysis(mockLegalData);
  assert(result.concentration?.hhi > 0, "Missing HHI");
});

// ─── Module 7: Credit Analysis ──────────────────────────────────────────
console.log("\n🏛️ Module 7 — Credit Analysis");

test("produces valid score with synthetic rating", () => {
  const result = computeCreditAnalysis(mockFinancialData, mockAllRatios);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.syntheticRating === "string", "Missing synthetic rating");
  assert(["AAA", "AA", "A", "BBB", "BB", "B", "CCC"].includes(result.syntheticRating), "Invalid rating");
});

test("analyzes working capital quality", () => {
  const result = computeCreditAnalysis(mockFinancialData, mockAllRatios);
  assert(result.workingCapital, "Missing working capital");
  assert(result.workingCapital.currentRatio > 0, "Missing current ratio");
});

test("computes DSCR and ICR", () => {
  const result = computeCreditAnalysis(mockFinancialData, mockAllRatios);
  assert(result.coverage, "Missing coverage ratios");
});

// ─── Module 8: Tech & Innovation ────────────────────────────────────────
console.log("\n🔬 Module 8 — Tech & Innovation");

test("produces valid composite score", () => {
  const result = computeTechInnovation(mockFinancialData, mockLegalData, sector);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.rating === "string", "Missing rating");
});

test("analyzes R&D intensity", () => {
  const result = computeTechInnovation(mockFinancialData, mockLegalData, sector);
  assert(result.rdAnalysis, "Missing R&D analysis");
  assert(result.rdAnalysis.latestIntensity > 0, "Should detect R&D spending");
});

test("detects patent signals", () => {
  const result = computeTechInnovation(mockFinancialData, mockLegalData, sector);
  assert(result.patentSignals, "Missing patent signals");
  assert(result.patentSignals.totalPatentSignals >= 1, "Should detect patent announcement");
});

test("detects digital signals", () => {
  const result = computeTechInnovation(mockFinancialData, mockLegalData, sector);
  assert(result.digitalSignals, "Missing digital signals");
});

// ─── Module 9: Supply Chain Risk ────────────────────────────────────────
console.log("\n🔗 Module 9 — Supply Chain Risk");

test("produces valid composite score", () => {
  const result = computeSupplyChainRisk(mockFinancialData, mockLegalData, sector);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.rating === "string", "Missing rating");
});

test("analyzes revenue concentration", () => {
  const result = computeSupplyChainRisk(mockFinancialData, mockLegalData, sector);
  assert(result.revenueConcentration, "Missing revenue concentration");
});

test("analyzes regulatory risk", () => {
  const result = computeSupplyChainRisk(mockFinancialData, mockLegalData, sector);
  assert(result.regulatoryRisk, "Missing regulatory risk");
});

test("analyzes operational efficiency", () => {
  const result = computeSupplyChainRisk(mockFinancialData, mockLegalData, sector);
  assert(result.operationalEfficiency, "Missing operational efficiency");
  assert(result.operationalEfficiency.assetTurnover > 0, "Should compute asset turnover");
});

// ─── Module 10: Valuation Engine ────────────────────────────────────────
console.log("\n💎 Module 10 — Valuation Engine");

test("produces valid composite score", () => {
  const result = computeValuation(mockFinancialData, mockAllRatios, sector);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.rating === "string", "Missing rating");
});

test("computes DCF with 3 scenarios", () => {
  const result = computeValuation(mockFinancialData, mockAllRatios, sector);
  assert(result.dcf, "Missing DCF");
  assert(result.dcf.scenarios?.bull, "Missing bull scenario");
  assert(result.dcf.scenarios?.base, "Missing base scenario");
  assert(result.dcf.scenarios?.bear, "Missing bear scenario");
});

test("computes EPV with franchise value", () => {
  const result = computeValuation(mockFinancialData, mockAllRatios, sector);
  assert(result.epv, "Missing EPV");
  assert(result.epv.epvEnterprise > 0, "EPV should be positive for profitable company");
});

test("computes relative valuation", () => {
  const result = computeValuation(mockFinancialData, mockAllRatios, sector);
  assert(result.relativeValuation, "Missing relative valuation");
  assert(result.relativeValuation.sectorBenchmarks, "Missing sector benchmarks");
});

test("computes margin of safety", () => {
  const result = computeValuation(mockFinancialData, mockAllRatios, sector);
  assert(result.marginOfSafety, "Missing margin of safety");
  assert(typeof result.marginOfSafety.conviction === "string", "Missing conviction level");
});

// ─── Module 11: Insider Tracking ────────────────────────────────────────
console.log("\n🔍 Module 11 — Insider Tracking");

test("produces valid composite score", () => {
  const result = computeInsiderTracking(mockLegalData, mockFinancialData);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.rating === "string", "Missing rating");
});

test("analyzes insider activity", () => {
  const result = computeInsiderTracking(mockLegalData, mockFinancialData);
  assert(result.insiderActivity, "Missing insider activity");
  assert(typeof result.insiderActivity.sentiment === "string", "Missing sentiment");
});

test("assesses institutional quality", () => {
  const result = computeInsiderTracking(mockLegalData, mockFinancialData);
  assert(result.institutionalQuality, "Missing institutional quality");
  assert(typeof result.institutionalQuality.qualityTier === "string", "Missing quality tier");
});

test("analyzes pledge risk", () => {
  const result = computeInsiderTracking(mockLegalData, mockFinancialData);
  assert(result.pledgeAnalysis, "Missing pledge analysis");
  assert(result.pledgeAnalysis.pledgePercent === 0, "TCS should have 0 pledge");
  assert(result.pledgeAnalysis.riskLevel === "NONE", "Should be NONE pledge risk");
});

// ─── Module 12: Industry KPIs ───────────────────────────────────────────
console.log("\n🏭 Module 12 — Industry KPIs");

test("auto-detects IT sector", () => {
  const result = computeIndustryKPIs(mockFinancialData, mockLegalData, mockAllRatios, sector);
  assert(result.detectedSector === "IT", `Expected IT, got ${result.detectedSector}`);
  assert(result.kpiType === "IT_SERVICES", "Should use IT KPI module");
});

test("produces valid sector score", () => {
  const result = computeIndustryKPIs(mockFinancialData, mockLegalData, mockAllRatios, sector);
  assert(result.score >= 0 && result.score <= 100, `Score ${result.score} not in range`);
  assert(typeof result.rating === "string", "Missing rating");
});

test("detects IT-specific KPIs", () => {
  const result = computeIndustryKPIs(mockFinancialData, mockLegalData, mockAllRatios, sector);
  assert(result.kpis, "Missing KPIs");
  assert(result.kpis.revenueGrowth !== undefined, "Missing revenue growth");
  assert(result.kpis.operatingMargin !== undefined, "Missing OPM");
});

test("works with banking sector", () => {
  const bankingFin = { profitAndLoss: { annual: [
    { revenue: 50000, interestIncome: 40000, interestExpended: 25000, netProfit: 8000,
      provisions: 3000, operatingProfit: 15000, depreciation: 500 }
  ]}, balanceSheet: [{ totalAssets: 500000, advances: 300000, deposits: 400000 }] };
  const result = computeIndustryKPIs(bankingFin, {}, {}, "Banking");
  assert(result.detectedSector === "BANKING", "Should detect banking");
  assert(result.kpis.nim !== undefined, "Should compute NIM");
});

// ─── Edge Cases ─────────────────────────────────────────────────────────
console.log("\n⚠️ Edge Cases");

test("all modules handle empty objects gracefully", () => {
  const empty = {};
  const results = [
    computeAccountingQuality(empty, empty),
    computeCapitalAllocation(empty, empty, ""),
    computeManagementQuality(empty, empty, empty),
    computeMoatAnalysis(empty, empty, ""),
    computeESGAnalysis(empty, empty, ""),
    computeShareholdingAnalysis(empty),
    computeCreditAnalysis(empty, empty),
    computeTechInnovation(empty, empty, ""),
    computeSupplyChainRisk(empty, empty, ""),
    computeValuation(empty, empty, ""),
    computeInsiderTracking(empty, empty),
    computeIndustryKPIs(empty, empty, empty, ""),
  ];
  for (const r of results) {
    assert(r.score >= 0 && r.score <= 100, `Score ${r.score} out of range with empty data`);
  }
});

test("all modules handle null input gracefully", () => {
  const results = [
    computeManagementQuality(null, null, null),
    computeESGAnalysis(null, null, null),
    computeShareholdingAnalysis(null),
    computeTechInnovation(null, null, null),
    computeSupplyChainRisk(null, null, null),
    computeInsiderTracking(null, null),
    computeIndustryKPIs(null, null, null, null),
  ];
  for (const r of results) {
    assert(r.score >= 0 && r.score <= 100, `Score ${r.score} out of range with null data`);
  }
});

// ─── Summary ────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  console.log(`\n❌ ${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} tests PASSED`);
}
