import jwt from "jsonwebtoken";
import type { Response } from "express";
import { env } from "../config/env";

export const AUTH_COOKIE = "token";

export interface JwtPayload {
  userId: string;
  organizationId: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: `${env.jwtExpiresInDays}d` });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true, // JavaScript in the browser cannot read it (PRD section 6).
    secure: env.isProduction, // HTTPS only in production; localhost dev is HTTP.
    sameSite: "lax",
    maxAge: env.jwtExpiresInDays * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
}
