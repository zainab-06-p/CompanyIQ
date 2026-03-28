/**
 * User History Routes — Supabase-backed report history.
 *
 * POST /api/history/track
 * GET  /api/history
 * GET  /api/history/:id
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserById } from "../db/database.js";
import { supabaseAdmin, supabaseEnabled } from "../config/supabase.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({ error: true, message: "Supabase history is not configured" });
    }

    const user = getUserById(req.user.id);
    if (!user?.supabase_user_id) {
      return res.status(400).json({ error: true, message: "User is not linked with Supabase" });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const { data, error } = await supabaseAdmin
      .from("user_history")
      .select("id,ticker,company_name,sector,company_iq,rating,tier,source,created_at")
      .eq("user_id", user.supabase_user_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(400).json({ error: true, message: error.message || "Failed to fetch history" });
    }

    return res.json({ history: data || [] });
  } catch (error) {
    console.error("[History] Fetch error:", error.message);
    return res.status(500).json({ error: true, message: "Failed to fetch history" });
  }
});

/**
 * Retrieve a specific historical report by ID (with full report data)
 * GET /api/history/:id
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({ error: true, message: "Supabase history is not configured" });
    }

    const user = getUserById(req.user.id);
    if (!user?.supabase_user_id) {
      return res.status(400).json({ error: true, message: "User is not linked with Supabase" });
    }

    const { id } = req.params;
    const historyId = parseInt(id, 10);
    if (!Number.isFinite(historyId)) {
      return res.status(400).json({ error: true, message: "Invalid history ID" });
    }

    const { data, error } = await supabaseAdmin
      .from("user_history")
      .select("*")
      .eq("id", historyId)
      .eq("user_id", user.supabase_user_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: true, message: "History record not found" });
    }

    return res.json({ history: data });
  } catch (error) {
    console.error("[History] Fetch single error:", error.message);
    return res.status(500).json({ error: true, message: "Failed to fetch history record" });
  }
});

router.post("/track", requireAuth, async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({ error: true, message: "Supabase history is not configured" });
    }

    const user = getUserById(req.user.id);
    if (!user?.supabase_user_id) {
      return res.status(400).json({ error: true, message: "User is not linked with Supabase" });
    }

    const {
      ticker,
      companyName,
      sector,
      companyIQ,
      rating,
      tier,
      source,
      reportData,
    } = req.body;

    if (!ticker || !companyName) {
      return res.status(400).json({ error: true, message: "ticker and companyName are required" });
    }

    const payload = {
      user_id: user.supabase_user_id,
      ticker: String(ticker).toUpperCase(),
      company_name: String(companyName),
      sector: sector ? String(sector) : null,
      company_iq: Number.isFinite(Number(companyIQ)) ? Math.round(Number(companyIQ)) : null,
      rating: rating ? String(rating) : null,
      tier: tier ? String(tier) : "free_score",
      source: source ? String(source) : "report",
    };

    // Optionally include report_data if provided (can be large, so only if explicitly sent)
    if (reportData) {
      try {
        const serialized = JSON.stringify(reportData);
        // Only include if < 10MB (safety check)
        if (serialized.length < 10 * 1024 * 1024) {
          payload.report_data = serialized;
        }
      } catch (jsonErr) {
        console.warn("[History] Report data serialization failed (continuing without it):", jsonErr.message);
      }
    }

    const { error } = await supabaseAdmin.from("user_history").insert(payload);

    if (error) {
      console.warn("[History] Insert error:", error.message);
      // Return 201 anyway - history tracking is non-critical
      return res.status(201).json({ message: "History tracked (partial)" });
    }

    return res.status(201).json({ message: "History tracked" });
  } catch (error) {
    console.error("[History] Track error:", error.message);
    // Return 201 anyway - history tracking is non-critical
    return res.status(201).json({ message: "History tracked (with error)" });
  }
});

export default router;
