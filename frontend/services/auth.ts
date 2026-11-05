import type { AuthUser } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function handleResponse(res: Response): Promise<{ user: AuthUser }> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Something went wrong");
  }
  return data as { user: AuthUser };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
}): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // send/receive the httpOnly auth cookie
    body: JSON.stringify(input),
  });
  return (await handleResponse(res)).user;
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  return (await handleResponse(res)).user;
}

export async function logoutUser(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include", cache: "no-store" });
  return (await handleResponse(res)).user;
}
