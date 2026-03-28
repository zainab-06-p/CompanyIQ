/**
 * Annual Report Agent
 *
 * Reads the actual Annual Report from BSE India filings.
 * Extracts management commentary, auditor opinion, contingent liabilities,
 * and related party transactions — data only available in the actual PDF.
 *
 * Makes 2 TinyFish calls:
 *   1. BSE India — find and read the latest Annual Report filing
 *   2. Screener.in fallback if BSE fails
 *
 * Expected steps: 20–35 total
 * Expected time: 60–120 seconds
 */

import { callTinyFish } from "./tinyfish.js";

/**
 * Run the Annual Report Agent for a company.
 *
 * @param {object} company - Company object from companies.json
 * @param {function} [onProgress] - Progress callback: (message) => void
 * @returns {Promise<object>}
 */
export async function runAnnualReportAgent(company, onProgress) {
  const { name, ticker, screenerSlug } = company;

  onProgress?.(`Accessing annual report for ${name}...`);

  // Primary: BSE India filings
  const bseResult = await callTinyFish(
    "https://www.bseindia.com/corporates/ann.html",
    buildBSEAnnualReportGoal(name),
    {
      browserProfile: "stealth",
      onProgress: (msg) => onProgress?.(`[Annual Report] ${msg}`),
    }
  );

  const raw = bseResult?.resultJson || null;

  if (!raw || !raw.reportYear) {
    onProgress?.(`BSE annual report extraction incomplete — trying Screener.in fallback`);

    const screenerResult = await callTinyFish(
      `https://www.screener.in/company/${screenerSlug}/`,
      buildScreenerFallbackGoal(name),
      {
        browserProfile: "lite",
        onProgress: (msg) => onProgress?.(`[Annual Report Fallback] ${msg}`),
      }
    );

    const screenerRaw = screenerResult?.resultJson || null;
    return normalizeAnnualReport(
      screenerRaw,
      ticker,
      (bseResult?.durationMs || 0) + (screenerResult?.durationMs || 0)
    );
  }

  onProgress?.(
    `Annual report extracted in ${((bseResult.durationMs || 0) / 1000).toFixed(1)}s`
  );
  return normalizeAnnualReport(raw, ticker, bseResult.durationMs || 0);
}

// ─── TinyFish Goal Prompts ──────────────────────────────────────────────

function buildBSEAnnualReportGoal(name) {
  return `On the BSE India corporate announcements page, search for "${name}".
Filter by category "Annual Report". Find the most recent Annual Report. Open it.
If it links to a PDF, read the document and extract:

1. MANAGEMENT DISCUSSION & ANALYSIS:
   - One sentence performance overview
   - One sentence management outlook for next year

2. INDEPENDENT AUDITORS REPORT:
   - Audit firm name
   - Opinion type: "Unqualified", "Qualified", "Adverse", or "Disclaimer of Opinion"
   - Any qualifications raised (brief description)

3. CONTINGENT LIABILITIES (from Notes to Financial Statements):
   - Top 2 items: description and amount in INR crores
   - Total of all contingent liabilities

4. RELATED PARTY TRANSACTIONS:
   - Top 3 transactions: party name, transaction type, amount in INR crores

Also note the financial year covered (e.g. "FY2024-25").

Return ONLY this JSON:
{
  "reportYear": "FY2024-25",
  "managementCommentary": {
    "performanceOverview": "One sentence summary",
    "outlookStatement": "Forward looking statement",
    "keyRisks": [],
    "strategicInitiatives": []
  },
  "auditorReport": {
    "firmName": "Deloitte Haskins & Sells LLP",
    "opinion": "Unqualified",
    "keyAuditMatters": [],
    "qualifications": [],
    "emphasisOfMatter": []
  },
  "contingentLiabilities": [
    { "description": "Income tax demand under appeal", "amountCrores": 450.5, "type": "Tax" }
  ],
  "relatedPartyTransactions": [
    { "partyName": "Group subsidiary", "transactionType": "Purchase of goods", "amountCrores": 1200, "armLength": true }
  ],
  "totalContingentLiabilityValue": 450.5
}`;
}

function buildScreenerFallbackGoal(name) {
  return `On the Screener.in page for ${name}, look for any annual report summary, key financial highlights, or notes visible on the page.

Return ONLY this JSON (use empty strings/arrays if not found):
{
  "reportYear": null,
  "managementCommentary": { "performanceOverview": "", "outlookStatement": "", "keyRisks": [], "strategicInitiatives": [] },
  "auditorReport": { "firmName": "", "opinion": "Unqualified", "keyAuditMatters": [], "qualifications": [], "emphasisOfMatter": [] },
  "contingentLiabilities": [],
  "relatedPartyTransactions": [],
  "totalContingentLiabilityValue": 0
}`;
}

// ─── Normalizer ──────────────────────────────────────────────────────────

function normalizeAnnualReport(raw, ticker, durationMs) {
  if (!raw) {
    return {
      available: false,
      reportYear: null,
      managementCommentary: null,
      auditorReport: null,
      contingentLiabilities: [],
      relatedPartyTransactions: [],
      totalContingentLiabilityValue: 0,
      riskSignals: [],
      metadata: { agent: "annualReport", company: ticker, durationMs },
    };
  }

  // Derive risk signals from the report content
  const riskSignals = [];

  const opinion = raw.auditorReport?.opinion || "Unqualified";
  if (opinion !== "Unqualified") {
    riskSignals.push({
      severity: "HIGH",
      message: `Auditor issued a ${opinion} opinion — requires immediate attention`,
    });
  }

  if ((raw.auditorReport?.qualifications || []).length > 0) {
    riskSignals.push({
      severity: "HIGH",
      message: `${raw.auditorReport.qualifications.length} audit qualification(s) found in the report`,
    });
  }

  if ((raw.auditorReport?.emphasisOfMatter || []).length > 0) {
    riskSignals.push({
      severity: "WATCH",
      message: `Auditor drew attention to ${raw.auditorReport.emphasisOfMatter.length} matter(s)`,
    });
  }

  const totalContingent = Number(raw.totalContingentLiabilityValue) || 0;
  if (totalContingent > 1000) {
    riskSignals.push({
      severity: "HIGH",
      message: `Large contingent liabilities of ₹${totalContingent.toFixed(0)} Cr — could impact financials if materialised`,
    });
  } else if (totalContingent > 200) {
    riskSignals.push({
      severity: "WATCH",
      message: `Contingent liabilities of ₹${totalContingent.toFixed(0)} Cr disclosed`,
    });
  }

  return {
    available: true,
    reportYear: raw.reportYear || null,
    managementCommentary: raw.managementCommentary || null,
    auditorReport: raw.auditorReport || null,
    contingentLiabilities: raw.contingentLiabilities || [],
    relatedPartyTransactions: raw.relatedPartyTransactions || [],
    totalContingentLiabilityValue: totalContingent,
    riskSignals,
    metadata: { agent: "annualReport", company: ticker, durationMs },
  };
}
