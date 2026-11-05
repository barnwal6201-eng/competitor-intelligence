import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { AUTH_COOKIE, verifyToken } from "../utils/jwt";
import { parseCookies } from "../utils/cookies";
import { User } from "../models/User";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    organizationId: string;
    role: string;
  };
}

// Protects a backend endpoint: a valid httpOnly-cookie JWT is required.
// The token alone is not trusted for identity — the user is re-loaded from
// the database, so a deleted user cannot keep using an old token.
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseCookies(req.headers.cookie)[AUTH_COOKIE];
    if (!token) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    const payload = verifyToken(token);
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      res.status(503).json({ error: "Database not connected" });
      return;
    }
    const user = await User.findById(payload.userId).select("name email organizationId role");
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      organizationId: user.organizationId.toString(),
      role: user.role,
    };
    next();
  } catch {
    res.status(401).json({ error: "Not signed in" });
  }
}
