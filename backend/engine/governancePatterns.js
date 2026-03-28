/**
 * Governance Pattern Detection
 *
 * Multi-signal pattern recognition from legal + financial data.
 * Detects compound governance patterns that single-pillar analysis misses.
 *
 * Patterns:
 * - Promoter Stress Spiral: pledging up + profit down + director exits
 * - Governance Cleanup: pledge reduction + debt reduction + FII inflow
 * - Shell Company Indicators: low revenue + high pledging + frequent director changes
 * - Institutional Accumulation: FII increase + promoter stable + earnings growth
 * - Debt Trap: rising debt + declining coverage + falling margins
 */

/**
 * Detect governance patterns by cross-referencing legal and financial signals.
 *
 * @param {object} legalData - Raw legal agent data
 * @param {object} allRatios - Computed financial ratios
 * @param {object} trajectories - From computeRatioMomentum()
 * @param {Array} redFlags - From redFlagEngine
 * @returns {{ patterns: Array, riskLevel: string, summary: string }}
 */
export function detectGovernancePatterns(legalData, allRatios, trajectories, redFlags) {
  const patterns = [];
  const shareholding = legalData?.shareholding || {};
  const directors = legalData?.directors || {};
  const announcements = legalData?.announcements || [];

  // ─── Pattern 1: Promoter Stress Spiral ─────────────────────────────

  const promoterStressSignals = [];
  const pledging = shareholding.pledgingPercent || 0;
  const pledgeTrend = shareholding.pledgeTrend;
  const directorChanges = directors.directorChanges || 0;
  const profitTrajectory = trajectories?.netProfit;

  if (pledging > 30) promoterStressSignals.push(`Pledging at ${pledging}%`);
  if (pledgeTrend === "UP") promoterStressSignals.push("Pledge trend increasing");
  if (directorChanges >= 3) promoterStressSignals.push(`${directorChanges} director changes`);
  if (profitTrajectory?.direction === "DECLINING") promoterStressSignals.push("Net profit declining");
  if (allRatios.debtToEquity > 2) promoterStressSignals.push(`High leverage (D/E: ${allRatios.debtToEquity})`);

  if (promoterStressSignals.length >= 3) {
    patterns.push({
      pattern: "PROMOTER_STRESS_SPIRAL",
      severity: "CRITICAL",
      confidence: Math.min(0.95, 0.5 + promoterStressSignals.length * 0.12),
      signals: promoterStressSignals,
      description: "Multiple signals suggest promoter financial distress — pledging, profit decline, and governance instability converge.",
      actionableInsight: "High risk of forced selling or capital restructuring. Monitor promoter transactions closely.",
    });
  }

  // ─── Pattern 2: Governance Cleanup ──────────────────────────────────

  const cleanupSignals = [];
  if (pledging < 5) cleanupSignals.push("Minimal/zero pledging");
  if (pledgeTrend === "DOWN") cleanupSignals.push("Pledge trend decreasing");
  if (shareholding.fiiTrend === "UP") cleanupSignals.push("FII accumulation");
  if (allRatios.debtToEquity !== null && allRatios.debtToEquity < 0.5) cleanupSignals.push("Low leverage");
  if (trajectories?.netProfit?.direction === "IMPROVING") cleanupSignals.push("Improving profitability");
  if (directorChanges <= 1) cleanupSignals.push("Board stability");

  if (cleanupSignals.length >= 4) {
    patterns.push({
      pattern: "GOVERNANCE_CLEANUP",
      severity: "POSITIVE",
      confidence: Math.min(0.95, 0.5 + cleanupSignals.length * 0.1),
      signals: cleanupSignals,
      description: "Strong governance signals — low pledging, institutional interest, and financial discipline align.",
      actionableInsight: "Positive structural trajectory. Company demonstrates governance maturity.",
    });
  }

  // ─── Pattern 3: Shell Company Indicators ────────────────────────────

  const shellSignals = [];
  if (allRatios.latestRevenue !== null && allRatios.latestRevenue < 50) shellSignals.push(`Very low revenue (₹${allRatios.latestRevenue}Cr)`);
  if (pledging > 75) shellSignals.push(`Extreme pledging (${pledging}%)`);
  if (directorChanges >= 4) shellSignals.push(`${directorChanges} director changes (churning)`);
  if (allRatios.totalAssets !== null && allRatios.totalAssets < 100) shellSignals.push("Minimal assets");
  if (allRatios.returnOnEquity !== null && allRatios.returnOnEquity < -10) shellSignals.push("Deeply negative ROE");

  // Check for suspicious announcements keywords
  const suspiciousKeywords = ["name change", "amalgamation", "merger", "delisting"];
  const suspiciousCount = announcements.filter((a) =>
    suspiciousKeywords.some((kw) => (a.subject || a.text || "").toLowerCase().includes(kw))
  ).length;
  if (suspiciousCount >= 2) shellSignals.push(`${suspiciousCount} suspicious corporate actions`);

  if (shellSignals.length >= 3) {
    patterns.push({
      pattern: "SHELL_COMPANY_INDICATORS",
      severity: "CRITICAL",
      confidence: Math.min(0.90, 0.4 + shellSignals.length * 0.12),
      signals: shellSignals,
      description: "Multiple signals suggest potential shell company characteristics — low business activity with governance red flags.",
      actionableInsight: "Exercise extreme caution. Verify business operations and revenue sources independently.",
    });
  }

  // ─── Pattern 4: Institutional Accumulation ──────────────────────────

  const accumSignals = [];
  if (shareholding.fiiTrend === "UP") accumSignals.push("FII holding increasing");
  if (shareholding.promoterHoldingTrend === "STABLE" || shareholding.promoterHolding > 50) {
    accumSignals.push("Promoter holding stable/strong");
  }
  if (trajectories?.revenue?.direction === "IMPROVING") accumSignals.push("Revenue trajectory improving");
  if (trajectories?.netProfit?.direction === "IMPROVING") accumSignals.push("Profit trajectory improving");
  if (allRatios.returnOnEquity > 15) accumSignals.push(`Strong ROE (${allRatios.returnOnEquity}%)`);

  if (accumSignals.length >= 3) {
    patterns.push({
      pattern: "INSTITUTIONAL_ACCUMULATION",
      severity: "POSITIVE",
      confidence: Math.min(0.90, 0.5 + accumSignals.length * 0.1),
      signals: accumSignals,
      description: "Institutional investors are accumulating alongside improving fundamentals.",
      actionableInsight: "Smart money inflows combined with earnings growth. Potentially strong medium-term outlook.",
    });
  }

  // ─── Pattern 5: Debt Trap ──────────────────────────────────────────

  const debtTrapSignals = [];
  if (allRatios.debtToEquity > 1.5) debtTrapSignals.push(`High D/E (${allRatios.debtToEquity})`);
  if (trajectories?.debtToEquity?.direction === "IMPROVING" && trajectories.debtToEquity.momentum > 20) {
    debtTrapSignals.push("Debt increasing faster than equity");
  }
  if (allRatios.interestCoverage !== null && allRatios.interestCoverage < 2) {
    debtTrapSignals.push(`Low interest coverage (${allRatios.interestCoverage}x)`);
  }
  if (trajectories?.operatingMargin?.direction === "DECLINING") debtTrapSignals.push("Operating margins declining");
  if (trajectories?.netProfit?.direction === "DECLINING") debtTrapSignals.push("Profits declining alongside debt");

  if (debtTrapSignals.length >= 3) {
    patterns.push({
      pattern: "DEBT_TRAP",
      severity: "HIGH",
      confidence: Math.min(0.90, 0.45 + debtTrapSignals.length * 0.12),
      signals: debtTrapSignals,
      description: "Company may be caught in a debt trap — rising leverage with declining ability to service it.",
      actionableInsight: "Monitor debt covenants and refinancing risk. Cash flow deterioration could accelerate.",
    });
  }

  // ─── Compute overall governance risk level ──────────────────────────

  const criticalPatterns = patterns.filter((p) => p.severity === "CRITICAL").length;
  const highPatterns = patterns.filter((p) => p.severity === "HIGH").length;
  const positivePatterns = patterns.filter((p) => p.severity === "POSITIVE").length;

  let riskLevel;
  if (criticalPatterns >= 1) riskLevel = "CRITICAL";
  else if (highPatterns >= 1) riskLevel = "HIGH";
  else if (positivePatterns >= 2) riskLevel = "LOW";
  else if (positivePatterns >= 1) riskLevel = "MODERATE";
  else riskLevel = "MODERATE";

  // Generate summary
  const summary = patterns.length === 0
    ? "No significant governance patterns detected."
    : patterns.map((p) => `[${p.severity}] ${p.pattern}: ${p.description}`).join(" | ");

  return { patterns, riskLevel, summary };
}

export default { detectGovernancePatterns };
