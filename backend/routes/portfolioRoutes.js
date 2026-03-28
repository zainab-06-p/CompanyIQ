/**
 * Portfolio Routes — /api/portfolio
 *
 * POST /api/portfolio/analyze
 *   Accepts a list of holdings, runs free_score for each company,
 *   then returns cross-portfolio risk analysis.
 */

import { Router } from "express";
import { runPipeline } from "../orchestrator/orchestrator.js";
import { analyzePortfolio } from "../engine/portfolioEngine.js";
import { sanitizeCompany } from "../middleware/inputValidation.js";

const router = Router();

/**
 * POST /api/portfolio/analyze
 * Body: {
 *   holdings: [
 *     { ticker: "RELIANCE", shares: 10, buyPrice: 2400, currentPrice: 2650 }
 *   ]
 * }
 */
router.post("/analyze", async (req, res) => {
  try {
    const { holdings } = req.body;
    const economyMode = String(req.query.economy || "1") !== "0";
    const cacheOnly = String(req.query.cacheOnly || "0") === "1";

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return res.status(400).json({
        error: true,
        message: "holdings array is required and must not be empty",
      });
    }

    if (holdings.length > 8) {
      return res.status(400).json({
        error: true,
        message: "Maximum 8 holdings per portfolio analysis",
      });
    }

    // Sanitize inputs
    const sanitized = holdings
      .map((h) => ({
        ticker: sanitizeCompany(String(h.ticker || "")).toUpperCase().trim(),
        shares: Math.max(0, Number(h.shares) || 0),
        buyPrice: Math.max(0, Number(h.buyPrice) || 0),
        currentPrice: Math.max(0, Number(h.currentPrice) || 0),
      }))
      .filter((h) => h.ticker.length > 0);

    if (sanitized.length === 0) {
      return res.status(400).json({
        error: true,
        message: "No valid holdings after input validation",
      });
    }

    console.log(`[Portfolio] Analyzing ${sanitized.length} holdings...`);
    const startTime = Date.now();

    // Run free_score for each holding in batches of 3 to limit parallel TinyFish calls
    const results = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < sanitized.length; i += BATCH_SIZE) {
      const batch = sanitized.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (h) => {
          try {
            const report = await runPipeline(h.ticker, "free_score", null, {
              economyMode,
              backgroundHydration: false,
              cacheOnly,
            });
            return {
              ...h,
              currentValue: h.currentPrice * h.shares,
              report: report?.error ? null : report,
              cacheOnlyMiss: Boolean(report?.cacheOnlyMiss),
            };
          } catch {
            return { ...h, currentValue: h.currentPrice * h.shares, report: null, cacheOnlyMiss: false };
          }
        })
      );
      results.push(...batchResults);
    }

    const missedTickers = results.filter((r) => r.cacheOnlyMiss).map((r) => r.ticker);

    const analysis = analyzePortfolio(results);
    const durationMs = Date.now() - startTime;

    console.log(
      `[Portfolio] Analysis complete in ${(durationMs / 1000).toFixed(1)}s`
    );

    return res.json({
      portfolio: analysis,
      metadata: {
        holdingsAnalyzed: results.filter((r) => r.report !== null).length,
        totalHoldings: results.length,
        durationMs,
        economyMode,
        cacheOnly,
        missedTickers,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[Portfolio] Analysis failed:", err.message);
    return res.status(500).json({
      error: true,
      message: "Portfolio analysis failed. Please try again.",
    });
  }
});

export default router;
