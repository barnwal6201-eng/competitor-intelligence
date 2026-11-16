"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser, logoutUser } from "@/services/auth";
import { getDashboardOverview } from "@/services/dashboard";
import { categoryLabel } from "@/components/ChangeCard";
import type { AuthUser, DashboardOverview } from "@/types";

// Phase 8: the dashboard is now a real overview instead of a status page.
// Every number on it is a live count over the signed-in user's own data —
// competitors, changes, price moves, battlecards, and scan health. An
// empty workspace shows honest zeros and empty states, never sample data.
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCurrentUser(), getDashboardOverview()])
      .then(([u, o]) => {
        setUser(u);
        setOverview(o);
      })
      .catch(() => {
        setError("Your session could not be verified. Please sign in again.");
        router.push("/login");
      });
  }, [router]);

  async function handleLogout() {
    await logoutUser();
    router.push("/login");
    router.refresh();
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-red-700">{error}</p>
      </main>
    );
  }
  if (!user || !overview) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-neutral-600">Loading your workspace…</p>
      </main>
    );
  }

  const { stats } = overview;
  const maxDay = Math.max(1, ...overview.changesPerDay.map((d) => d.count));
  const totalTrend = overview.changesPerDay.reduce((sum, d) => sum + d.count, 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-700">{user.organization.name}</p>
          <h1 className="mt-1 text-3xl font-semibold">Welcome, {user.name}</h1>
          <p className="mt-2 text-neutral-600">
            Signed in as {user.email} · Role: {user.role}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </div>

      {/* Stat cards — real counts, nothing faked. */}
      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-2xl font-semibold">{stats.competitors}</p>
          <p className="text-sm text-neutral-600">Competitors</p>
          <p className="text-xs text-neutral-500">
            {stats.monitoringEnabled} monitoring · {stats.monitoringPaused} paused
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-2xl font-semibold">{stats.changesLast7Days}</p>
          <p className="text-sm text-neutral-600">Changes · last 7 days</p>
          <p className="text-xs text-neutral-500">{stats.changes} total · {stats.snapshots} snapshots</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-2xl font-semibold text-red-700">{stats.highChangesLast7Days}</p>
          <p className="text-sm text-neutral-600">High priority · last 7 days</p>
          <p className="text-xs text-neutral-500">Price rises, removed plans, bad reviews</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-2xl font-semibold">{stats.battlecards}</p>
          <p className="text-sm text-neutral-600">Battlecards</p>
          <p className="text-xs text-neutral-500">{stats.analyses} AI analyses</p>
        </div>
      </section>

      {/* Changes over time — 14-day bar chart, plain divs, no chart library. */}
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-medium">Changes over time</h2>
        <p className="text-sm text-neutral-500">
          Detected changes per day, last 14 days · {totalTrend} total
        </p>
        {totalTrend === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">
            No changes in the last 14 days — scan a competitor to start tracking.
          </p>
        ) : (
          <div className="mt-4 flex items-end gap-1" style={{ height: "120px" }}>
            {overview.changesPerDay.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.count} change${d.count === 1 ? "" : "s"}`}>
                <span className="text-xs font-medium text-neutral-700">{d.count > 0 ? d.count : ""}</span>
                <div
                  className="w-full rounded-t bg-indigo-600"
                  style={{ height: `${Math.max(d.count === 0 ? 2 : (d.count / maxDay) * 80, 2)}px` }}
                />
                <span className="text-[10px] text-neutral-500">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Most active competitors + recent price moves. */}
      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-medium">Most active competitors</h2>
          {overview.topCompetitors.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No changes detected yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {overview.topCompetitors.map((c) => (
                <li key={c.competitorId} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/competitors/${c.competitorId}`} className="font-medium text-indigo-700 hover:underline">
                    {c.competitorName ?? c.competitorId}
                  </Link>
                  <span className="shrink-0 text-neutral-600">
                    {c.changeCount} change{c.changeCount === 1 ? "" : "s"} ·{" "}
                    {new Date(c.latestChangeAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-medium">Recent price moves</h2>
          {overview.priceMoves.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No price moves detected yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {overview.priceMoves.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className={m.category === "price_increase" ? "font-medium text-red-700" : "font-medium text-green-700"}>
                    {categoryLabel(m.category)}
                  </span>{" "}
                  · {m.title}
                  <span className="block text-xs text-neutral-500">
                    {m.competitorName} · {new Date(m.detectedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Recent activity. */}
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-medium">Recent activity</h2>
        {overview.recentChanges.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Nothing yet — changes appear here after a scan finds something different.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {overview.recentChanges.map((c) => (
              <li key={c.id} className="text-sm text-neutral-700">
                <span className="font-medium">{categoryLabel(c.category)}</span> · {c.title}{" "}
                <span className="text-neutral-500">
                  — {c.competitorName} · {new Date(c.detectedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4">
          <Link href="/intelligence" className="font-medium text-indigo-700 hover:underline">
            View the full intelligence feed →
          </Link>
        </p>
      </section>

      {/* Scan health — when each competitor was last scanned, and whether it worked. */}
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-medium">Scan health</h2>
        {overview.scanHealth.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            No competitors yet.{" "}
            <Link href="/competitors/new" className="font-medium text-indigo-700 hover:underline">
              Add one
            </Link>{" "}
            and scan it.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-1 pr-2 font-medium">Competitor</th>
                <th className="py-1 pr-2 font-medium">Monitoring</th>
                <th className="py-1 pr-2 font-medium">Last scan</th>
                <th className="py-1 pr-2 font-medium">Result</th>
                <th className="py-1 font-medium">Snapshots</th>
              </tr>
            </thead>
            <tbody>
              {overview.scanHealth.map((row) => (
                <tr key={row.competitorId} className="border-b border-neutral-100">
                  <td className="py-2 pr-2">
                    <Link href={`/competitors/${row.competitorId}`} className="font-medium text-indigo-700 hover:underline">
                      {row.competitorName}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 text-neutral-600">{row.monitoringEnabled ? "Enabled" : "Paused"}</td>
                  <td className="py-2 pr-2 text-neutral-600">
                    {row.lastScanAt ? new Date(row.lastScanAt).toLocaleString() : "Never scanned"}
                  </td>
                  <td className="py-2 pr-2">
                    {row.lastScanStatus === "success" ? (
                      <span className="text-green-700">Success</span>
                    ) : row.lastScanStatus === "blocked" ? (
                      <span className="text-amber-700">Blocked</span>
                    ) : row.lastScanStatus === "failed" ? (
                      <span className="text-red-700">Failed</span>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="py-2 text-neutral-600">{row.totalSnapshots}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <p className="text-sm text-neutral-700">
          Everything above is live data from your workspace — nothing is
          faked or sampled.{" "}
          <Link href="/competitors" className="font-medium text-indigo-700 hover:underline">
            Manage competitors →
          </Link>{" "}
          <Link href="/battlecards" className="ml-3 font-medium text-indigo-700 hover:underline">
            View battlecards →
          </Link>
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          Next: Phase 9 — background jobs with Redis + BullMQ (scheduled
          scans, so you don&apos;t have to press Scan now by hand).
        </p>
      </section>
    </main>
  );
}
