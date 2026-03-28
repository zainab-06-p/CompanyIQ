/**
 * Red Flag Detection Engine
 *
 * Final sweep across ALL data to detect cross-pillar red flags.
 * Runs after all individual scores are computed.
 *
 * Severity levels and point impacts:
 *   CRITICAL → -25 pts
 *   HIGH     → -15 pts
 *   WATCH    → -8 pts
 *   POSITIVE → +5 pts
 */

/**
 * Detect red flags across all data sources.
 *
 * @param {object} allRatios - From computeAllRatios()
 * @param {object} legalData - From runLegalAgent()
 * @param {object} sentimentResult - From computeSentimentScore()
 * @returns {Array<{severity: string, icon: string, message: string}>}
 */
export function detectRedFlags(allRatios, legalData, sentimentResult) {
  const flags = [];

  // ═══════════════════════════════════════════════════════════════════
  // CRITICAL RED FLAGS (-25 points each)
  // ═══════════════════════════════════════════════════════════════════

  // 1. Promoter pledging > 75%
  const pledge = legalData?.shareholding?.latest?.pledgedPercent || 0;
  if (pledge > 75) {
    flags.push({
      severity: "CRITICAL",
      icon: "🚨",
      message: `Promoter pledging exceeds 75% (${pledge}%) — extreme financial stress signal`,
    });
  }

  // 2. Consecutive profit decline (4+ quarters)
  const profits = allRatios?.quarterlyNetProfits || [];
  if (profits.length >= 5) {
    let decliningCount = 0;
    for (let i = 0; i < Math.min(profits.length - 1, 4); i++) {
      if (profits[i] < profits[i + 1]) decliningCount++;
    }
    if (decliningCount >= 4) {
      flags.push({
        severity: "CRITICAL",
        icon: "🚨",
        message: "Net profit declining for 4+ consecutive quarters",
      });
    } else if (decliningCount >= 3) {
      flags.push({
        severity: "HIGH",
        icon: "⚠️",
        message: "Net profit declining for 3 consecutive quarters",
      });
    }
  }

  // 3. Current ratio dangerously low
  if (allRatios?.currentRatio !== null && allRatios?.currentRatio < 0.8) {
    flags.push({
      severity: "CRITICAL",
      icon: "🚨",
      message: `Current ratio at ${allRatios.currentRatio.toFixed(2)} — cannot meet short-term obligations`,
    });
  }

  // 4. Negative equity (debt exceeds assets)
  if (allRatios?.equity !== null && allRatios.equity < 0) {
    flags.push({
      severity: "CRITICAL",
      icon: "🚨",
      message: "Negative shareholders' equity — company technically insolvent",
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // HIGH RISK FLAGS (-15 points each)
  // ═══════════════════════════════════════════════════════════════════

  // 5. Promoter pledging 50–75%
  if (pledge > 50 && pledge <= 75) {
    flags.push({
      severity: "HIGH",
      icon: "⚠️",
      message: `Promoter pledging at ${pledge}% — significant risk`,
    });
  }

  // 6. High leverage
  if (allRatios?.debtToEquity !== null && allRatios.debtToEquity > 3.0) {
    flags.push({
      severity: "HIGH",
      icon: "⚠️",
      message: `Debt-to-Equity at ${allRatios.debtToEquity.toFixed(2)} — highly leveraged`,
    });
  }

  // 7. Negative net profit margin
  if (allRatios?.netProfitMargin !== null && allRatios.netProfitMargin < -5) {
    flags.push({
      severity: "HIGH",
      icon: "⚠️",
      message: `Net profit margin at ${allRatios.netProfitMargin.toFixed(1)}% — sustained losses`,
    });
  }

  // 8. Heavy negative news sentiment
  if (sentimentResult?.total > 0) {
    const negativeRatio = sentimentResult.negative / sentimentResult.total;
    if (negativeRatio > 0.5) {
      flags.push({
        severity: "HIGH",
        icon: "⚠️",
        message: `${Math.round(negativeRatio * 100)}% negative news coverage — heavy negative press`,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // WATCH FLAGS (-8 points each)
  // ═══════════════════════════════════════════════════════════════════

  // 9. Moderate pledging (30–50%)
  if (pledge > 30 && pledge <= 50) {
    flags.push({
      severity: "WATCH",
      icon: "🔶",
      message: `Promoter pledging at ${pledge}% — monitor trend`,
    });
  }

  // 10. Low interest coverage
  if (allRatios?.interestCoverage !== null && allRatios.interestCoverage < 2.0 && allRatios.interestCoverage !== 999) {
    flags.push({
      severity: "WATCH",
      icon: "🔶",
      message: `Interest coverage at ${allRatios.interestCoverage.toFixed(2)} — debt servicing under pressure`,
    });
  }

  // 11. Revenue decline
  if (allRatios?.revenueCAGR3yr !== null && allRatios.revenueCAGR3yr < 0) {
    flags.push({
      severity: "WATCH",
      icon: "🔶",
      message: `Revenue declining — 3-year CAGR is ${allRatios.revenueCAGR3yr.toFixed(1)}%`,
    });
  }

  // 12. Extreme P/E
  if (allRatios?.pe !== null && allRatios.pe > 100) {
    flags.push({
      severity: "WATCH",
      icon: "🔶",
      message: `P/E ratio at ${allRatios.pe.toFixed(0)}x — significantly above market average`,
    });
  }

  // 13. Negative operating cash flow
  const latestOCF = allRatios?.operatingCFRatio;
  if (latestOCF !== null && latestOCF < 0) {
    flags.push({
      severity: "WATCH",
      icon: "🔶",
      message: "Negative operating cash flow — business not generating cash",
    });
  }

  // 14. Building negative sentiment
  if (sentimentResult?.total > 0) {
    const negativeRatio = sentimentResult.negative / sentimentResult.total;
    if (negativeRatio > 0.3 && negativeRatio <= 0.5) {
      flags.push({
        severity: "WATCH",
        icon: "🔶",
        message: `Negative news narrative building (${Math.round(negativeRatio * 100)}% of coverage)`,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // POSITIVE SIGNALS (+5 points each)
  // ═══════════════════════════════════════════════════════════════════

  // 15. Zero pledging
  if (pledge === 0 && legalData?.shareholding?.latest?.promoterHolding > 0) {
    flags.push({
      severity: "POSITIVE",
      icon: "✅",
      message: "Zero promoter pledging — clean governance",
    });
  }

  // 16. Profit growth streak
  if (profits.length >= 4) {
    let growingCount = 0;
    for (let i = 0; i < Math.min(profits.length - 1, 3); i++) {
      if (profits[i] > profits[i + 1]) growingCount++;
    }
    if (growingCount >= 3) {
      flags.push({
        severity: "POSITIVE",
        icon: "✅",
        message: "3+ consecutive quarters of profit growth",
      });
    }
  }

  // 17. Income stock
  if (allRatios?.dividendYield !== null && allRatios.dividendYield > 1) {
    flags.push({
      severity: "POSITIVE",
      icon: "✅",
      message: `Dividend yield at ${allRatios.dividendYield.toFixed(1)}% — income stock`,
    });
  }

  // 18. Strong ROE
  if (allRatios?.returnOnEquity !== null && allRatios.returnOnEquity > 20) {
    flags.push({
      severity: "POSITIVE",
      icon: "✅",
      message: `ROE at ${allRatios.returnOnEquity.toFixed(1)}% — excellent capital efficiency`,
    });
  }

  // 19. Low debt
  if (allRatios?.debtToEquity !== null && allRatios.debtToEquity < 0.1 && allRatios.debtToEquity >= 0) {
    flags.push({
      severity: "POSITIVE",
      icon: "✅",
      message: "Nearly debt-free — strong balance sheet",
    });
  }

  // 20. Strong positive news
  if (sentimentResult?.total > 0 && sentimentResult.positive / sentimentResult.total > 0.7) {
    flags.push({
      severity: "POSITIVE",
      icon: "✅",
      message: `${Math.round((sentimentResult.positive / sentimentResult.total) * 100)}% positive news — strong market narrative`,
    });
  }

  // Sort: CRITICAL first, then HIGH, WATCH, POSITIVE
  const severityOrder = { CRITICAL: 0, HIGH: 1, WATCH: 2, INFO: 3, POSITIVE: 4 };
  flags.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

  return flags;
}

export default { detectRedFlags };
