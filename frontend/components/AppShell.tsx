"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  LayoutDashboard,
  LogOut,
  Radar,
  Swords,
} from "lucide-react";
import { getCurrentUser, logoutUser } from "@/services/auth";
import type { AuthUser } from "@/types";

// Phase 12 app shell: the product navigation for every signed-in page.
// Sidebar on desktop, compact top bar + nav row on mobile. The workspace
// name and user come from the real /api/auth/me response — nothing here
// is hard-coded. Sign out calls the real logout endpoint.

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/competitors", label: "Competitors", icon: Building2 },
  { href: "/intelligence", label: "Intelligence", icon: Activity },
  { href: "/battlecards", label: "Battlecards", icon: Swords },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
        <Radar className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-slate-900">
          Competitor Intelligence
        </span>
        <span className="block text-xs text-slate-500">Scraper &amp; Battlecard Agent</span>
      </span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        // Pages themselves redirect on 401; the shell just shows a
        // minimal state until then.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await logoutUser();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
              {user ? user.name.slice(0, 1).toUpperCase() : "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user ? user.name : "Loading…"}</p>
              <p className="truncate text-xs text-slate-500">
                {user ? `${user.organization.name} · ${user.role}` : "Your workspace"}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          {user ? <p className="mt-2 truncate text-xs text-slate-400">{user.email}</p> : null}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Page content */}
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
