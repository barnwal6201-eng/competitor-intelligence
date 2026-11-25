"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Loader2,
  Plus,
  Swords,
} from "lucide-react";
import { getCurrentUser } from "@/services/auth";
import { getDashboardOverview } from "@/services/dashboard";
import { categoryLabel } from "@/components/ChangeCard";
import { Badge, Card, EmptyState, PageHeader, btnPrimary, btnSecondary } from "@/components/ui";
import type { AuthUser, DashboardOverview } from "@/types";

// Phase 12 restyle of the Phase 8 dashboard. Every number is still a live
// count over the signed-in user's own data — competitors, changes, price
// moves, battlecards, and scan health. An empty workspace shows honest
// zeros and empty states, never sample data.
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

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
    );
  }
  if (!user || !overview) {
    return (
      <div className="flex items-center gap-2 py-16 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading your workspace…
      </div>
    );
  }

  const { stats } = overview;
  const maxDay = Math.max(1, ...overview.changesPerDay.map((d) => d.count));
  const totalTrend = overview.changesPerDay.reduce((sum, d) => sum + d.count, 0);

  const statCards = [
    {
      icon: Building2,
      iconClass: "bg-indigo-50 text-indigo-600",
      value: stats.competitors,
      label: "Competitors",
      sub: `${stats.monitoringEnabled} monitoring · ${stats.monitoringPaused} paused`,
    },
    {
      icon: Activity,
      iconClass: "bg-indigo-50 text-indigo-600",
      value: stats.changesLast7Days,
      label: "Changes · last 7 days",
      sub: `${stats.changes} total · ${stats.snapshots} snapshots`,
    },
    {
      icon: AlertTriangle,
      iconClass: "bg-red-50 text-red-600",
      value: stats.highChangesLast7Days,
      label: "High priority · last 7 days",
      sub: "Price rises, removed plans, bad reviews",
      valueClass: "text-red-700",
    },
    {
      icon: Swords,
      iconClass: "bg-indigo-50 text-indigo-600",
      value: stats.battlecards,
      label: "Battlecards",
      sub: `${stats.analyses} AI analyses`,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(var(--squares-size, 40px) var(--squares-spacing, 80px) calc(1px + var(--squares-color, #e2e8f0)), var(--squares-color, #e2e8f0) 50%, transparent 50%), linear-gradient(90deg, var(--squares-size, 40px) var(--squares-spacing, 80px) calc(1px + var(--squares-color, #e2e8f0)), var(--squares-color, #e2e8f0) 50%, 50%)",
          backgroundSize: "var(--squares-spacing, 80px) var(--squares-spacing, 80px)",
        }}
      />

      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-600 shadow-sm">
              <Radar className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight text-slate-900">
                Competitor Intelligence
              </span>
              <span className="block text-xs text-slate-500">Scraper & Battlecard Agent</span>
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Sign in
            </Link>
            <Link
              href="/competitors/new"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add competitor
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-7xl mx-auto">
          {/* Stats overview */}
          <section className="mb-10">
            <div className="flex flex-wrap gap-3 mb-6">
              {statCards.map(({ icon: Icon, iconClass, value, label, sub, valueClass }) => (
                <Card
                  key={label}
                  className="p-5 flex-1 min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-3xl font-semibold tracking-tight text-slate-900 ${valueClass ?? ""}`}>
                        {value}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
                    </div>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Changes over time chart */}
            <Card className="mt-6 p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Activity className="h-5 w-5 text-indigo-600" /> Changes over time
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Detected changes per day, last 14 days · {totalTrend} total
              </p>

              {totalTrend === 0 ? (
                <EmptyState
                  icon={<Activity className="h-5 w-5" />}
                  title="No changes in the last 14 days"
                  description="Scan a competitor to start tracking — the first scan sets the baseline, the next one shows what moved."
                  action={
                    <Link
                      href="/competitors"
                      className="mt-4 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm"
                    >
                      Go to competitors <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              ) : (
                <div className="mt-6 flex items-end gap-1.5 border-b border-slate-200 pb-1" style={{ height: "140px" }}>
                  {overview.changesPerDay.map((d) => (
                    <div
                      key={d.date}
                      className="group flex flex-1 flex-col items-center justify-end gap-1"
                      title={`${d.date}: ${d.count} change${d.count === 1 ? "" : "s"}`}
                    >
                      <span className="text-xs font-semibold text-slate-700">
                        {d.count > 0 ? d.count : ""}
                      </span>
                      <div
                        className="w-full max-w-8 rounded-t-md bg-indigo-500 transition-colors hover:bg-indigo-600 group-hover:bg-indigo-600"
                        style={{ height: `${Math.max(d.count === 0 ? 3 : (d.count / maxDay) * 96, 3)}px` }}
                      />
                      <span className="text-[10px] font-medium text-slate-500">{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>

          {/* Most active competitors + recent price moves */}
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">Most active competitors</h2>
              {overview.topCompetitors.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No changes detected yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {overview.topCompetitors.map((c) => (
                    <li
                      key={c.competitorId}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <Link
                        href={`/competitors/${c.competitorId}`}
                        className="text-sm font-medium text-indigo-600 hover:underline"
                      >
                        {c.competitorName ?? c.competitorId}
                      </Link>
                      <span className="shrink-0 text-sm text-slate-500">
                        {c.changeCount} change{c.changeCount === 1 ? "" : "s"} ·{" "}
                        {new Date(c.latestChangeAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">Recent price moves</h2>
              {overview.priceMoves.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No price moves detected yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {overview.priceMoves.map((m) => (
                    <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm">
                        <Badge
                          tone={
                            m.category === "price_increase" ? "red" : m.category === "price_decrease" ? "green" : "amber"
                        }
                        />
                        {" "}
                        <span className="font-medium text-slate-900">{categoryLabel(m.category)}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {m.competitorName} · {new Date(m.detectedAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          {/* Recent activity */}
          <section className="mt-8">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
              {overview.recentChanges.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  Nothing yet — changes appear here after a scan finds something different.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {overview.recentChanges.map((c) => (
                    <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm text-slate-700">
                        <Badge
                          tone={
                            c.significance === "high"
                              ? "red"
                              : c.significance === "medium"
                                ? "amber"
                                : "neutral"
                          }
                        >
                          {categoryLabel(c.category)}
                        </Badge>{" "}
                        {c.title}{" "}
                        <span className="text-slate-500">
                          — {c.competitorName} · {new Date(c.detectedAt).toLocaleString()}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-5">
                <Link
                  href="/intelligence"
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
                >
                  View the full intelligence feed <ArrowRight className="h-4 w-4" />
                </Link>
              </p>
            </Card>
          </section>

          {/* Scan health */}
          <section className="mt-8">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">Scan health</h2>
              {overview.scanHealth.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="h-5 w-5" />}
                  title="No competitors yet"
                  description="Add your first competitor and scan it to start tracking."
                  action={
                    <Link
                      href="/competitors/new"
                      className="mt-4 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm"
                    >
                      <Plus className="h-4 w-4" /> Add competitor
                    </Link>
                  }
                />
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr
                        className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"
                      >
                        <th className="pb-2 pr-3 font-medium">Competitor</th>
                        <th className="pb-2 pr-3 font-medium">Monitoring</th>
                        <th className="pb-2 pr-3 font-medium">Last scan</th>
                        <th className="pb-2 pr-3 font-medium">Result</th>
                        <th className="pb-2 font-medium">Snapshots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.scanHealth.map((row) => (
                        <tr
                          key={row.competitorId}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-3 pr-3">
                            <Link
                              href={`/competitors/${row.competitorId}`}
                              className="font-medium text-indigo-600 hover:underline"
                            >
                              {row.competitorName}
                            </Link>
                          </td>
                          <td className="py-3 pr-3 text-slate-600">
                            {row.monitoringEnabled ? (
                              <Badge tone="green">Enabled</Badge>
                            ) : (
                              <Badge tone="neutral">Paused</Badge>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-slate-600">
                            {row.lastScanAt ? new Date(row.lastScanAt).toLocaleString() : "Never scanned"}
                          </td>
                          <td className="py-3 pr-3">
                            {row.lastScanStatus === "success" ? (
                              <Badge tone="green">Success</Badge>
                            ) : row.lastScanStatus === "blocked" ? (
                              <Badge tone="amber">Blocked</Badge>
                            ) : row.lastScanStatus === "failed" ? (
                              <Badge tone="red">Failed</Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 font-medium text-slate-900">{row.totalSnapshots}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
