/**
 * Payment Verification Middleware
 *
 * Verifies Razorpay payment signature before allowing paid report generation.
 */

import crypto from "crypto";
import config from "../config/env.js";

/**
 * Verify Razorpay payment signature.
 * Expects req.body to contain:
 *   razorpay_order_id, razorpay_payment_id, razorpay_signature
 */
export function verifyPayment(req, res, next) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      error: true,
      message: "Missing payment verification fields.",
    });
  }

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({
      error: true,
      message: "Payment verification failed. Invalid signature.",
    });
  }

  // Attach payment info for downstream use
  req.payment = {
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    verified: true,
  };

  next();
}

export default { verifyPayment };
