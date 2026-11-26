import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Route protection (PRD section 6): /dashboard is only for signed-in users.
// This checks only that the httpOnly token cookie is present. The backend
// /api/auth/me call verifies the token itself — a forged cookie cannot pass it.
export function middleware(request: NextRequest) {
  const token = request.cookies.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Every protected route: the (dashboard) group lives at /dashboard,
  // /competitors, /intelligence, /battlecards and /integrations. The
  // dashboard layout also guards server-side (cookies check) — this
  // middleware is the first line, the layout is the second.
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/competitors/:path*",
    "/intelligence/:path*",
    "/battlecards/:path*",
    "/integrations/:path*",
  ],
};
