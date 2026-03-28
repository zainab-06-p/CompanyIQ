/**
 * Report Routes — POST /api/report
 *
 * Paid tiers (quick_scan / standard):
 * - Verifies Razorpay payment before generating
 * - Returns full detailed report based on tier
 *
 * Also includes order creation for Razorpay checkout.
 */

import { Router } from "express";
import Razorpay from "razorpay";
import { runPipeline } from "../orchestrator/orchestrator.js";
import { verifyPayment } from "../middleware/paymentVerify.js";
import { paidTierLimiter } from "../middleware/rateLimit.js";
import config from "../config/env.js";

const router = Router();

let razorpayInstance = null;

function getRazorpay() {
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return razorpayInstance;
}

/**
 * POST /api/report/create-order
 *
 * Create a Razorpay order for the selected tier.
 */
router.post("/create-order", async (req, res) => {
  try {
    const { company, tier } = req.body;

    if (!company || !tier) {
      return res.status(400).json({
        error: true,
        message: "Company and tier are required.",
      });
    }

    if (!["quick_scan", "standard"].includes(tier)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid tier. Use "quick_scan" or "standard".',
      });
    }

    const pricing = config.pricing[tier];
    if (!pricing) {
      return res.status(400).json({ error: true, message: "Tier pricing not configured." });
    }

    const order = await getRazorpay().orders.create({
      amount: pricing.paise,
      currency: "INR",
      receipt: `ciq_${tier}_${Date.now()}`,
      notes: {
        company,
        tier,
        product: "CompanyIQ Report",
      },
    });

    return res.json({
      orderId: order.id,
      amount: pricing.paise,
      amountDisplay: `₹${pricing.rupees}`,
      currency: "INR",
      tier,
      company,
      razorpayKeyId: config.razorpay.keyId,
    });
  } catch (error) {
    console.error("[ReportRoute] Order creation failed:", error.message);
    return res.status(500).json({
      error: true,
      message: "Failed to create payment order.",
    });
  }
});

/**
 * POST /api/report/generate
 *
 * Generate a paid report after verifying payment.
 * Body: { company, tier, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
router.post("/generate", paidTierLimiter, verifyPayment, async (req, res) => {
  try {
    const { company, tier } = req.body;

    if (!company || !tier) {
      return res.status(400).json({
        error: true,
        message: "Company and tier are required.",
      });
    }

    if (!["quick_scan", "standard"].includes(tier)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid tier. Use "quick_scan" or "standard".',
      });
    }

    const report = await runPipeline(company.trim(), tier);

    if (report.error) {
      return res.status(404).json(report);
    }

    // Attach payment reference
    report.payment = {
      orderId: req.payment.orderId,
      paymentId: req.payment.paymentId,
      tier,
      verified: true,
    };

    return res.json(report);
  } catch (error) {
    console.error("[ReportRoute] Generation failed:", error.message);
    return res.status(500).json({
      error: true,
      message: "Failed to generate report. Please try again.",
    });
  }
});

export default router;
