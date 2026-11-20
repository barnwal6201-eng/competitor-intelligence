"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ExternalLink, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { listCompetitors, deleteCompetitor } from "@/services/competitors";
import { Badge, Card, EmptyState, PageHeader, btnPrimary, btnSecondary, btnDanger, inputClass } from "@/components/ui";
import type { Competitor } from "@/types";

export default function CompetitorsPage() {
  const router = useRouter();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [search, setSearch] = useState("");
  const [monitoring, setMonitoring] = useState<"all" | "enabled" | "paused">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCompetitors(await listCompetitors({ search: search || undefined, monitoring }));
    } catch (err) {
      if (err instanceof Error && /not signed in/i.test(err.message)) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not load competitors");
    } finally {
      setLoading(false);
    }
  }, [search, monitoring, router]);

  // Debounced search: reload 400ms after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(load, 400);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    setError("");
    try {
      await deleteCompetitor(id);
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete competitor");
    } finally {
      setDeletingId(null);
    }
  }

  const watchedCount = (c: Competitor) =>
    [c.pricingPageUrl, c.changelogUrl, c.careersPageUrl, c.reviewSourceUrl].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Competitors"
        description="The companies you track. Only your organization can see these."
        actions={
          <Link href="/competitors/new" className={btnPrimary}>
            <Plus className="h-4 w-4" /> Add competitor
          </Link>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or website…"
            className={`${inputClass} mt-0 py-2.5 pl-9`}
          />
        </div>
        <select
          value={monitoring}
          onChange={(e) => setMonitoring(e.target.value as "all" | "enabled" | "paused")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="all">All competitors</option>
          <option value="enabled">Monitoring</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="mt-8 flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading competitors…
        </p>
      ) : competitors.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title={search || monitoring !== "all" ? "Nothing matches this search" : "No competitors yet"}
            description={
              search || monitoring !== "all"
                ? "Try a different name or filter."
                : "Add your first competitor — for example, a company whose pricing page you want to watch."
            }
            action={
              !search && monitoring === "all" ? (
                <Link href="/competitors/new" className={btnPrimary}>
                  <Plus className="h-4 w-4" /> Add your first competitor
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {competitors.map((c) => (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-base font-semibold text-indigo-700">
                    {c.companyName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-900">{c.companyName}</h2>
                    <a
                      href={c.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
                    >
                      <span className="truncate">{c.websiteUrl.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                </div>
                {c.isMonitoringEnabled ? (
                  <Badge tone="green">Monitoring</Badge>
                ) : (
                  <Badge tone="neutral">Paused</Badge>
                )}
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Checks {c.monitoringFrequency} · {watchedCount(c)} of 4 pages watched
                {c.lastScannedAt ? ` · Last scanned ${new Date(c.lastScannedAt).toLocaleDateString()}` : ""}
              </p>
              <p className="text-xs text-slate-500">
                Added {new Date(c.createdAt).toLocaleDateString()}
                {c.pricingPageUrl && " · Pricing"}
                {c.changelogUrl && " · Changelog"}
                {c.careersPageUrl && " · Careers"}
                {c.reviewSourceUrl && " · Reviews"}
              </p>
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                <Link href={`/competitors/${c.id}`} className={`${btnPrimary} flex-1 px-3 py-1.5`}>
                  View
                </Link>
                <Link href={`/competitors/${c.id}/edit`} className={`${btnSecondary} px-3 py-1.5`}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
                <button
                  onClick={() => handleDelete(c.id, c.companyName)}
                  disabled={deletingId === c.id}
                  className={btnDanger}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingId === c.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
