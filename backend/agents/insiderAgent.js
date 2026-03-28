/**
 * Insider & Promoter Deep Dive Agent
 *
 * Scrapes live BSE bulk deal, block deal, and SAST filing data
 * to detect real insider buying/selling patterns in real-time.
 *
 * Makes 3 TinyFish calls (in parallel):
 *   1. BSE Bulk Deals (last 60 days)
 *   2. BSE Block Deals (last 60 days)
 *   3. BSE SAST / Insider Trading filings
 *
 * Expected steps: 25–40 total
 * Expected time: 40–70 seconds
 */

import { callTinyFish } from "./tinyfish.js";

/**
 * Run the Insider Agent for a company.
 *
 * @param {object} company - Company object from companies.json
 * @param {function} [onProgress] - Progress callback: (message) => void
 * @returns {Promise<object>}
 */
export async function runInsiderAgent(company, onProgress) {
  const { name, ticker } = company;

  onProgress?.(`Starting insider & promoter deep dive for ${name}...`);

  const [bulkResult, sastResult] = await Promise.allSettled([
    // Call 1: BSE Bulk Deals (covers most insider activity)
    callTinyFish(
      "https://www.bseindia.com/markets/equity/EQReports/BulkDealAdv.aspx",
      buildBulkDealsGoal(name, ticker),
      {
        browserProfile: "stealth",
        onProgress: (msg) => onProgress?.(`[Bulk Deals] ${msg}`),
      }
    ),

    // Call 2: SAST / Insider filings from BSE announcements
    callTinyFish(
      "https://www.bseindia.com/corporates/ann.html",
      buildSASTGoal(name),
      {
        browserProfile: "stealth",
        onProgress: (msg) => onProgress?.(`[SAST Filings] ${msg}`),
      }
    ),
  ]);

  const bulkRaw = extractResult(bulkResult, "Bulk Deals");
  const sastRaw = extractResult(sastResult, "SAST Filings");

  const bulkDeals = normalizeBulkDeals(bulkRaw);
  const blockDeals = []; // Block deals removed — rare, not worth a separate call
  const sastFilings = normalizeSAST(sastRaw);

  const signals = deriveInsiderSignals(bulkDeals, blockDeals, sastFilings);

  const totalSteps =
    (bulkResult.value?.stepCount || 0) +
    (sastResult.value?.stepCount || 0);

  const totalDuration = Math.max(
    bulkResult.value?.durationMs || 0,
    sastResult.value?.durationMs || 0
  );

  onProgress?.(
    `Insider analysis complete — ${totalSteps} steps in ${(totalDuration / 1000).toFixed(1)}s`
  );

  return {
    bulkDeals,
    blockDeals,
    sastFilings,
    signals,
    metadata: {
      agent: "insider",
      company: ticker,
      totalSteps,
      totalDurationMs: totalDuration,
      callResults: {
        bulkDeals: { steps: bulkResult.value?.stepCount, error: bulkResult.value?.error || bulkResult.reason?.message },
        sast: { steps: sastResult.value?.stepCount, error: sastResult.value?.error || sastResult.reason?.message },
      },
    },
  };
}

// ─── TinyFish Goal Prompts ──────────────────────────────────────────────

function buildBulkDealsGoal(name, ticker) {
  return `On the BSE India Bulk Deals page, search for the company "${name}" (ticker: ${ticker}).
Set the date range to cover the last 30 days from today. Submit the search.
Extract all bulk deal transactions shown for this company.

For each deal, extract: date (YYYY-MM-DD), clientName, dealType ("BUY" or "SELL"), quantity (number), price (INR), totalValue (quantity × price), clientType ("Promoter", "FII", "Mutual Fund", "HNI", or "Other").

Return ONLY this JSON:
{
  "bulkDeals": [
    { "date": "YYYY-MM-DD", "clientName": "", "dealType": "BUY", "quantity": 0, "price": 0, "totalValue": 0, "clientType": "Other" }
  ],
  "totalCount": 0,
  "dataAsOf": "today date"
}
If no bulk deals found: { "bulkDeals": [], "totalCount": 0, "dataAsOf": "" }`;
}

function buildBlockDealsGoal(name, ticker) {
  return `On the BSE India Block Deals page, search for the company "${name}" (ticker: ${ticker}).
Set the date range to cover the last 30 days from today. Submit the search.
Extract all block deal transactions shown.

For each deal, extract: date (YYYY-MM-DD), clientName, dealType ("BUY" or "SELL"), quantity (number), price (INR), totalValue (quantity × price), clientType ("Promoter", "FII", "Mutual Fund", "HNI", or "Other").

Return ONLY this JSON:
{
  "blockDeals": [
    { "date": "YYYY-MM-DD", "clientName": "", "dealType": "BUY", "quantity": 0, "price": 0, "totalValue": 0, "clientType": "Other" }
  ],
  "totalCount": 0
}
If none found: { "blockDeals": [], "totalCount": 0 }`;
}

function buildSASTGoal(name) {
  return `On the BSE India corporate announcements page, search for "${name}".
Filter to the last 3 months. Look for: SAST filings, insider trading disclosures, promoter share acquisitions/sales, ESOP, pledge creation/release.

Extract up to 8 such filings. For each: date (YYYY-MM-DD), subject, type ("SAST", "Insider Trading", "Pledge Creation", "Pledge Release", "ESOP", or "Other"), sentiment ("BULLISH" if buying/acquiring, "BEARISH" if selling/pledging, "NEUTRAL" otherwise).

Return ONLY this JSON:
{
  "filings": [
    { "date": "YYYY-MM-DD", "subject": "", "type": "SAST", "sentiment": "NEUTRAL" }
  ],
  "totalCount": 0
}
If none found: { "filings": [], "totalCount": 0 }`;
}

// ─── Normalizers ────────────────────────────────────────────────────────

function extractResult(settledResult, label) {
  if (settledResult.status === "fulfilled" && settledResult.value?.resultJson) {
    return settledResult.value.resultJson;
  }
  console.warn(
    `[InsiderAgent] ${label} failed or returned no data:`,
    settledResult.reason?.message || settledResult.value?.error
  );
  return null;
}

function normalizeBulkDeals(raw) {
  if (!raw?.bulkDeals) return [];
  return (raw.bulkDeals || []).map((d) => ({
    date: d.date || null,
    clientName: d.clientName || "Unknown",
    dealType: d.dealType === "BUY" ? "BUY" : "SELL",
    quantity: Number(d.quantity) || 0,
    price: Number(d.price) || 0,
    totalValue:
      Number(d.totalValue) ||
      Number(d.quantity) * Number(d.price) ||
      0,
    clientType: d.clientType || "Other",
    source: "bulk",
  }));
}

function normalizeBlockDeals(raw) {
  if (!raw?.blockDeals) return [];
  return (raw.blockDeals || []).map((d) => ({
    date: d.date || null,
    clientName: d.clientName || "Unknown",
    dealType: d.dealType === "BUY" ? "BUY" : "SELL",
    quantity: Number(d.quantity) || 0,
    price: Number(d.price) || 0,
    totalValue:
      Number(d.totalValue) ||
      Number(d.quantity) * Number(d.price) ||
      0,
    clientType: d.clientType || "Other",
    source: "block",
  }));
}

function normalizeSAST(raw) {
  if (!raw?.filings) return [];
  return (raw.filings || []).map((f) => ({
    date: f.date || null,
    subject: f.subject || "",
    type: f.type || "Other",
    sentiment: f.sentiment || "NEUTRAL",
  }));
}

// ─── Derived Signals ────────────────────────────────────────────────────

function deriveInsiderSignals(bulkDeals, blockDeals, sastFilings) {
  const allDeals = [...bulkDeals, ...blockDeals];
  const promoterDeals = allDeals.filter((d) => d.clientType === "Promoter");
  const promoterBuys = promoterDeals.filter((d) => d.dealType === "BUY");
  const promoterSells = promoterDeals.filter((d) => d.dealType === "SELL");

  const totalBuyValue = promoterBuys.reduce((s, d) => s + d.totalValue, 0);
  const totalSellValue = promoterSells.reduce((s, d) => s + d.totalValue, 0);

  const bullishFilings = sastFilings.filter((f) => f.sentiment === "BULLISH").length;
  const bearishFilings = sastFilings.filter((f) => f.sentiment === "BEARISH").length;

  // Net insider confidence: 0=distribution, 50=neutral, 100=strong accumulation
  let insiderConfidence = 50;
  if (totalBuyValue + totalSellValue > 0) {
    insiderConfidence = Math.round(
      (totalBuyValue / (totalBuyValue + totalSellValue)) * 100
    );
  }
  if (bullishFilings > bearishFilings)
    insiderConfidence = Math.min(100, insiderConfidence + 10);
  if (bearishFilings > bullishFilings)
    insiderConfidence = Math.max(0, insiderConfidence - 10);

  let signal, signalColor;
  if (insiderConfidence >= 65) {
    signal = "ACCUMULATION";
    signalColor = "green";
  } else if (insiderConfidence <= 35) {
    signal = "DISTRIBUTION";
    signalColor = "red";
  } else {
    signal = "NEUTRAL";
    signalColor = "yellow";
  }

  const pledgeCreations = sastFilings.filter(
    (f) => f.type === "Pledge Creation"
  ).length;
  const pledgeReleases = sastFilings.filter(
    (f) => f.type === "Pledge Release"
  ).length;
  const pledgeSignal =
    pledgeCreations > pledgeReleases
      ? "INCREASING"
      : pledgeReleases > pledgeCreations
        ? "DECREASING"
        : "STABLE";

  return {
    insiderConfidence,
    signal,
    signalColor,
    promoterBuyCount: promoterBuys.length,
    promoterSellCount: promoterSells.length,
    totalBuyValue,
    totalSellValue,
    bullishFilings,
    bearishFilings,
    pledgeSignal,
    pledgeCreations,
    pledgeReleases,
    totalDeals: allDeals.length,
    hasFIIActivity: allDeals.some((d) => d.clientType === "FII"),
    hasMFActivity: allDeals.some((d) => d.clientType === "Mutual Fund"),
  };
}
