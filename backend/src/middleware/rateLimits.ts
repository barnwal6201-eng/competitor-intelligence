// Phase 11: rate limits beyond auth (PRD section 20). Auth already had
// a limiter; these cover the expensive endpoints, so one account cannot
// hammer the scrapers, the AI analysis, or the integration pushes.
//
// Limits are deliberately generous for normal use — they only bite on
// abuse. The Phase 11 test suite relies on the exact numbers below:
//   loginLimiter: 30 attempts per 15 minutes per IP
//   registerLimiter: 100 per 15 minutes per IP
//   expensiveLimiter: 30 per 15 minutes per signed-in user
// If a number changes here, update backend/tests/rate-limit.test.ts too.

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { AuthRequest } from "./auth";

const message = { error: "Too many requests, try again later" };

// Login attempts, per IP. A brute-force script gets 30 guesses per
// 15 minutes; a real user mistyping a password never notices.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

// Account creation, per IP (unchanged from Phase 2).
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

// Expensive operations — manual scans, AI analysis, Notion/Salesforce
// pushes. Keyed by the signed-in user (not the IP), so one account's
// heavy use never blocks another account behind the same NAT. The
// limiter runs after requireAuth on these routes, so req.user is set;
// an unauthenticated call falls back to the IP.
export const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
  // express-rate-limit requires the ipKeyGenerator helper for any
  // fallback to the request IP, so IPv6 addresses cannot bypass the
  // limit by varying their address form.
  keyGenerator: (req) => (req as AuthRequest).user?.id ?? ipKeyGenerator(req.ip ?? "unknown"),
});
