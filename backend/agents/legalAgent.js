/**
 * Legal Agent
 *
 * Extracts legal & governance data using TinyFish browser automation.
 * Sources: BSE India (announcements + shareholding) + Screener.in (backup)
 * Makes 3 TinyFish calls:
 *   1. BSE Corporate Announcements (last 12 months)
 *   2. BSE Shareholding Pattern + Pledge data
 *   3. Screener.in Shareholding trend + Directors (backup/supplement)
 *
 * Expected steps: 37–55 total
 * Expected time: 50–80 seconds
 */

import { callTinyFish } from "./tinyfish.js";
import config from "../config/env.js";

/**
 * Run the Legal Agent for a company.
 *
 * @param {object} company - Company object from companies.json
 * @param {function} [onProgress] - Progress callback: (message) => void
 * @returns {Promise<object>} - { announcements, shareholding, directors, metadata }
 */
export async function runLegalAgent(company, onProgress) {
  const { name, ticker, bseCode, screenerSlug } = company;

  onProgress?.(`Starting legal & governance analysis for ${name}...`);

  // Run all 3 calls in parallel
  const [annResult, shResult, scrResult] = await Promise.allSettled([
    // Call 1: BSE Announcements
    callTinyFish(
      "https://www.bseindia.com/corporates/ann.html",
      buildAnnouncementsGoal(name),
      {
        browserProfile: "stealth",
        retries: config.tinyfish.defaultRetries,
        onProgress: (msg) => onProgress?.(`[Announcements] ${msg}`),
      }
    ),

    // Call 2: BSE Shareholding Pattern — navigate directly using BSE scrip code
    callTinyFish(
      bseCode
        ? `https://www.bseindia.com/corporates/shpSecurities.html?scripcode=${bseCode}`
        : "https://www.bseindia.com/corporates/shpSecurities.html",
      buildShareholdingGoal(name, bseCode),
      {
        browserProfile: "stealth",
        retries: config.tinyfish.defaultRetries,
        onProgress: (msg) => onProgress?.(`[Shareholding] ${msg}`),
      }
    ),

    // Call 3: Screener.in backup — Shareholding trend + Directors
    callTinyFish(
      `https://www.screener.in/company/${screenerSlug}/`,
      buildScreenerLegalGoal(name),
      {
        browserProfile: "lite",
        retries: config.tinyfish.defaultRetries,
        onProgress: (msg) => onProgress?.(`[Directors] ${msg}`),
      }
    ),
  ]);

  // Process results
  const announcementsRaw = extractResult(annResult, "Announcements");
  const shareholdingRaw = extractResult(shResult, "Shareholding");
  const screenerLegalRaw = extractResult(scrResult, "Screener Legal");

  // Normalize and merge
  const announcements = normalizeAnnouncements(announcementsRaw);
  const shareholding = mergeShareholding(shareholdingRaw, screenerLegalRaw);
  const directors = normalizeDirectors(screenerLegalRaw);

  // Metadata
  const totalSteps =
    (annResult.value?.stepCount || 0) +
    (shResult.value?.stepCount || 0) +
    (scrResult.value?.stepCount || 0);

  const totalDuration = Math.max(
    annResult.value?.durationMs || 0,
    shResult.value?.durationMs || 0,
    scrResult.value?.durationMs || 0
  );

  onProgress?.(
    `Legal extraction complete — ${totalSteps} steps in ${(totalDuration / 1000).toFixed(1)}s`
  );

  return {
    announcements,
    shareholding,
    directors,
    metadata: {
      agent: "legal",
      company: ticker,
      totalSteps,
      totalDurationMs: totalDuration,
      callResults: {
        announcements: { steps: annResult.value?.stepCount, error: annResult.value?.error || annResult.reason?.message },
        shareholding: { steps: shResult.value?.stepCount, error: shResult.value?.error || shResult.reason?.message },
        screener: { steps: scrResult.value?.stepCount, error: scrResult.value?.error || scrResult.reason?.message },
      },
    },
  };
}

// ─── TinyFish Goal Prompts ──────────────────────────────────────────────

function buildAnnouncementsGoal(companyName) {
  return `On the BSE India corporate announcements page, in the company search field, type "${companyName}". 
Set the date range to the last 12 months from today. Click Search or submit the form.
Extract up to 20 announcements from the results.

For each announcement, extract:
- date (YYYY-MM-DD format)
- subject (full headline text)
- category — classify each as one of: "Board Meeting", "Financial Results", "Director Change", "Pledge", "SEBI", "Dividend", "AGM", "Other"

Return as structured JSON:
{
  "announcements": [
    { "date": "2026-02-15", "subject": "Board Meeting Outcome - Quarterly Results Q3 FY26", "category": "Financial Results" }
  ]
}

Sort by date descending (most recent first).`;
}

function buildShareholdingGoal(companyName, bseCode) {
  const navigationInstr = bseCode
    ? `This page should already show the shareholding pattern for "${companyName}" (BSE Code: ${bseCode}). If the data is not visible, enter the BSE code "${bseCode}" in the scrip code field and submit.`
    : `On the BSE India shareholding pattern page, search for "${companyName}".`;

  return `${navigationInstr}
Extract the latest shareholding pattern data.

Get:
- Promoter & Promoter Group holding percentage
- Pledged shares as percentage of total promoter shares
- Public holding percentage
- FII (Foreign Institutional Investor) holding percentage
- DII (Domestic Institutional Investor) holding percentage
- Retail Individual holding percentage

If quarterly trend data is visible, extract the same data for the last 4 quarters.

Return as JSON:
{
  "shareholding": {
    "latest": {
      "quarter": "Dec 2025",
      "promoterHolding": 54.3,
      "pledgedPercent": 0,
      "publicHolding": 45.7,
      "fiiHolding": 22.1,
      "diiHolding": 14.8,
      "retailHolding": 8.8
    },
    "trend": [
      { "quarter": "Dec 2025", "promoterHolding": 54.3, "pledgedPercent": 0, "fiiHolding": 22.1, "diiHolding": 14.8 },
      { "quarter": "Sep 2025", "promoterHolding": 54.3, "pledgedPercent": 0, "fiiHolding": 21.5, "diiHolding": 14.2 }
    ]
  }
}

All values as percentages (plain numbers, not strings).`;
}

function buildScreenerLegalGoal(companyName) {
  return `On this Screener.in page for ${companyName}, do two things:

1) Scroll to the Shareholding Pattern section. Extract the quarterly promoter holding %, 
   FII %, DII % for the last 4-6 quarters (as shown in the chart or table).

2) Look for the Board of Directors or Key People section if visible.
   Extract names and designations of current directors/officers.

Return as JSON:
{
  "shareholdingTrend": [
    { "quarter": "Dec 2025", "promoters": 54.3, "fii": 22.1, "dii": 14.8, "public": 8.8 }
  ],
  "directors": [
    { "name": "Deepinder Goyal", "designation": "Chairman & Managing Director" }
  ]
}`;
}

// ─── Result Extraction & Normalization ──────────────────────────────────

function extractResult(settledResult, label) {
  if (settledResult.status === "fulfilled") {
    const { resultJson, error } = settledResult.value;
    if (error) {
      console.warn(`[LegalAgent] ${label} returned with error: ${error}`);
      return null;
    }
    return resultJson;
  }
  console.error(`[LegalAgent] ${label} call rejected:`, settledResult.reason?.message);
  return null;
}

/**
 * Normalize announcements array.
 */
function normalizeAnnouncements(raw) {
  if (!raw) return [];

  const annList = Array.isArray(raw.announcements)
    ? raw.announcements
    : Array.isArray(raw)
      ? raw
      : [];

  const validCategories = [
    "Board Meeting", "Financial Results", "Director Change",
    "Pledge", "SEBI", "Dividend", "AGM", "Other",
  ];

  return annList.map((a) => ({
    date: a.date || "Unknown",
    subject: a.subject || a.headline || a.title || "Unknown",
    category: validCategories.includes(a.category) ? a.category : "Other",
  }));
}

/**
 * Merge shareholding data from BSE and Screener sources.
 * BSE is primary; Screener is backup for trend data.
 */
function mergeShareholding(bseData, screenerData) {
  const defaultShareholding = {
    latest: {
      quarter: "Unknown",
      promoterHolding: null,
      pledgedPercent: 0,
      publicHolding: null,
      fiiHolding: null,
      diiHolding: null,
      retailHolding: null,
    },
    trend: [],
  };

  // Try BSE data first (primary source)
  if (bseData && bseData.shareholding) {
    const sh = bseData.shareholding;
    return {
      latest: {
        quarter: sh.latest?.quarter || "Unknown",
        promoterHolding: toNum(sh.latest?.promoterHolding),
        pledgedPercent: toNum(sh.latest?.pledgedPercent) || 0,
        publicHolding: toNum(sh.latest?.publicHolding),
        fiiHolding: toNum(sh.latest?.fiiHolding),
        diiHolding: toNum(sh.latest?.diiHolding),
        retailHolding: toNum(sh.latest?.retailHolding),
      },
      trend: Array.isArray(sh.trend)
        ? sh.trend.map((t) => ({
            quarter: t.quarter,
            promoterHolding: toNum(t.promoterHolding),
            pledgedPercent: toNum(t.pledgedPercent) || 0,
            fiiHolding: toNum(t.fiiHolding),
            diiHolding: toNum(t.diiHolding),
          }))
        : [],
    };
  }

  // Fallback to Screener data
  if (screenerData && screenerData.shareholdingTrend) {
    const trend = Array.isArray(screenerData.shareholdingTrend)
      ? screenerData.shareholdingTrend
      : [];

    if (trend.length > 0) {
      const latest = trend[0];
      return {
        latest: {
          quarter: latest.quarter || "Unknown",
          promoterHolding: toNum(latest.promoters),
          pledgedPercent: 0, // Screener doesn't show pledge data
          publicHolding: toNum(latest.public),
          fiiHolding: toNum(latest.fii),
          diiHolding: toNum(latest.dii),
          retailHolding: null,
        },
        trend: trend.map((t) => ({
          quarter: t.quarter,
          promoterHolding: toNum(t.promoters),
          pledgedPercent: 0,
          fiiHolding: toNum(t.fii),
          diiHolding: toNum(t.dii),
        })),
      };
    }
  }

  return defaultShareholding;
}

/**
 * Normalize directors list.
 */
function normalizeDirectors(screenerData) {
  if (!screenerData || !Array.isArray(screenerData.directors)) return [];

  return screenerData.directors.map((d) => ({
    name: d.name || "Unknown",
    designation: d.designation || d.role || "Unknown",
  }));
}

/**
 * Safely convert to number.
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

export default { runLegalAgent };
