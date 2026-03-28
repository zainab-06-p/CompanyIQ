/**
 * Score Routes — GET /api/score/:company
 *
 * Free tier: returns CompanyIQ score + rating only (no detailed breakdown).
 * Cached for 24 hours.
 */

import { Router } from "express";
import { runPipeline } from "../orchestrator/orchestrator.js";
import { freeTierLimiter } from "../middleware/rateLimit.js";

const router = Router();

/**
 * GET /api/score/latest/:company
 *
 * Returns the latest available report snapshot.
 * - Fast mode may return partial quickly
 * - Backend continues full hydration in background
 */
router.get("/latest/:company", freeTierLimiter, async (req, res) => {
  try {
    const { company } = req.params;
    const forceRefresh = String(req.query.force || "").toLowerCase() === "true" || req.query.force === "1";

    if (!company || company.trim().length < 2) {
      return res.status(400).json({
        error: true,
        message: "Please provide a company name or ticker (minimum 2 characters).",
      });
    }

    const report = await runPipeline(company.trim(), "free_score", null, { forceRefresh });

    if (report.error) {
      return res.status(404).json(report);
    }

    return res.json({
      ready: !report.metadata?.partial,
      partial: Boolean(report.metadata?.partial),
      report,
    });
  } catch (error) {
    console.error("[ScoreRoute/latest] Error:", error.message);
    return res.status(500).json({
      error: true,
      message: "Failed to fetch latest report.",
    });
  }
});

/**
 * GET /api/score/:company
 *
 * Quick free score — runs all agents and returns full report.
 * Frontend filters tier-specific content based on deepAnalysisSummary presence.
 */
router.get("/:company", freeTierLimiter, async (req, res) => {
  try {
    const { company } = req.params;
    const forceRefresh = String(req.query.force || "").toLowerCase() === "true" || req.query.force === "1";

    if (!company || company.trim().length < 2) {
      return res.status(400).json({
        error: true,
        message: "Please provide a company name or ticker (minimum 2 characters).",
      });
    }

    const report = await runPipeline(company.trim(), "free_score", null, { forceRefresh });

    if (report.error) {
      return res.status(404).json(report);
    }

    // Return the FULL report — frontend can display what's available
    // Include deepAnalysisSummary for free tier visibility
    const deepAnalysisSummary = report.deepAnalysis ? Object.entries(report.deepAnalysis)
      .filter(([, v]) => v && typeof v.score === "number")
      .reduce((acc, [key, v]) => { acc[key] = { score: v.score, rating: v.rating }; return acc; }, {})
      : null;

    return res.json({
      ...report,
      deepAnalysisSummary: deepAnalysisSummary || report.deepAnalysisSummary,
    });
  } catch (error) {
    console.error("[ScoreRoute] Error:", error.message);
    return res.status(500).json({
      error: true,
      message: "Failed to generate score. Please try again.",
    });
  }
});

export default router;
