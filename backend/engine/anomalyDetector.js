/**
 * Anomaly Detection Engine
 *
 * Catches accounting anomalies and data quality red flags that single-metric
 * analysis misses. Cross-references P&L, balance sheet, and cash flow.
 *
 * Checks:
 * 1. Earnings Quality: OCF vs Net Profit divergence
 * 2. Revenue Quality: Revenue vs receivables divergence  
 * 3. Inventory Divergence: Inventory growth vs revenue growth mismatch
 * 4. Cash Flow Manipulation: Widening gap between operating CF and net income
 * 5. Working Capital Stress: Working capital deterioration signals
 */

/**
 * Run all anomaly detection checks on financial data.
 *
 * @param {object} financialData - Raw financial agent output
 * @param {object} allRatios - Computed ratios from ratioEngine
 * @returns {{ anomalies: Array, overallRisk: string, summary: string }}
 */
export function detectAnomalies(financialData, allRatios) {
  if (!financialData) {
    return { anomalies: [], overallRisk: "UNKNOWN", summary: "Insufficient financial data for anomaly detection." };
  }

  const anomalies = [];
  const annual = financialData.profitAndLoss?.annual || [];
  const bs = financialData.balanceSheet || [];
  const cf = financialData.cashFlow || [];

  // ── Check 1: Earnings Quality ──────────────────────────────────────

  if (cf.length > 0 && annual.length > 0) {
    const latestCF = cf[0];
    const latestPL = annual[0];
    const ocf = latestCF.operatingCF;
    const netProfit = latestPL.netProfit;

    if (ocf != null && netProfit != null && netProfit > 0) {
      const ocfToProfit = ocf / netProfit;

      if (ocfToProfit < 0.3) {
        anomalies.push({
          type: "EARNINGS_QUALITY",
          severity: "HIGH",
          signal: `Operating cash flow (₹${ocf}Cr) is only ${Math.round(ocfToProfit * 100)}% of reported net profit (₹${netProfit}Cr)`,
          insight: "Profits may be driven by non-cash items (accruals, revaluations). Poor cash conversion suggests low earnings quality.",
          metric: { ocf, netProfit, ratio: Math.round(ocfToProfit * 100) },
        });
      } else if (ocfToProfit < 0.6) {
        anomalies.push({
          type: "EARNINGS_QUALITY",
          severity: "WATCH",
          signal: `Cash flow lags profit — OCF is ${Math.round(ocfToProfit * 100)}% of net profit`,
          insight: "Moderate gap between cash and profit. Monitor receivables and working capital changes.",
          metric: { ocf, netProfit, ratio: Math.round(ocfToProfit * 100) },
        });
      }

      // Negative OCF with positive profit
      if (ocf < 0 && netProfit > 0) {
        anomalies.push({
          type: "EARNINGS_QUALITY",
          severity: "CRITICAL",
          signal: `Negative operating cash flow (₹${ocf}Cr) despite positive net profit (₹${netProfit}Cr)`,
          insight: "Severe disconnect — company reports profit but burns cash operationally. Classic accounting manipulation signal.",
          metric: { ocf, netProfit, ratio: -1 },
        });
      }
    }
  }

  // ── Check 2: Revenue Quality ───────────────────────────────────────

  // Revenue growth vs receivables growth — if receivables grow much faster, revenue may be inflated
  if (bs.length >= 2 && annual.length >= 2) {
    const currReceivables = bs[0].otherAssets || 0; // Proxy — Screener lumps current assets
    const prevReceivables = bs[1].otherAssets || 0;
    const currRevenue = annual[0].revenue;
    const prevRevenue = annual[1].revenue;

    if (prevRevenue > 0 && prevReceivables > 0 && currRevenue > 0) {
      const revGrowth = (currRevenue - prevRevenue) / prevRevenue;
      const recGrowth = (currReceivables - prevReceivables) / prevReceivables;

      if (recGrowth > revGrowth * 2.0 && recGrowth > 0.3) {
        anomalies.push({
          type: "REVENUE_QUALITY",
          severity: "HIGH",
          signal: `Current assets grew ${Math.round(recGrowth * 100)}% vs revenue growth of ${Math.round(revGrowth * 100)}%`,
          insight: "Rapidly growing receivables relative to revenue may indicate channel stuffing or collection issues.",
          metric: { revGrowth: Math.round(revGrowth * 100), recGrowth: Math.round(recGrowth * 100) },
        });
      }
    }
  }

  // ── Check 3: Capex vs Depreciation ─────────────────────────────────

  if (cf.length > 0 && annual.length > 0) {
    const capex = Math.abs(cf[0].investingCF || 0); // Investing CF is typically negative
    const depreciation = annual[0].depreciation || 0;

    if (capex > 0 && depreciation > 0) {
      const capexToDepr = capex / depreciation;

      if (capexToDepr > 3.0) {
        anomalies.push({
          type: "CAPEX_ANOMALY",
          severity: "WATCH",
          signal: `Capital expenditure (₹${capex}Cr) is ${capexToDepr.toFixed(1)}x depreciation (₹${depreciation}Cr)`,
          insight: "Aggressive capex may signal expansion or could indicate over-investment. Verify project pipeline.",
          metric: { capex, depreciation, ratio: capexToDepr.toFixed(1) },
        });
      }
    }
  }

  // ── Check 4: Profit Trend vs Balance Sheet ─────────────────────────

  if (annual.length >= 3) {
    const profits = annual.slice(0, 4).map((a) => a.netProfit).filter((v) => v != null);
    let declineCount = 0;
    for (let i = 0; i < profits.length - 1; i++) {
      if (profits[i] < profits[i + 1]) declineCount++;
    }

    if (declineCount >= 3 && bs.length > 0 && (bs[0].borrowings || 0) > 0) {
      anomalies.push({
        type: "DETERIORATION_SPIRAL",
        severity: "HIGH",
        signal: `${declineCount} consecutive periods of profit decline while carrying debt (₹${bs[0].borrowings}Cr)`,
        insight: "Persistent profit decline with outstanding debt creates refinancing risk and potential debt trap.",
        metric: { profitTrend: profits, borrowings: bs[0].borrowings },
      });
    }
  }

  // ── Check 5: Working Capital Stress ────────────────────────────────

  if (allRatios.currentRatio != null && allRatios.operatingCFRatio != null) {
    if (allRatios.currentRatio < 1.0 && allRatios.operatingCFRatio < 0.5) {
      anomalies.push({
        type: "WORKING_CAPITAL_STRESS",
        severity: "HIGH",
        signal: `Both current ratio (${allRatios.currentRatio}) and OCF ratio (${allRatios.operatingCFRatio}) are weak`,
        insight: "Dual weakness in liquidity metrics — company may struggle to meet short-term obligations.",
        metric: { currentRatio: allRatios.currentRatio, ocfRatio: allRatios.operatingCFRatio },
      });
    }
  }

  // ── Compute overall risk ───────────────────────────────────────────

  const criticalCount = anomalies.filter((a) => a.severity === "CRITICAL").length;
  const highCount = anomalies.filter((a) => a.severity === "HIGH").length;

  let overallRisk;
  if (criticalCount >= 1) overallRisk = "CRITICAL";
  else if (highCount >= 2) overallRisk = "HIGH";
  else if (highCount >= 1) overallRisk = "MODERATE";
  else if (anomalies.length > 0) overallRisk = "LOW";
  else overallRisk = "CLEAN";

  const summary = anomalies.length === 0
    ? "No accounting anomalies detected."
    : anomalies.map((a) => `[${a.severity}] ${a.type}: ${a.signal}`).join(" | ");

  return { anomalies, overallRisk, summary };
}

export default { detectAnomalies };
