/**
 * Context-Aware Weight Engine
 *
 * Replaces hardcoded pillar weights with dynamic weights based on:
 *   1. Company Sector (Banking vs Tech vs FMCG vs Manufacturing)
 *   2. Company Stage (Large-cap established vs Growth vs Early)
 *   3. Market Regime (Bull vs Stress vs Crisis)
 *
 * Derived from ResearchIQ's federated specialist architecture:
 * different company types need different scoring emphasis.
 */

// ─── Sector Weight Profiles ─────────────────────────────────────────────

const SECTOR_WEIGHTS = {
  // Banking: capital adequacy and regulation matter most
  "Banking & Finance": {
    financial: 0.45,
    legal: 0.30,
    sentiment: 0.25,
    label: "Banking — financial health and regulatory compliance emphasized",
  },

  // IT/Tech: growth and talent matter more, losses can be acceptable
  "Information Technology": {
    financial: 0.35,
    legal: 0.20,
    sentiment: 0.45,
    label: "Technology — growth narrative and market sentiment emphasized",
  },

  "Internet & Technology": {
    financial: 0.30,
    legal: 0.20,
    sentiment: 0.50,
    label: "Internet/Tech — sentiment and growth narrative heavily weighted",
  },

  // FMCG: brand perception = revenue, sentiment matters a lot
  FMCG: {
    financial: 0.35,
    legal: 0.20,
    sentiment: 0.45,
    label: "FMCG — brand perception and consumer sentiment emphasized",
  },

  // Telecom: capital intensive, regulatory heavy
  Telecom: {
    financial: 0.40,
    legal: 0.35,
    sentiment: 0.25,
    label: "Telecom — capital structure and regulatory compliance emphasized",
  },

  // Pharma: regulatory compliance is critical
  Pharmaceuticals: {
    financial: 0.35,
    legal: 0.35,
    sentiment: 0.30,
    label: "Pharma — regulatory compliance and pipeline sentiment emphasized",
  },

  // Auto/Manufacturing: efficiency ratios and debt servicing
  Automobile: {
    financial: 0.45,
    legal: 0.25,
    sentiment: 0.30,
    label: "Auto — financial efficiency and market sentiment balanced",
  },

  // Conglomerate: balanced across all pillars
  Conglomerate: {
    financial: 0.40,
    legal: 0.30,
    sentiment: 0.30,
    label: "Conglomerate — balanced weight across all pillars",
  },

  // Energy: capital intensive, solvency focused
  "Oil & Gas": {
    financial: 0.45,
    legal: 0.30,
    sentiment: 0.25,
    label: "Energy — solvency and capital efficiency emphasized",
  },

  // Metals & Mining
  "Metals & Mining": {
    financial: 0.45,
    legal: 0.25,
    sentiment: 0.30,
    label: "Metals — cyclical, financial strength emphasized",
  },

  // Tyres / Rubber Manufacturing
  Tyres: {
    financial: 0.45,
    legal: 0.25,
    sentiment: 0.30,
    label: "Tyres — manufacturing efficiency and financial health emphasized",
  },

  // Manufacturing (general)
  Manufacturing: {
    financial: 0.45,
    legal: 0.25,
    sentiment: 0.30,
    label: "Manufacturing — financial efficiency and capital utilization emphasized",
  },

  // Chemicals
  Chemicals: {
    financial: 0.40,
    legal: 0.30,
    sentiment: 0.30,
    label: "Chemicals — balanced with regulatory compliance focus",
  },

  // Paints
  Paints: {
    financial: 0.35,
    legal: 0.20,
    sentiment: 0.45,
    label: "Paints — brand perception and consumer sentiment emphasized",
  },

  // Power & Utilities
  Power: {
    financial: 0.45,
    legal: 0.30,
    sentiment: 0.25,
    label: "Power — capital-intensive, financial health and regulatory compliance emphasized",
  },

  // Mining
  Mining: {
    financial: 0.40,
    legal: 0.35,
    sentiment: 0.25,
    label: "Mining — regulatory and environmental compliance critical",
  },

  // Renewable Energy
  "Renewable Energy": {
    financial: 0.35,
    legal: 0.25,
    sentiment: 0.40,
    label: "Renewables — growth narrative and policy sentiment emphasized",
  },

  // Insurance
  Insurance: {
    financial: 0.45,
    legal: 0.30,
    sentiment: 0.25,
    label: "Insurance — financial strength and regulatory compliance emphasized",
  },

  // Defence
  Defence: {
    financial: 0.40,
    legal: 0.30,
    sentiment: 0.30,
    label: "Defence — government policy and order book sentiment balanced",
  },

  // Consumer Electronics
  "Consumer Electronics": {
    financial: 0.35,
    legal: 0.20,
    sentiment: 0.45,
    label: "Consumer Electronics — brand and product sentiment heavily weighted",
  },

  // Retail
  Retail: {
    financial: 0.40,
    legal: 0.20,
    sentiment: 0.40,
    label: "Retail — consumer spending and brand sentiment balanced with financials",
  },

  // Fintech
  Fintech: {
    financial: 0.30,
    legal: 0.25,
    sentiment: 0.45,
    label: "Fintech — growth narrative and regulatory compliance balanced",
  },

  // Real Estate
  "Real Estate": {
    financial: 0.40,
    legal: 0.35,
    sentiment: 0.25,
    label: "Real Estate — capital structure and regulatory compliance emphasized",
  },

  // Infrastructure
  Infrastructure: {
    financial: 0.40,
    legal: 0.30,
    sentiment: 0.30,
    label: "Infrastructure — government policy, order book, and financial capacity balanced",
  },
};

// Default weights when sector is unknown
const DEFAULT_WEIGHTS = {
  financial: 0.45,
  legal: 0.30,
  sentiment: 0.25,
  label: "Default — standard weight distribution",
};

// ─── Company Stage Adjustments ──────────────────────────────────────────

/**
 * Determine company stage from financial data and adjust weights.
 *
 * @param {object} allRatios - Computed ratios
 * @param {object} baseWeights - Sector-based weights
 * @returns {{ weights: object, stage: string, adjustments: Array }}
 */
function applyStageAdjustments(allRatios, baseWeights) {
  const adjustments = [];
  const weights = { ...baseWeights };

  const revenue = allRatios?.latestRevenue || 0;
  const netProfit = allRatios?.latestNetProfit || 0;
  const revenueGrowth = allRatios?.revenueCAGR3yr || 0;

  let stage = "ESTABLISHED";

  // Growth stage: high revenue growth, may be loss-making
  if (revenueGrowth > 20 && (netProfit <= 0 || (revenue > 0 && netProfit / revenue < 0.05))) {
    stage = "GROWTH";
    // Reduce financial weight (losses are expected), boost sentiment
    weights.financial = Math.max(0.20, weights.financial - 0.10);
    weights.sentiment = Math.min(0.55, weights.sentiment + 0.10);
    adjustments.push({
      factor: "Growth Stage",
      detail: "High revenue growth with thin/negative margins — financial weight reduced, sentiment weight increased",
      financialDelta: -0.10,
      sentimentDelta: +0.10,
    });
  }

  // Early stage: very small revenue
  if (revenue > 0 && revenue < 500) {
    stage = "EARLY";
    // Legal weight increases (small companies have higher governance risk)
    weights.legal = Math.min(0.40, weights.legal + 0.05);
    weights.financial = Math.max(0.20, weights.financial - 0.05);
    adjustments.push({
      factor: "Early Stage",
      detail: "Small revenue base — governance risk weighted higher",
      legalDelta: +0.05,
      financialDelta: -0.05,
    });
  }

  // Normalize weights to sum to 1.0
  const total = weights.financial + weights.legal + weights.sentiment;
  weights.financial = Math.round((weights.financial / total) * 100) / 100;
  weights.legal = Math.round((weights.legal / total) * 100) / 100;
  weights.sentiment = Math.round((1 - weights.financial - weights.legal) * 100) / 100;

  return { weights, stage, adjustments };
}

// ─── Main Export ─────────────────────────────────────────────────────────

/**
 * Compute context-aware pillar weights for a company.
 *
 * @param {string} sector - Company sector from companies.json
 * @param {object} allRatios - Computed financial ratios
 * @returns {{
 *   weights: { financial: number, legal: number, sentiment: number },
 *   context: {
 *     sector: string,
 *     sectorLabel: string,
 *     stage: string,
 *     adjustments: Array,
 *     isDefault: boolean
 *   }
 * }}
 */
export function computeContextWeights(sector, allRatios) {
  // Step 1: Get sector base weights — try exact match, then fuzzy match
  let sectorProfile = SECTOR_WEIGHTS[sector] || null;
  let isDefault = !sectorProfile;

  // Fuzzy sector matching: if exact key doesn't match, try partial/case-insensitive match
  if (!sectorProfile && sector) {
    const sectorLower = sector.toLowerCase();
    const matchedKey = Object.keys(SECTOR_WEIGHTS).find(k =>
      sectorLower.includes(k.toLowerCase()) || k.toLowerCase().includes(sectorLower)
    );
    if (matchedKey) {
      sectorProfile = SECTOR_WEIGHTS[matchedKey];
      isDefault = false;
      console.log(`[ContextEngine] Fuzzy sector match: "${sector}" → "${matchedKey}"`);
    }
  }

  if (!sectorProfile) sectorProfile = DEFAULT_WEIGHTS;

  const baseWeights = {
    financial: sectorProfile.financial,
    legal: sectorProfile.legal,
    sentiment: sectorProfile.sentiment,
  };

  // Step 2: Apply company stage adjustments
  const { weights, stage, adjustments } = applyStageAdjustments(allRatios, baseWeights);

  return {
    weights,
    context: {
      sector: sector || "Unknown",
      sectorLabel: sectorProfile.label,
      stage,
      adjustments,
      isDefault,
      baseWeights: { ...baseWeights },
    },
  };
}

export default { computeContextWeights };
