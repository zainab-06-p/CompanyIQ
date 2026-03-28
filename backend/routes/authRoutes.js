/**
 * Auth Routes — Supabase-backed auth with local session compatibility.
 *
 * Endpoints:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - GET  /api/auth/me
 * - POST /api/auth/select-plan
 */

import { Router } from "express";
import {
  ensureUserFromSupabase,
  getUserById,
  updateLastLogin,
  updateUserPlanTier,
} from "../db/database.js";
import { generateToken, requireAuth } from "../middleware/auth.js";
import { supabaseAdmin, supabaseAuthClient, supabaseEnabled } from "../config/supabase.js";
import config from "../config/env.js";

const router = Router();

const VALID_PLANS = new Set(["free_score", "quick_scan", "standard"]);

function buildEmailRedirectUrl() {
  const appUrl = String(config.server.appUrl || "").trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(appUrl)) return null;
  return `${appUrl}/auth?verified=1`;
}

function isDatabaseSaveError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("database error saving new user");
}

function withPlan(user) {
  const plan = user?.user_metadata?.plan || null;
  return {
    selectedPlan: plan,
    requiresPlanSelection: !plan,
  };
}

/**
 * POST /api/auth/register
 * Body: { email, password, name? }
 */
router.post("/register", async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({
        error: true,
        message: "Supabase authentication is not configured on server.",
      });
    }

    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: true, message: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: true, message: "Password must be at least 6 characters" });
    }

    const emailRedirectTo = buildEmailRedirectUrl();
    const metadata = name ? { name: String(name).trim() } : undefined;
    const options = {};
    if (metadata) options.data = metadata;
    if (emailRedirectTo) options.emailRedirectTo = emailRedirectTo;

    let { data, error } = await supabaseAuthClient.auth.signUp({
      email: String(email).toLowerCase().trim(),
      password,
      options,
    });

    // Fallback: retry with minimal payload if Supabase rejects enriched signup payload.
    if (error && isDatabaseSaveError(error)) {
      console.warn("[Auth] Supabase signup failed with DB save error; retrying minimal payload.", {
        code: error.code,
        status: error.status,
        name: error.name,
      });
      const retry = await supabaseAuthClient.auth.signUp({
        email: String(email).toLowerCase().trim(),
        password,
      });
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("[Auth] Supabase signup error:", {
        message: error.message,
        code: error.code,
        status: error.status,
        name: error.name,
      });
      const message = isDatabaseSaveError(error)
        ? "Supabase database trigger/policy issue detected. Open Supabase SQL editor and remove broken auth.users trigger, then retry."
        : (error.message || "Registration failed");
      return res.status(400).json({ error: true, message });
    }

    if (data?.user) {
      ensureUserFromSupabase(data.user);
    }

    return res.status(201).json({
      message: "Registration successful. Please verify your email before signing in.",
      needsEmailVerification: true,
      email: String(email).toLowerCase().trim(),
    });
  } catch (error) {
    console.error("[Auth] Registration error:", error.message);
    return res.status(500).json({ error: true, message: "Registration failed" });
  }
});

/**
 * POST /api/auth/resend-confirmation
 * Body: { email }
 */
router.post("/resend-confirmation", async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({
        error: true,
        message: "Supabase authentication is not configured on server.",
      });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: true, message: "Email is required" });
    }

    const emailRedirectTo = buildEmailRedirectUrl();
    const resendPayload = {
      type: "signup",
      email: String(email).toLowerCase().trim(),
    };
    if (emailRedirectTo) {
      resendPayload.options = { emailRedirectTo };
    }

    const { error } = await supabaseAuthClient.auth.resend(resendPayload);

    if (error) {
      return res.status(400).json({ error: true, message: error.message || "Failed to resend confirmation" });
    }

    return res.json({ message: "Confirmation email sent." });
  } catch (error) {
    console.error("[Auth] Resend confirmation error:", error.message);
    return res.status(500).json({ error: true, message: "Failed to resend confirmation" });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({
        error: true,
        message: "Supabase authentication is not configured on server.",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: true, message: "Email and password are required" });
    }

    const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
      email: String(email).toLowerCase().trim(),
      password,
    });

    if (error || !data?.user) {
      const msg = error?.message || "Invalid email or password";
      return res.status(401).json({ error: true, message: msg });
    }

    const localUser = ensureUserFromSupabase(data.user);
    if (!localUser) {
      return res.status(500).json({ error: true, message: "Failed to initialize user profile." });
    }

    updateLastLogin(localUser.id);

    // Keep backend JWT for existing middleware/routes compatibility.
    const token = generateToken({ id: localUser.id, email: localUser.email });
    const planState = withPlan(data.user);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        supabaseUserId: localUser.supabase_user_id,
        ...planState,
      },
    });
  } catch (error) {
    console.error("[Auth] Login error:", error.message);
    return res.status(500).json({ error: true, message: "Login failed" });
  }
});

/**
 * GET /api/auth/me
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    let selectedPlan = user.plan_tier || null;
    let requiresPlanSelection = !selectedPlan;

    if (supabaseEnabled && user.supabase_user_id) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(user.supabase_user_id);
      const planState = withPlan(data?.user);
      selectedPlan = planState.selectedPlan || selectedPlan;
      requiresPlanSelection = !selectedPlan;
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        supabaseUserId: user.supabase_user_id,
        selectedPlan,
        requiresPlanSelection,
      },
    });
  } catch (error) {
    console.error("[Auth] Me error:", error.message);
    return res.status(500).json({ error: true, message: "Failed to load profile" });
  }
});

/**
 * POST /api/auth/select-plan
 * Body: { plan: "free_score" | "quick_scan" | "standard" }
 */
router.post("/select-plan", requireAuth, async (req, res) => {
  try {
    if (!supabaseEnabled) {
      return res.status(503).json({
        error: true,
        message: "Supabase authentication is not configured on server.",
      });
    }

    const { plan } = req.body;
    if (!VALID_PLANS.has(plan)) {
      return res.status(400).json({ error: true, message: "Invalid plan selected" });
    }

    const localUser = getUserById(req.user.id);
    if (!localUser?.supabase_user_id) {
      return res.status(400).json({ error: true, message: "User is not linked with Supabase profile" });
    }

    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(localUser.supabase_user_id);
    const nextMetadata = {
      ...(existing?.user?.user_metadata || {}),
      plan,
    };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(localUser.supabase_user_id, {
      user_metadata: nextMetadata,
    });

    if (error) {
      return res.status(400).json({ error: true, message: error.message || "Failed to update plan" });
    }

    updateUserPlanTier(localUser.id, plan);

    return res.json({
      message: "Plan selected successfully",
      selectedPlan: plan,
      requiresPlanSelection: false,
    });
  } catch (error) {
    console.error("[Auth] Select plan error:", error.message);
    return res.status(500).json({ error: true, message: "Failed to select plan" });
  }
});

export default router;
