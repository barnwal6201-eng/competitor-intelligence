import { Router } from "express";
import { register, login, logout, me } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { loginLimiter, registerLimiter } from "../middleware/rateLimits";

const router = Router();

// Brute-force protection for the auth endpoints (PRD section 20).
// Login is stricter than register: 30 guesses per 15 minutes per IP.
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
