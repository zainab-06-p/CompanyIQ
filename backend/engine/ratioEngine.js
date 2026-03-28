/**
 * Ratio Engine
 *
 * Computes all 25+ financial ratios from raw Financial Agent data.
 * Pure math — no external dependencies, no API calls.
 *
 * Input: normalized P&L, Balance Sheet, Cash Flow data from Financial Agent
 * Output: complete ratio object used by Financial Scorer and Red Flag Engine
 */

/**
 * Compute all financial ratios from raw financial agent data.
 *
 * @param {object} financialData - Output from runFinancialAgent()
 * @returns {object} - All computed ratios organized by category
 */
export function computeAllRatios(financialData) {
  const { profitAndLoss, balanceSheet, cashFlow, ratiosSummary } = financialData;

  const latestAnnual = profitAndLoss.annual?.[0] || {};
  const prevAnnual = profitAndLoss.annual?.[1] || {};
  const latestBS = balanceSheet?.[0] || {};
  const latestCF = cashFlow?.[0] || {};
  const quarters = profitAndLoss.quarterly || [];

  // Derived values
  const equity = safeAdd(latestBS.shareCapital, latestBS.reserves);
  // Use unwrap() + ?? to handle {value,state} wrapped objects correctly.
  // The old `|| 0` was truthy-testing a wrapped object, always going to 0.
  const rawBorrowings = unwrap(latestBS.borrowings);
  const totalDebt = rawBorrowings ?? 0;

  // Compute all ratio categories
  const profitability = computeProfitability(latestAnnual, equity, latestBS.totalAssets);
  const liquidity = computeLiquidity(latestBS, latestCF, ratiosSummary);
  const solvency = computeSolvency(latestBS, latestAnnual, equity, totalDebt, rawBorrowings);
  const growth = computeGrowth(profitAndLoss);
  const valuation = computeValuation(ratiosSummary, latestAnnual);
  const additional = computeAdditional(ratiosSummary, latestAnnual, latestBS, profitAndLoss);

  // Quarterly net profits (for red flag trend detection)
  const quarterlyNetProfits = quarters.map((q) => q.netProfit).filter((v) => v !== null);
  const quarterlyRevenues = quarters.map((q) => q.revenue).filter((v) => v !== null);

  const raw = {
    // Profitability (6)
    ...profitability,
    // Liquidity (3)
    ...liquidity,
    // Solvency (4)
    ...solvency,
    // Growth (4)
    ...growth,
    // Valuation (5)
    ...valuation,
    // Additional (3) — ROCE, Asset Turnover, EPS Growth
    ...additional,
    // Trend arrays for red flag engine
    quarterlyNetProfits,
    quarterlyRevenues,
    // Raw reference values
    latestRevenue: latestAnnual.revenue,
    latestNetProfit: latestAnnual.netProfit,
    equity,
    totalDebt,
    totalAssets: latestBS.totalAssets,
  };

  // ── NaN DEFENSE: sanitize every numeric field ──────────────────────
  // NaN passes typeof === 'number' and !== null checks, poisoning the
  // entire scoring pipeline.  Convert any non-finite number to null.
  return sanitizeRatios(raw);
}

// ─── Profitability Ratios (6) ───────────────────────────────────────────

function computeProfitability(latestAnnual, equity, totalAssets) {
  const revenue = latestAnnual.revenue;
  const netProfit = latestAnnual.netProfit;
  const operatingProfit = latestAnnual.operatingProfit;
  const expenses = latestAnnual.expenses;

  return {
    grossProfitMargin: safeDivide(safeSub(revenue, expenses), revenue, 100),
    netProfitMargin: safeDivide(netProfit, revenue, 100),
    operatingProfitMargin: safeDivide(operatingProfit, revenue, 100),
    ebitdaMargin: latestAnnual.opmPercent || safeDivide(operatingProfit, revenue, 100),
    returnOnEquity: safeDivide(netProfit, equity, 100),
    returnOnAssets: safeDivide(netProfit, totalAssets, 100),
  };
}

// ─── Liquidity Ratios (3) ───────────────────────────────────────────────

function computeLiquidity(latestBS, latestCF, ratiosSummary) {
  // Current ratio: from Screener ratiosSummary (most accurate) or compute from BS
  // Use new currentAssets/currentLiabilities fields if available
  const currentAssets = unwrap(latestBS.currentAssets) ?? unwrap(latestBS.otherAssets) ?? null;
  const currentLiabilities = unwrap(latestBS.currentLiabilities) ?? unwrap(latestBS.otherLiabilities) ?? null;
  const currentRatio = ratiosSummary?.currentRatio || safeDivide(currentAssets, currentLiabilities);

  // Quick ratio: (Current Assets - Inventory) / Current Liabilities
  // Simplified: use currentAssets as proxy for quick assets if inventory not available
  const quickRatio = (currentAssets !== null && currentLiabilities !== null && currentLiabilities > 0)
    ? (currentAssets * 0.8) / currentLiabilities  // Estimate quick assets as 80% of current assets
    : null;

  // Operating Cash Flow Ratio
  const operatingCFRatio = safeDivide(latestCF.operatingCF, currentLiabilities);

  return {
    currentRatio: currentRatio !== null ? round(currentRatio) : null,
    quickRatio: quickRatio !== null ? round(quickRatio) : null,
    operatingCFRatio: operatingCFRatio !== null ? round(operatingCFRatio) : null,
  };
}

// ─── Solvency Ratios (4) ───────────────────────────────────────────────

function computeSolvency(latestBS, latestAnnual, equity, totalDebt, rawBorrowings) {
  // Debt-to-Equity
  const debtToEquity = safeDivide(totalDebt, equity);

  // Debt-to-Assets
  const debtToAssets = safeDivide(totalDebt, latestBS.totalAssets);

  // Net Debt = Total Debt - Cash & Cash Equivalents
  // Use new cash field if available, otherwise fall back to 30% of investments as liquid proxy
  const cash = unwrap(latestBS.cash) ?? 0;
  const cashProxy = cash > 0 ? cash : (unwrap(latestBS.investments) || 0) * 0.3;
  const netDebt = totalDebt - cashProxy;

  // Interest Coverage Ratio = Operating Profit / Interest Expense
  // Unwrap all fields before arithmetic to avoid NaN from {value,state} wrappers
  const rawRevenue = unwrap(latestAnnual.revenue);
  const rawExpenses = unwrap(latestAnnual.expenses) ?? 0;
  const rawOPM = unwrap(latestAnnual.operatingProfit);
  const interestExpense = rawRevenue
    ? rawExpenses - (rawOPM ? rawRevenue - rawOPM : 0)
    : null;

  // Use rawBorrowings (unwrapped) to correctly distinguish zero-debt vs unknown-debt.
  const interestCoverage = rawOPM && rawBorrowings !== null && rawBorrowings > 0
    ? safeDivide(rawOPM, Math.max(totalDebt * 0.08, 1)) // Assume ~8% cost of debt
    : rawBorrowings === 0
      ? 999 // No debt means infinite coverage
      : null;

  return {
    debtToEquity: debtToEquity !== null ? round(debtToEquity) : null,
    debtToAssets: debtToAssets !== null ? round(debtToAssets) : null,
    netDebt: netDebt !== null ? round(netDebt) : null,
    interestCoverage: interestCoverage !== null ? round(Math.min(interestCoverage, 999)) : null,
  };
}

// ─── Growth Metrics (4) ────────────────────────────────────────────────

function computeGrowth(profitAndLoss) {
  const annual = profitAndLoss.annual || [];
  const quarterly = profitAndLoss.quarterly || [];

  // 3-Year Revenue CAGR
  let revenueCAGR3yr = null;
  const r0rev = unwrap(annual[0]?.revenue);
  const r3rev = unwrap(annual[3]?.revenue);
  if (annual.length >= 4 && r0rev > 0 && r3rev > 0) {
    revenueCAGR3yr = round((Math.pow(r0rev / r3rev, 1 / 3) - 1) * 100);
  }

  // 3-Year PAT CAGR
  let patCAGR3yr = null;
  const r0pat = unwrap(annual[0]?.netProfit);
  const r3pat = unwrap(annual[3]?.netProfit);
  if (annual.length >= 4 && r0pat > 0 && r3pat > 0) {
    patCAGR3yr = round((Math.pow(r0pat / r3pat, 1 / 3) - 1) * 100);
  }

  // QoQ Revenue Growth (latest vs previous quarter)
  let qoqRevenueGrowth = null;
  const q0rev = unwrap(quarterly[0]?.revenue);
  const q1rev = unwrap(quarterly[1]?.revenue);
  if (quarterly.length >= 2 && q0rev != null && q1rev > 0) {
    qoqRevenueGrowth = round(((q0rev - q1rev) / q1rev) * 100);
  }

  // YoY Revenue Growth (latest quarter vs same quarter last year)
  let yoyRevenueGrowth = null;
  const q4rev = unwrap(quarterly[4]?.revenue);
  if (quarterly.length >= 5 && q0rev != null && q4rev > 0) {
    yoyRevenueGrowth = round(((q0rev - q4rev) / q4rev) * 100);
  }

  return {
    revenueCAGR3yr,
    patCAGR3yr,
    qoqRevenueGrowth,
    yoyRevenueGrowth,
  };
}

// ─── Valuation Ratios (5) ──────────────────────────────────────────────

function computeValuation(ratiosSummary, latestAnnual) {
  const r = ratiosSummary || {};

  // Price-to-Sales
  const mktCap = unwrap(r.marketCap);
  const latRev = unwrap(latestAnnual.revenue);
  const priceToSales =
    mktCap && latRev
      ? round(mktCap / latRev)
      : null;

  return {
    pe: r.pe || null,
    pb: r.pb || null,
    evEbitda: r.evEbitda || null,
    dividendYield: r.dividendYield || null,
    priceToSales,
  };
}

// ─── Additional Ratios (3) ──────────────────────────────────────────────

function computeAdditional(ratiosSummary, latestAnnual, latestBS, profitAndLoss) {
  const r = ratiosSummary || {};
  const annual = profitAndLoss.annual || [];

  // ROCE — from Screener.in ratiosSummary (most accurate source)
  const roce = r.roce || null;

  // Asset Turnover = Revenue / Average Total Assets
  const annRev = unwrap(latestAnnual.revenue);
  const annAst = unwrap(latestBS.totalAssets);
  const assetTurnover = annRev && annAst
    ? round(annRev / annAst)
    : null;

  // EPS Growth CAGR (3yr)
  let epsGrowthCAGR = null;
  const r0eps = unwrap(annual[0]?.eps);
  const r3eps = unwrap(annual[3]?.eps);
  if (annual.length >= 4 && r0eps > 0 && r3eps > 0) {
    epsGrowthCAGR = round((Math.pow(r0eps / r3eps, 1 / 3) - 1) * 100);
  }

  return {
    roce: roce !== null ? round(roce) : null,
    assetTurnover,
    epsGrowthCAGR,
  };
}

// ─── Math Utilities ─────────────────────────────────────────────────────

/**
 * Safe division that returns null instead of Infinity/NaN.
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} [multiplier=1] - Multiply result (e.g., 100 for percentage)
 */
function unwrap(v) {
  if (v && typeof v === 'object' && 'state' in v) {
    if (v.state !== 'FETCHED') return null;
    return v.value;
  }
  return v;
}

function safeDivide(numerator, denominator, multiplier = 1) {
  const n = unwrap(numerator);
  const d = unwrap(denominator);
  if (n === null || n === undefined) return null;
  if (!d || d === 0) return null;
  const result = (n / d) * multiplier;
  return isFinite(result) ? result : null;
}

function safeAdd(a, b) {
  const numA = unwrap(a);
  const numB = unwrap(b);
  // Both null means data is unavailable — return null, not 0.
  // The old code used `|| 0` which made null+null=0 (valid-looking zero equity/debt).
  if (numA === null && numB === null) return null;
  return (numA ?? 0) + (numB ?? 0);
}

function safeSub(a, b) {
  const numA = unwrap(a);
  const numB = unwrap(b);
  if (numA === null || numA === undefined || numB === null || numB === undefined) return null;
  return numA - numB;
}

function round(val, decimals = 2) {
  if (val === null || val === undefined || !isFinite(val)) return null;
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Sanitize a flat object: replace any NaN / Infinity values with null.
 * Arrays and nested objects are left as-is (only top-level numerics matter
 * for the scoring pipeline).
 */
function sanitizeRatios(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      out[k] = null;   // NaN / Infinity → null (safe for downstream scorers)
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── Ratio Momentum / Trajectory Tracker ─────────────────────────────────

/**
 * Compute momentum and trajectory for key ratios using quarterly data.
 * Shows whether ratios are IMPROVING, STABLE, or DECLINING and at what rate.
 *
 * @param {object} financialData - Raw financial agent data (needs quarterly arrays)
 * @param {object} allRatios - Already-computed ratios from computeAllRatios()
 * @returns {object} - Trajectory for each key metric
 */
export function computeRatioMomentum(financialData, allRatios) {
  const quarters = financialData.profitAndLoss?.quarterly || [];
  const annual = financialData.profitAndLoss?.annual || [];
  const bsData = financialData.balanceSheet || [];
  const trajectories = {};

  // Revenue trajectory (quarterly)
  if (allRatios.quarterlyRevenues && allRatios.quarterlyRevenues.length >= 3) {
    trajectories.revenue = computeTrajectory(allRatios.quarterlyRevenues, "Revenue");
  }

  // Net Profit trajectory (quarterly)
  if (allRatios.quarterlyNetProfits && allRatios.quarterlyNetProfits.length >= 3) {
    trajectories.netProfit = computeTrajectory(allRatios.quarterlyNetProfits, "Net Profit");
  }

  // OPM trajectory - extract quarterly OPM %s
  const quarterlyOPMs = quarters
    .map((q) => (q.revenue && q.operatingProfit ? round((q.operatingProfit / q.revenue) * 100) : null))
    .filter((v) => v !== null);
  if (quarterlyOPMs.length >= 3) {
    trajectories.operatingMargin = computeTrajectory(quarterlyOPMs, "Operating Margin %");
  }

  // NPM trajectory
  const quarterlyNPMs = quarters
    .map((q) => (q.revenue && q.netProfit ? round((q.netProfit / q.revenue) * 100) : null))
    .filter((v) => v !== null);
  if (quarterlyNPMs.length >= 3) {
    trajectories.netMargin = computeTrajectory(quarterlyNPMs, "Net Margin %");
  }

  // Annual ROE trajectory (if annuals available)
  if (annual.length >= 3) {
    const annualROEs = annual
      .slice(0, 5)
      .map((a) => {
        if (!a.netProfit) return null;
        // Rough equity proxy from available data
        return a.netProfit > 0 ? round((a.netProfit / Math.max(a.netProfit * 5, 1)) * 100) : null;
      })
      .filter((v) => v !== null);
    if (annualROEs.length >= 3) {
      trajectories.roe = computeTrajectory(annualROEs, "ROE %");
    }
  }

  // Debt-to-equity trajectory (annual BS)
  if (bsData.length >= 2) {
    const annualDE = bsData.slice(0, 5).map((bs) => {
      const eq = safeAdd(bs.shareCapital, bs.reserves);
      const borr = unwrap(bs.borrowings);
      return eq > 0 && borr != null ? round(borr / eq) : null;
    }).filter((v) => v !== null);
    if (annualDE.length >= 2) {
      trajectories.debtToEquity = computeTrajectory(annualDE, "Debt/Equity");
    }
  }

  return trajectories;
}

/**
 * Compute trajectory stats for a series of values (most recent first).
 *
 * @param {number[]} values - Array of values, index 0 = most recent
 * @param {string} label
 * @returns {{ label, direction, momentum, consistency, values, periods, change }}
 */
function computeTrajectory(values, label) {
  const n = values.length;
  if (n < 2) return { label, direction: "INSUFFICIENT_DATA", momentum: 0, values };

  // Consecutive direction changes
  let improvingCount = 0;
  let decliningCount = 0;

  for (let i = 0; i < n - 1; i++) {
    if (values[i] > values[i + 1]) improvingCount++;
    else if (values[i] < values[i + 1]) decliningCount++;
  }

  // Direction
  let direction;
  if (improvingCount >= Math.ceil((n - 1) * 0.7)) direction = "IMPROVING";
  else if (decliningCount >= Math.ceil((n - 1) * 0.7)) direction = "DECLINING";
  else if (improvingCount > decliningCount) direction = "MIXED_UP";
  else if (decliningCount > improvingCount) direction = "MIXED_DOWN";
  else direction = "STABLE";

  // Momentum: % change from oldest to newest
  const oldest = values[n - 1];
  const newest = values[0];
  const momentum = oldest !== 0 ? round(((newest - oldest) / Math.abs(oldest)) * 100) : null;

  // Consistency: what fraction of periods moved in the dominant direction
  const dominant = Math.max(improvingCount, decliningCount);
  const consistency = round(dominant / (n - 1));

  // Period-over-period change (latest vs previous)
  const change = n >= 2 ? round(values[0] - values[1]) : null;

  return {
    label,
    direction,
    momentum,
    consistency,
    change,
    periods: n,
    latest: values[0],
    oldest: values[n - 1],
  };
}

export default { computeAllRatios, computeRatioMomentum };
