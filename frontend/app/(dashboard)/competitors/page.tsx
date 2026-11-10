"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listCompetitors, deleteCompetitor } from "@/services/competitors";
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-700">
            <Link href="/dashboard" className="hover:underline">← Dashboard</Link>
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Competitors</h1>
          <p className="mt-2 text-neutral-600">
            The companies you track. Only your organization can see these.
          </p>
        </div>
        <Link
          href="/competitors/new"
          className="shrink-0 rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white"
        >
          + Add competitor
        </Link>
      </div>

      <div className="mt-6 flex gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or website…"
          className="w-full rounded-md border border-neutral-300 px-3 py-2"
        />
        <select
          value={monitoring}
          onChange={(e) => setMonitoring(e.target.value as "all" | "enabled" | "paused")}
          className="rounded-md border border-neutral-300 px-3 py-2"
        >
          <option value="all">All</option>
          <option value="enabled">Monitoring</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="mt-8 text-neutral-600">Loading competitors…</p>
      ) : competitors.length === 0 ? (
        <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-medium">No competitors yet</h2>
          <p className="mt-2 text-neutral-700">
            {search || monitoring !== "all"
              ? "Nothing matches this search. Try a different name or filter."
              : "Add your first competitor — for example, a company whose pricing page you want to watch."}
          </p>
          {!search && monitoring === "all" && (
            <Link href="/competitors/new" className="mt-4 inline-block font-medium text-indigo-700">
              Add your first competitor →
            </Link>
          )}
        </section>
      ) : (
        <ul className="mt-8 space-y-4">
          {competitors.map((c) => (
            <li key={c.id} className="rounded-lg border border-neutral-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">{c.companyName}</h2>
                  <a
                    href={c.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo-700 hover:underline"
                  >
                    {c.websiteUrl}
                  </a>
                  <p className="mt-1 text-sm text-neutral-600">
                    Checks {c.monitoringFrequency} ·{" "}
                    {c.isMonitoringEnabled ? "Monitoring" : "Paused"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Added {new Date(c.createdAt).toLocaleDateString()}
                    {c.pricingPageUrl && " · Pricing page saved"}
                    {c.changelogUrl && " · Changelog saved"}
                    {c.careersPageUrl && " · Careers page saved"}
                    {c.reviewSourceUrl && " · Review source saved"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/competitors/${c.id}`}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium"
                  >
                    View
                  </Link>
                  <Link
                    href={`/competitors/${c.id}/edit`}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(c.id, c.companyName)}
                    disabled={deletingId === c.id}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50"
                  >
                    {deletingId === c.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
