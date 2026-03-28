/**
 * Financial Agent
 *
 * Extracts financial data from Screener.in using TinyFish browser automation.
 * Makes 3 TinyFish calls:
 *   1. Profit & Loss Statement (quarterly + annual)
 *   2. Balance Sheet (3 years annual)
 *   3. Cash Flow Statement + Key Ratios
 *
 * Expected steps: 37–53 total
 * Expected time: 40–70 seconds
 */

import { callTinyFish } from "./tinyfish.js";
import config from "../config/env.js";

/**
 * Run the Financial Agent for a company.
 *
 * @param {object} company - Company object from companies.json
 * @param {function} [onProgress] - Progress callback: (message) => void
 * @returns {Promise<object>} - { profitAndLoss, balanceSheet, cashFlow, ratiosSummary, metadata }
 */
export async function runFinancialAgent(company, onProgress) {
  const { screenerSlug, name, ticker } = company;
  const baseUrl = `https://www.screener.in/company/${screenerSlug}/`;

  console.log(`[FinancialAgent] Starting analysis for ${name} (${ticker})`);
  console.log(`[FinancialAgent] screenerSlug: ${screenerSlug}`);
  console.log(`[FinancialAgent] baseUrl: ${baseUrl}`);

  onProgress?.(`Starting financial analysis for ${name}...`);

  // Keep Screener calls sequential to avoid upstream stream closures under burst load.
  console.log(`[FinancialAgent] Calling TinyFish for P&L...`);
  const plResult = await Promise.allSettled([
    callTinyFish(baseUrl, buildPLGoal(name), {
      browserProfile: "lite",
      retries: config.tinyfish.defaultRetries,
      onProgress: (msg) => onProgress?.(`[P&L] ${msg}`),
    }),
  ]).then((r) => r[0]);
  console.log(`[FinancialAgent] P&L result:`, plResult.status, plResult.value?.stepCount || plResult.reason?.message);

  console.log(`[FinancialAgent] Calling TinyFish for Balance Sheet...`);
  const bsResult = await Promise.allSettled([
    callTinyFish(baseUrl, buildBSGoal(name), {
      browserProfile: "lite",
      retries: config.tinyfish.defaultRetries,
      onProgress: (msg) => onProgress?.(`[Balance Sheet] ${msg}`),
    }),
  ]).then((r) => r[0]);
  console.log(`[FinancialAgent] BS result:`, bsResult.status, bsResult.value?.stepCount || bsResult.reason?.message);

  const cfResult = await Promise.allSettled([
    callTinyFish(baseUrl, buildCFGoal(name), {
      browserProfile: "lite",
      retries: config.tinyfish.defaultRetries,
      onProgress: (msg) => onProgress?.(`[Cash Flow] ${msg}`),
    }),
  ]).then((r) => r[0]);

  // Process results
  const profitAndLoss = extractResult(plResult, "Profit & Loss");
  const balanceSheet = extractResult(bsResult, "Balance Sheet");
  const cashFlowAndRatios = extractResult(cfResult, "Cash Flow & Ratios");

  // Compute metadata
  const totalSteps =
    (plResult.value?.stepCount || 0) +
    (bsResult.value?.stepCount || 0) +
    (cfResult.value?.stepCount || 0);

  const totalDuration = Math.max(
    plResult.value?.durationMs || 0,
    bsResult.value?.durationMs || 0,
    cfResult.value?.durationMs || 0
  );

  onProgress?.(`Financial extraction complete — ${totalSteps} steps in ${(totalDuration / 1000).toFixed(1)}s`);

  return {
    profitAndLoss: normalizePL(profitAndLoss),
    balanceSheet: normalizeBS(balanceSheet),
    cashFlow: normalizeCF(cashFlowAndRatios),
    ratiosSummary: normalizeRatios(cashFlowAndRatios),
    metadata: {
      agent: "financial",
      company: ticker,
      totalSteps,
      totalDurationMs: totalDuration,
      callResults: {
        pl: { steps: plResult.value?.stepCount, error: plResult.value?.error || plResult.reason?.message },
        bs: { steps: bsResult.value?.stepCount, error: bsResult.value?.error || bsResult.reason?.message },
        cf: { steps: cfResult.value?.stepCount, error: cfResult.value?.error || cfResult.reason?.message },
      },
    },
  };
}

// ─── TinyFish Goal Prompts ──────────────────────────────────────────────

function buildPLGoal(companyName) {
  return `Navigate to the Profit & Loss section of this Screener.in page for ${companyName}. 
Extract quarterly data for the last 8 quarters. For each quarter, get: 
- Sales/Revenue (in Cr)
- Expenses (in Cr) 
- Operating Profit (in Cr)
- OPM percentage
- Net Profit (in Cr)
- EPS

Also extract annual P&L for the last 5 years with the same fields.

Return as structured JSON with this exact format:
{
  "quarterly": [
    { "period": "Q3 FY25", "revenue": 5405, "expenses": 5100, "operatingProfit": 305, "opmPercent": 5.6, "netProfit": 59, "eps": 0.07 }
  ],
  "annual": [
    { "period": "Mar 2024", "revenue": 14091, "expenses": 13500, "operatingProfit": 591, "opmPercent": 4.2, "netProfit": 351, "eps": 0.41 }
  ]
}

Use clear quarter labels like "Q3 FY25" and year labels like "Mar 2024". All numbers in Crores.`;
}

function buildBSGoal(companyName) {
  return `Navigate to the Balance Sheet section of this Screener.in page for ${companyName}.
Extract the latest 3 years of annual data. For each year, get:
- Total Share Capital (in Cr)
- Reserves (in Cr)
- Total Borrowings / Total Debt (in Cr) - include both long-term and short-term borrowings
- Cash & Bank Balances / Cash & Equivalents (in Cr)
- Current Assets (in Cr) - or sum of receivables, inventory, cash equivalents
- Current Liabilities (in Cr) - or total of short-term obligations
- Other Liabilities (in Cr)
- Total Liabilities (in Cr)
- Fixed Assets (in Cr)
- CWIP (in Cr)
- Investments (in Cr)
- Other Assets (in Cr)
- Total Assets (in Cr)

Return as structured JSON with this exact format:
{
  "balanceSheet": [
    { "period": "Mar 2024", "shareCapital": 878, "reserves": 18234, "borrowings": 1200, "cash": 5000, "currentAssets": 8500, "currentLiabilities": 5400, "otherLiabilities": 4500, "totalLiabilities": 24812, "fixedAssets": 5600, "cwip": 200, "investments": 8500, "otherAssets": 10512, "totalAssets": 24812 }
  ]
}

All numbers in Crores. If a field is not available, use null.`;
}

function buildCFGoal(companyName) {
  return `On this Screener.in page for ${companyName}, do two things:

1) Navigate to Cash Flow Statement section. Extract for the last 4 years:
   - Cash from Operating Activity (in Cr)
   - Cash from Investing Activity (in Cr)
   - Cash from Financing Activity (in Cr)
   - Net Cash Flow (in Cr)

2) Then look at the top Key Metrics area / Ratios section. Extract:
   - ROE (%)
   - ROCE (%)
   - Debt to Equity ratio
   - Current Ratio
   - P/E ratio
   - P/B ratio (Price to Book)
   - Dividend Yield (%)
   - EV/EBITDA
   - Market Cap (in Cr)
   - Face Value

Return as structured JSON with this exact format:
{
  "cashFlow": [
    { "period": "Mar 2024", "operatingCF": 1200, "investingCF": -3400, "financingCF": -200, "netCashFlow": -2400 }
  ],
  "ratiosSummary": {
    "roe": 8.4, "roce": 7.2, "debtToEquity": 0.4, "currentRatio": 2.3,
    "pe": 312, "pb": 15.2, "dividendYield": 0, "evEbitda": 150,
    "marketCap": 198000, "faceValue": 1
  }
}

All monetary values in Crores. Ratios as plain numbers (not percentages for D/E, current ratio).`;
}

// ─── Result Extraction & Normalization ──────────────────────────────────

function extractResult(settledResult, label) {
  if (settledResult.status === "fulfilled") {
    const { resultJson, error } = settledResult.value;
    if (error) {
      console.warn(`[FinancialAgent] ${label} returned with error: ${error}`);
      return null;
    }
    return resultJson;
  }
  console.error(`[FinancialAgent] ${label} call rejected:`, settledResult.reason?.message);
  return null;
}

/**
 * Normalize P&L data — ensure arrays exist, numbers are valid.
 */
function normalizePL(raw) {
  if (!raw) return { quarterly: [], annual: [] };

  const quarterly = Array.isArray(raw.quarterly) ? raw.quarterly : [];
  const annual = Array.isArray(raw.annual) ? raw.annual : [];

  const normalizeEntry = (entry) => ({
    period: entry.period || "Unknown",
    revenue: toNum(entry.revenue || entry.sales || entry.Sales || entry.Revenue),
    expenses: toNum(entry.expenses || entry.Expenses),
    operatingProfit: toNum(entry.operatingProfit || entry.operating_profit || entry["Operating Profit"]),
    opmPercent: toNum(entry.opmPercent || entry.opm || entry.OPM),
    netProfit: toNum(entry.netProfit || entry.net_profit || entry["Net Profit"]),
    eps: toNum(entry.eps || entry.EPS),
  });

  return {
    quarterly: quarterly.map(normalizeEntry),
    annual: annual.map(normalizeEntry),
  };
}

/**
 * Normalize Balance Sheet data.
 */
function normalizeBS(raw) {
  if (!raw) return [];

  const sheets = Array.isArray(raw.balanceSheet) ? raw.balanceSheet : Array.isArray(raw) ? raw : [];

  return sheets.map((entry) => ({
    period: entry.period || "Unknown",
    shareCapital: toNum(entry.shareCapital || entry.share_capital || entry["Share Capital"]),
    reserves: toNum(entry.reserves || entry.Reserves),
    borrowings: toNum(entry.borrowings || entry.Borrowings || entry.totalBorrowings || entry.debt || entry.totalDebt),
    cash: toNum(entry.cash || entry.cashAndEquivalents || entry["Cash & Bank Balances"]),
    currentAssets: toNum(entry.currentAssets || entry.current_assets || entry["Current Assets"]),
    currentLiabilities: toNum(entry.currentLiabilities || entry.current_liabilities || entry["Current Liabilities"]),
    otherLiabilities: toNum(entry.otherLiabilities || entry.other_liabilities || entry["Other Liabilities"]),
    totalLiabilities: toNum(entry.totalLiabilities || entry.total_liabilities || entry["Total Liabilities"]),
    fixedAssets: toNum(entry.fixedAssets || entry.fixed_assets || entry["Fixed Assets"]),
    cwip: toNum(entry.cwip || entry.CWIP),
    investments: toNum(entry.investments || entry.Investments),
    otherAssets: toNum(entry.otherAssets || entry.other_assets || entry["Other Assets"]),
    totalAssets: toNum(entry.totalAssets || entry.total_assets || entry["Total Assets"]),
  }));
}

/**
 * Normalize Cash Flow data.
 */
function normalizeCF(raw) {
  if (!raw) return [];

  const flows = Array.isArray(raw.cashFlow) ? raw.cashFlow : [];

  return flows.map((entry) => ({
    period: entry.period || "Unknown",
    operatingCF: toNum(entry.operatingCF || entry.operating_cf || entry["Cash from Operating Activity"]),
    investingCF: toNum(entry.investingCF || entry.investing_cf || entry["Cash from Investing Activity"]),
    financingCF: toNum(entry.financingCF || entry.financing_cf || entry["Cash from Financing Activity"]),
    netCashFlow: toNum(entry.netCashFlow || entry.net_cash_flow || entry["Net Cash Flow"]),
  }));
}

/**
 * Normalize ratios summary.
 */
function normalizeRatios(raw) {
  if (!raw || !raw.ratiosSummary) {
    return {
      roe: null, roce: null, debtToEquity: null, currentRatio: null,
      pe: null, pb: null, dividendYield: null, evEbitda: null,
      marketCap: null, faceValue: null,
    };
  }

  const r = raw.ratiosSummary;
  return {
    roe: toNum(r.roe || r.ROE),
    roce: toNum(r.roce || r.ROCE),
    debtToEquity: toNum(r.debtToEquity || r.debt_to_equity || r["Debt to Equity"]),
    currentRatio: toNum(r.currentRatio || r.current_ratio || r["Current Ratio"]),
    pe: toNum(r.pe || r.PE || r["P/E"]),
    pb: toNum(r.pb || r.PB || r["P/B"] || r["Price to Book"]),
    dividendYield: toNum(r.dividendYield || r.dividend_yield || r["Dividend Yield"]),
    evEbitda: toNum(r.evEbitda || r.ev_ebitda || r["EV/EBITDA"]),
    marketCap: toNum(r.marketCap || r.market_cap || r["Market Cap"]),
    faceValue: toNum(r.faceValue || r.face_value || r["Face Value"]),
  };
}

/**
 * Safely convert a value to a number.
 * Handles strings with commas, "Cr", "₹", etc.
 */
function toNum(val) {
  let numVal = null;
  if (val === null || val === undefined || val === "" || val === "N/A" || val === "-") numVal = null;
  else if (typeof val === "number") numVal = isNaN(val) ? null : val;
  else if (typeof val === "string") {
    const cleaned = val.replace(/[?,Cr%]/g, "").replace(/\s/g, "").trim();
    const num = parseFloat(cleaned);
    numVal = isNaN(num) ? null : num;
  }
  return { value: numVal, state: numVal === null ? "FETCH_FAILED" : "FETCHED" };
}

export default { runFinancialAgent };
