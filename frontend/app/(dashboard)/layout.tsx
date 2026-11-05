import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Server-side guard for the whole (dashboard) group: no token cookie, no entry.
// The dashboard page itself then calls /api/auth/me, which verifies the token.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("token");
  if (!token) {
    redirect("/login");
  }
  return <>{children}</>;
}
