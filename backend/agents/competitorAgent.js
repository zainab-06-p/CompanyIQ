/**
 * Competitor Auto-Discovery Agent
 *
 * Autonomously discovers a company's peers/competitors by scraping
 * the Screener.in peers comparison table.
 *
 * No hardcoded company list required — fully dynamic discovery.
 *
 * Makes 1 TinyFish call to Screener.in
 * Expected steps: 10–20 total
 * Expected time: 20–40 seconds
 */

import { callTinyFish } from "./tinyfish.js";
import { resolveCompany } from "../config/companyResolver.js";

/**
 * Discover competitors for a company.
 *
 * @param {object} company - Company object from companies.json
 * @param {function} [onProgress] - Progress callback
 * @returns {Promise<object>} - { sourceCompany, sector, competitors, totalFound, metadata }
 */
export async function discoverCompetitors(company, onProgress) {
  const { name, ticker, screenerSlug, sector } = company;

  onProgress?.(`Discovering competitors for ${name}...`);

  const result = await callTinyFish(
    `https://www.screener.in/company/${screenerSlug}/`,
    buildPeerDiscoveryGoal(name, sector),
    {
      browserProfile: "lite",
      onProgress: (msg) => onProgress?.(`[Competitor Discovery] ${msg}`),
    }
  );

  const raw = result?.resultJson || null;
  const competitors = normalizePeers(raw, ticker);

  onProgress?.(
    `Found ${competitors.length} competitors for ${name} in ${((result?.durationMs || 0) / 1000).toFixed(1)}s`
  );

  return {
    sourceCompany: ticker,
    sector: raw?.industry || sector,
    competitors,
    totalFound: competitors.length,
    metadata: {
      agent: "competitorDiscovery",
      stepCount: result?.stepCount || 0,
      durationMs: result?.durationMs || 0,
      error: result?.error || null,
    },
  };
}

// ─── TinyFish Goal Prompt ─────────────────────────────────────────────────

function buildPeerDiscoveryGoal(name, sector) {
  return `On the Screener.in page for ${name}, scroll down to the "Peers" or "Competition" table.

Extract up to 8 companies from the peers table. For each peer, extract:
- name (full company name)
- ticker (NSE/BSE symbol, e.g. "RELIANCE")
- marketCap (in INR crores, as a number)
- pe (Price-to-Earnings ratio, as a number)
- roce (Return on Capital Employed %, as a number)

Also extract the industry/sector label shown near the table.

Return ONLY this JSON:
{
  "industry": "${sector}",
  "peers": [
    { "name": "Company Name", "ticker": "SYMBOL", "marketCap": 0, "pe": 0, "roce": 0 }
  ],
  "totalPeers": 0
}
Use null for any missing values. Do NOT include ${name} itself in the list.`;
}

// ─── Normalizer ──────────────────────────────────────────────────────────

function normalizePeers(raw, sourceTicker) {
  if (!raw?.peers) return [];

  return (raw.peers || [])
    .filter(
      (p) =>
        p.ticker &&
        p.ticker.toUpperCase() !== sourceTicker.toUpperCase()
    )
    .map((p) => ({
      name: p.name || p.ticker || "Unknown",
      ticker: (p.ticker || "").toUpperCase().trim(),
      marketCap: p.marketCap != null ? Number(p.marketCap) || null : null,
      pe: p.pe != null ? Number(p.pe) || null : null,
      roce: p.roce != null ? Number(p.roce) || null : null,
      salesGrowth: p.salesGrowth != null ? Number(p.salesGrowth) || null : null,
      currentPrice: p.currentPrice != null ? Number(p.currentPrice) || null : null,
      // Flag whether this peer also exists in our companies.json for deep analysis
      inDatabase: resolveCompany(p.ticker || p.name) ? true : false,
    }))
    .slice(0, 8); // cap at 8 competitors
}
