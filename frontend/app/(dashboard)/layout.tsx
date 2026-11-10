import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Server-side guard for the whole (dashboard) group: no token cookie, no entry.
// The dashboard page itself then calls /api/auth/me, which verifies the token.
//
// NOTE: `cookies()` is awaited here on purpose. In Next.js 14 it returns the
// cookie store synchronously (await on a non-promise is a no-op), but in
// Next.js 15/16 it returns a Promise — calling `.get()` on the un-awaited
// value crashes with "cookies(...) is not a function". Awaiting works on
// both, so this layout runs on either version.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token");
  if (!token) {
    redirect("/login");
  }
  return <>{children}</>;
}
