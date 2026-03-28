/**
 * Module 7 — Credit & Debt Analysis
 *
 * Evaluates credit quality and debt sustainability:
 *   - Debt structure analysis (maturity, type, cost)
 *   - Debt Service Coverage Ratio (DSCR)
 *   - Interest coverage & cost of debt
 *   - Working capital quality
 *   - Cash conversion cycle
 *   - Synthetic credit rating
 *
 * Input: financialData, allRatios
 * Output: { debtStructure, dscr, workingCapital, syntheticRating, score, rating }
 */

// ─── Debt Structure Analysis ────────────────────────────────────────────

export function analyzeDebtStructure(financialData, allRatios) {
  const bs = financialData?.balanceSheet || [];
  const pl = financialData?.profitAndLoss?.annual || [];
  const cf = financialData?.cashFlow || [];

  const latest = bs[0] || {};
  const prev = bs[1] || {};

  const totalDebt = safe(latest.borrowings) + safe(latest.otherLiabilities);
  const longTermDebt = safe(latest.longTermBorrowings || latest.borrowings);
  const shortTermDebt = safe(latest.shortTermBorrowings || latest.currentLiabilities) -
    safe(latest.tradepayables || latest.tradePayables);
  const totalAssets = safe(latest.totalAssets);
  const equity = safe(latest.shareCapital) + safe(latest.reserves);

  // Debt-to-equity
  const debtToEquity = equity > 0 ? totalDebt / equity : null;

  // Debt-to-assets
  const debtToAssets = totalAssets > 0 ? totalDebt / totalAssets : null;

  // Long-term vs short-term mix (healthy = more long-term)
  const totalBorrowing = longTermDebt + Math.max(shortTermDebt, 0);
  const longTermRatio = totalBorrowing > 0 ? longTermDebt / totalBorrowing : 0.5;

  // Debt growth
  const prevDebt = safe(prev.borrowings) + safe(prev.otherLiabilities);
  const debtGrowth = prevDebt > 0 ? (totalDebt - prevDebt) / prevDebt * 100 : 0;

  let structureRating;
  if (debtToEquity !== null && debtToEquity < 0.3) structureRating = "CONSERVATIVE";
  else if (debtToEquity !== null && debtToEquity < 0.8) structureRating = "MODERATE";
  else if (debtToEquity !== null && debtToEquity < 1.5) structureRating = "LEVERAGED";
  else if (debtToEquity !== null) structureRating = "HIGHLY_LEVERAGED";
  else structureRating = "UNKNOWN";

  return {
    totalDebt: Math.round(totalDebt),
    debtToEquity: round2(debtToEquity),
    debtToAssets: round2(debtToAssets),
    longTermRatio: round2(longTermRatio),
    debtGrowth: round2(debtGrowth),
    structureRating,
  };
}

// ─── DSCR & Interest Coverage ───────────────────────────────────────────

export function analyzeCoverageRatios(financialData) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const cf = financialData?.cashFlow || [];

  const latest = pl[0] || {};
  const latestCF = cf[0] || {};

  const ebitda = safe(latest.operatingProfit) + safe(latest.depreciation);
  const interestExpense = safe(latest.interestExpense || latest.financeCharges) || 0;
  const debtRepayment = Math.abs(safe(latestCF.repaymentOfBorrowings || latestCF.debtRepayment) || 0);
  const totalDebtService = interestExpense + debtRepayment;

  // Interest Coverage Ratio (ICR)
  const icr = interestExpense > 0 ? ebitda / interestExpense : null;

  // DSCR
  const dscr = totalDebtService > 0 ? ebitda / totalDebtService : null;

  // Cost of debt (interest / total borrowings)
  const bs = financialData?.balanceSheet || [];
  const totalBorrowings = (safe(bs[0]?.borrowings) || 0) + (safe(bs[0]?.otherLiabilities) || 0);
  const costOfDebt = totalBorrowings > 0
    ? (interestExpense / totalBorrowings * 100)
    : null;

  // ── Debt-free detection ──────────────────────────────────────────────────
  // A company with negligible borrowings AND negligible interest expense is
  // debt-free — this is BETTER than STRONG coverage, not UNKNOWN.
  const isDebtFree = totalBorrowings < 100 && interestExpense < 10;

  let coverageRating;
  if (isDebtFree) {
    coverageRating = "DEBT_FREE";
    console.log(`[Credit] Debt-free detected: totalBorrowings=${totalBorrowings}, interestExpense=${interestExpense}`);
  } else if (icr !== null && icr > 5) coverageRating = "STRONG";
  else if (icr !== null && icr > 3) coverageRating = "ADEQUATE";
  else if (icr !== null && icr > 1.5) coverageRating = "TIGHT";
  else if (icr !== null) coverageRating = "STRESSED";
  else coverageRating = "UNKNOWN";

  return {
    ebitda: Math.round(ebitda),
    interestExpense: Math.round(interestExpense),
    icr: round2(icr),
    dscr: round2(dscr),
    costOfDebt: round2(costOfDebt),
    coverageRating,
    isDebtFree,
  };
}

// ─── Working Capital Quality ────────────────────────────────────────────

export function analyzeWorkingCapital(financialData) {
  const bs = financialData?.balanceSheet || [];
  const pl = financialData?.profitAndLoss?.annual || [];

  const latest = bs[0] || {};
  const latestPL = pl[0] || {};

  const receivables = safe(latest.tradeReceivables || latest.debtors);
  const inventory = safe(latest.inventory || latest.inventories);
  const payables = safe(latest.tradepayables || latest.tradePayables);
  const revenue = safe(latestPL.revenue);
  const cogs = safe(latestPL.rawMaterial) + safe(latestPL.manufacturingExpenses);

  // Days Sales Outstanding
  const dso = revenue > 0 ? (receivables / revenue) * 365 : null;

  // Days Inventory Outstanding
  const dio = cogs > 0 ? (inventory / cogs) * 365 : null;

  // Days Payable Outstanding
  const dpo = cogs > 0 ? (payables / cogs) * 365 : null;

  // Cash Conversion Cycle
  const ccc = (dso !== null && dio !== null && dpo !== null) ? dso + dio - dpo : null;

  // Net Working Capital
  const currentAssets = safe(latest.currentAssets);
  const currentLiabilities = safe(latest.currentLiabilities);
  const nwc = currentAssets - currentLiabilities;
  const nwcRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : null;

  let wcQuality;
  if (ccc !== null && ccc < 30 && nwcRatio > 1.5) wcQuality = "EXCELLENT";
  else if (ccc !== null && ccc < 60 && nwcRatio > 1.2) wcQuality = "GOOD";
  else if (ccc !== null && ccc < 120) wcQuality = "FAIR";
  else if (nwcRatio !== null && nwcRatio < 1) wcQuality = "STRESSED";
  else wcQuality = "UNKNOWN";

  return {
    dso: round2(dso),
    dio: round2(dio),
    dpo: round2(dpo),
    ccc: round2(ccc),
    nwc: Math.round(nwc),
    currentRatio: round2(nwcRatio),
    quality: wcQuality,
  };
}

// ─── Synthetic Credit Rating ────────────────────────────────────────────

export function computeSyntheticRating(debtStructure, coverage, workingCapital) {
  let creditScore = 0;

  // Interest Coverage component (40% weight)
  // DEBT_FREE is better than STRONG — give full marks
  if (coverage.coverageRating === "DEBT_FREE") {
    creditScore += 40;  // Max: no debt is the safest possible state
  } else {
    const icr = coverage.icr;
    if (icr > 8) creditScore += 40;
    else if (icr > 5) creditScore += 32;
    else if (icr > 3) creditScore += 24;
    else if (icr > 2) creditScore += 16;
    else if (icr > 1) creditScore += 8;
    else creditScore += 0;
  }

  // Debt-to-Equity component (30% weight)
  const de = debtStructure.debtToEquity;
  if (de !== null) {
    if (de < 0.1) creditScore += 30;  // Near-zero debt: max points
    else if (de < 0.3) creditScore += 30;
    else if (de < 0.6) creditScore += 24;
    else if (de < 1.0) creditScore += 18;
    else if (de < 1.5) creditScore += 10;
    else creditScore += 3;
  } else if (coverage.isDebtFree) {
    creditScore += 30;  // Confirmed debt-free: max D/E points too
  } else {
    creditScore += 15; // Unknown defaults to mid
  }

  // Working Capital Quality (20% weight)
  if (workingCapital.quality === "EXCELLENT") creditScore += 20;
  else if (workingCapital.quality === "GOOD") creditScore += 16;
  else if (workingCapital.quality === "FAIR") creditScore += 10;
  else if (workingCapital.quality === "STRESSED") creditScore += 3;
  else creditScore += 10;

  // Maturity Mix (10% weight)
  if (debtStructure.longTermRatio > 0.7) creditScore += 10;
  else if (debtStructure.longTermRatio > 0.4) creditScore += 6;
  else if (coverage.isDebtFree) creditScore += 10;  // No debt = perfectly balanced
  else creditScore += 2;

  // Map to rating
  let syntheticRating;
  if (creditScore >= 85) syntheticRating = "AAA";
  else if (creditScore >= 75) syntheticRating = "AA";
  else if (creditScore >= 65) syntheticRating = "A";
  else if (creditScore >= 55) syntheticRating = "BBB";
  else if (creditScore >= 45) syntheticRating = "BB";
  else if (creditScore >= 30) syntheticRating = "B";
  else syntheticRating = "CCC";

  return { creditScore, syntheticRating };
}

// ─── Composite Credit Analysis ──────────────────────────────────────────

export function computeCreditAnalysis(financialData, allRatios) {
  const debtStructure = analyzeDebtStructure(financialData, allRatios);
  const coverage = analyzeCoverageRatios(financialData);
  const workingCapital = analyzeWorkingCapital(financialData);
  const synthetic = computeSyntheticRating(debtStructure, coverage, workingCapital);

  const score = clamp(synthetic.creditScore, 0, 100);

  let rating;
  // DEBT_FREE is a special top-tier rating — better than INVESTMENT_GRADE
  if (coverage.isDebtFree) rating = "DEBT_FREE";
  else if (score >= 75) rating = "INVESTMENT_GRADE";
  else if (score >= 55) rating = "ADEQUATE";
  else if (score >= 35) rating = "SPECULATIVE";
  else rating = "DISTRESSED";

  // Generate commentary
  const creditCommentary = (() => {
    const p = [];
    if (synthetic.syntheticRating === "DEBT_FREE" || synthetic.syntheticRating === "AAA") {
      p.push(`Credit quality is excellent — ${synthetic.syntheticRating === "DEBT_FREE" ? "the company operates with virtually zero debt, providing maximum financial flexibility" : "synthetic credit rating of AAA indicates pristine balance sheet strength"}.`);
    } else if (["AA", "A"].includes(synthetic.syntheticRating)) {
      p.push(`The company carries a strong synthetic credit rating of ${synthetic.syntheticRating}, indicating robust ability to service its obligations.`);
    } else if (["BBB", "BB"].includes(synthetic.syntheticRating)) {
      p.push(`Credit quality is adequate with a synthetic rating of ${synthetic.syntheticRating}, though there is moderate leverage that investors should monitor.`);
    } else {
      p.push(`Credit quality is concerning with a sub-investment-grade synthetic rating of ${synthetic.syntheticRating}, suggesting heightened default risk.`);
    }
    if (workingCapital.currentRatio > 2.0) {
      p.push(`Working capital position is comfortable with a current ratio of ${workingCapital.currentRatio}x.`);
    } else if (workingCapital.currentRatio < 1.0) {
      p.push(`Working capital is tight with a current ratio below 1.0x, indicating potential short-term liquidity pressure.`);
    }
    return p.join(" ");
  })();

  return { score, rating, commentary: creditCommentary, debtStructure, coverage, workingCapital, syntheticRating: synthetic.syntheticRating };
}

// ─── Utilities ──────────────────────────────────────────────────────────

function safe(v) {
  // Handle {value, state} wrapper objects from TinyFish agent
  if (v && typeof v === "object" && "value" in v && "state" in v) {
    return v.state === "FETCHED" ? v.value : null;
  }
  if (v && typeof v === "object" && "value" in v) {
    return v.value;
  }
  return (typeof v === "number" && !isNaN(v)) ? v : null;
}
function round2(v) { return v !== null && v !== undefined ? Math.round(v * 100) / 100 : null; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
