import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, logout, me } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Brute-force protection for the auth endpoints (PRD section 20).
// Generous limit so normal use and testing are not blocked.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, try again later" },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
