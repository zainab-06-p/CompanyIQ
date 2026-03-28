/**
 * Rate Limiter Middleware
 *
 * - Free tier: 5 requests / 15 min per IP
 * - Paid requests: 20 / 15 min per IP
 */

import rateLimit from "express-rate-limit";

export const freeTierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    message: "Too many requests. Free tier allows 5 reports per 15 minutes. Please try again later.",
  },
  keyGenerator: (req) => req.ip,
});

export const paidTierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    message: "Rate limit exceeded. Please wait before generating more reports.",
  },
  keyGenerator: (req) => req.ip,
});

export default { freeTierLimiter, paidTierLimiter };
