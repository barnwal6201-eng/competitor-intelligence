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
  matcher: ["/dashboard/:path*"],
};
