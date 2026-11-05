import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { User } from "../models/User";
import { Organization } from "../models/Organization";
import { hashPassword, comparePassword } from "../utils/password";
import { signToken, setAuthCookie, clearAuthCookie } from "../utils/jwt";
import { registerSchema, loginSchema } from "../validators/auth";
import type { AuthRequest } from "../middleware/auth";

function dbConnected(res: Response): boolean {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    res.status(503).json({
      error: "Database not connected — set MONGODB_URI in backend/.env and restart the backend",
    });
    return false;
  }
  return true;
}

function publicUser(user: { _id: unknown; name: string; email: string; role: string }, org: { _id: unknown; name: string }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    organization: { id: String(org._id), name: org.name },
  };
}

function handleValidationError(err: unknown, res: Response): boolean {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues[0]?.message || "Invalid input" });
    return true;
  }
  return false;
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const input = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: input.email });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    // One account creates one organization (PRD section 6). The first user
    // is the organization owner. Joining an existing organization is a later phase.
    const orgName = input.organizationName || `${input.name}'s Workspace`;
    const passwordHash = await hashPassword(input.password);

    // Create the user first so the organization can reference its creator.
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      organizationId: new mongoose.Types.ObjectId(),
      role: "owner",
    });
    const org = await Organization.create({ name: orgName, createdBy: user._id });
    user.organizationId = org._id;
    await user.save();

    const token = signToken({ userId: user._id.toString(), organizationId: org._id.toString(), role: user.role });
    setAuthCookie(res, token);
    res.status(201).json({ user: publicUser(user, org) });
  } catch (err) {
    if (handleValidationError(err, res)) return;
    console.error("Register failed:", err);
    res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    if (!dbConnected(res)) return;
    const input = loginSchema.parse(req.body);

    // passwordHash is select:false on the model, so opt in explicitly.
    const user = await User.findOne({ email: input.email }).select("+passwordHash");
    // Same generic message for unknown email and wrong password: do not
    // reveal which one failed.
    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const org = await Organization.findById(user.organizationId);
    if (!org) {
      res.status(500).json({ error: "Account organization not found" });
      return;
    }
    const token = signToken({ userId: user._id.toString(), organizationId: org._id.toString(), role: user.role });
    setAuthCookie(res, token);
    res.json({ user: publicUser(user, org) });
  } catch (err) {
    if (handleValidationError(err, res)) return;
    console.error("Login failed:", err);
    res.status(500).json({ error: "Login failed" });
  }
}

export function logout(_req: Request, res: Response): void {
  clearAuthCookie(res);
  res.json({ ok: true });
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    const org = await Organization.findById(req.user.organizationId);
    if (!org) {
      res.status(500).json({ error: "Account organization not found" });
      return;
    }
    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        organization: { id: org._id.toString(), name: org.name },
      },
    });
  } catch (err) {
    console.error("Me failed:", err);
    res.status(500).json({ error: "Failed to load current user" });
  }
}
