/**
 * Relationship Graph Engine — Upgrade 18
 *
 * Maps company relationships: promoter group, competitors,
 * key dependencies, and shared directors.
 * Uses companies.json for sector-based competitor mapping and
 * legal/financial data for dependency/director analysis.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const companiesPath = join(__dirname, "../config/companies.json");

let companiesList = [];
try {
  companiesList = JSON.parse(readFileSync(companiesPath, "utf-8"));
} catch {
  console.warn("[RelationshipGraph] Could not load companies.json");
}

// ─── Known Promoter Groups ─────────────────────────────────────────
const PROMOTER_GROUPS = {
  "Tata Group": ["TCS", "TITAN", "TATASTEEL", "TATAPOWER", "TATAMOTORS", "TATACONSUM", "TATACHEM", "VOLTAS", "TRENT", "INDHOTEL"],
  "Reliance Group": ["RELIANCE", "JIOFIN"],
  "Adani Group": ["ADANIENT", "ADANIPORTS", "ADANIGREEN", "ADANITRANS", "AWL", "ADANIPOWER", "ACC", "AMBUJACEM", "NDTV"],
  "Bajaj Group": ["BAJFINANCE", "BAJAJFINSV", "BAJAJAUTO", "BAJAJHLDNG"],
  "Mahindra Group": ["M&M", "TECHM", "MAHLIFE"],
  "Birla Group": ["ULTRACEMCO", "GRASIM", "HINDALCO", "ABCAPITAL", "ABFRL"],
  "HDFC Group": ["HDFCBANK", "HDFCLIFE", "HDFCAMC"],
  "ICICI Group": ["ICICIBANK", "ICICIGI", "ICICIPRULI"],
  "Wipro Group": ["WIPRO"],
  "HCL Group": ["HCLTECH"],
  "Kotak Group": ["KOTAKBANK"],
  "ITC Group": ["ITC"],
  "SBI Group": ["SBIN", "SBILIFE", "SBICARD"],
  "Bharti Group": ["BHARTIARTL"],
  "Sun Pharma Group": ["SUNPHARMA"],
  "Infosys Group": ["INFY"],
};

/**
 * Build a company relationship graph.
 *
 * @param {object} company - Resolved company from companies.json
 * @param {object|null} legalData - Legal agent output (directors, announcements)
 * @param {object|null} financialData - Financial agent output
 * @returns {object} Relationship graph
 */
export function buildRelationshipGraph(company, legalData, financialData) {
  const ticker = company?.ticker || "";
  const sector = company?.sector || "";

  return {
    company: { name: company?.name, ticker, sector },
    promoterGroup: mapPromoterGroup(ticker),
    competitors: mapCompetitors(ticker, sector),
    dependencies: analyzeDependencies(financialData, legalData),
    directorNetwork: analyzeDirectorNetwork(legalData),
    groupRiskLevel: computeGroupRisk(ticker),
  };
}

/**
 * Find which promoter group this company belongs to.
 */
function mapPromoterGroup(ticker) {
  for (const [groupName, tickers] of Object.entries(PROMOTER_GROUPS)) {
    if (tickers.includes(ticker)) {
      const siblings = tickers.filter(t => t !== ticker);
      const listedSiblings = siblings
        .map(t => companiesList.find(c => c.ticker === t))
        .filter(Boolean)
        .map(c => ({ name: c.name, ticker: c.ticker, sector: c.sector }));

      return {
        groupName,
        totalListedCompanies: tickers.length,
        siblings: listedSiblings,
        contagionRisk: tickers.length > 5 ? "HIGH" : tickers.length > 2 ? "MODERATE" : "LOW",
      };
    }
  }

  return {
    groupName: null,
    totalListedCompanies: 1,
    siblings: [],
    contagionRisk: "LOW",
  };
}

/**
 * Find competitors in the same sector from companies.json.
 */
function mapCompetitors(ticker, sector) {
  if (!sector) return [];

  return companiesList
    .filter(c => c.sector === sector && c.ticker !== ticker)
    .map(c => ({
      name: c.name,
      ticker: c.ticker,
      industry: c.industry,
    }))
    .slice(0, 8);
}

/**
 * Analyze key customer/supplier dependencies from financial data.
 */
function analyzeDependencies(financialData, legalData) {
  const deps = {
    revenueConcentration: "UNKNOWN",
    supplierConcentration: "UNKNOWN",
    flags: [],
  };

  if (!financialData) return deps;

  // Check for related party transactions that might indicate dependency
  const announcements = legalData?.announcements || [];
  const rptAnnouncements = announcements.filter(a =>
    a.subject && (
      a.subject.toLowerCase().includes("related party") ||
      a.subject.toLowerCase().includes("material subsidiary")
    )
  );

  if (rptAnnouncements.length > 3) {
    deps.flags.push({
      severity: "WATCH",
      message: `${rptAnnouncements.length} related party transaction disclosures — review for dependency`,
    });
  }

  // Revenue concentration inference from financial ratios
  const ratios = financialData?.ratios || {};
  if (ratios.exportRevenuePct && ratios.exportRevenuePct > 60) {
    deps.flags.push({
      severity: "INFO",
      message: `High export revenue (${ratios.exportRevenuePct}%) — currency and geo-political exposure`,
    });
  }

  deps.revenueConcentration = rptAnnouncements.length > 5 ? "HIGH" : rptAnnouncements.length > 2 ? "MODERATE" : "LOW";

  return deps;
}

/**
 * Analyze shared director network from legal data.
 */
function analyzeDirectorNetwork(legalData) {
  if (!legalData) return { directors: [], sharedBoardFlags: [] };

  const directors = legalData.directors || [];
  const announcements = legalData.announcements || [];

  // Extract director changes
  const directorChanges = announcements.filter(a =>
    a.category === "Director Change" || (a.subject && a.subject.toLowerCase().includes("director"))
  );

  const network = {
    totalDirectors: directors.length,
    recentChanges: directorChanges.length,
    independentDirectors: directors.filter(d =>
      d.designation && d.designation.toLowerCase().includes("independent")
    ).length,
    flags: [],
  };

  // Flag excessive director changes
  if (directorChanges.length >= 3) {
    network.flags.push({
      severity: "WATCH",
      message: `${directorChanges.length} director changes in recent period — board instability`,
    });
  }

  // Flag low board independence
  if (directors.length > 0) {
    const indepRatio = network.independentDirectors / directors.length;
    if (indepRatio < 0.33) {
      network.flags.push({
        severity: "HIGH",
        message: `Low board independence: ${(indepRatio * 100).toFixed(0)}% (SEBI requires ≥33%)`,
      });
    }
  }

  return network;
}

/**
 * Compute group-level risk based on promoter group size and exposure.
 */
function computeGroupRisk(ticker) {
  for (const [groupName, tickers] of Object.entries(PROMOTER_GROUPS)) {
    if (tickers.includes(ticker)) {
      if (tickers.length >= 8) return { level: "HIGH", reason: `Large group (${groupName}: ${tickers.length} listed companies) — contagion risk` };
      if (tickers.length >= 4) return { level: "MODERATE", reason: `Medium group (${groupName}: ${tickers.length} listed companies)` };
      return { level: "LOW", reason: `Small group (${groupName}: ${tickers.length} listed companies)` };
    }
  }
  return { level: "LOW", reason: "Standalone company — no group contagion risk" };
}

export default { buildRelationshipGraph };
