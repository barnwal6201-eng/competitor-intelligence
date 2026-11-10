"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listFeed } from "@/services/changes";
import ChangeCard from "@/components/ChangeCard";
import type { ChangeEvent, ChangeSignificance, SnapshotSourceType } from "@/types";

// Phase 5: the intelligence feed — every detected change across the whole
// organization, newest first. Filter by significance and source type; the
// backend does the filtering, this page only holds the filter state.
export default function IntelligencePage() {
  const router = useRouter();
  const [changes, setChanges] = useState<ChangeEvent[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [significance, setSignificance] = useState<ChangeSignificance | "">("");
  const [type, setType] = useState<SnapshotSourceType | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setChanges(
        await listFeed({
          significance: significance || undefined,
          type: type || undefined,
          limit: 50,
        })
      );
    } catch (err) {
      if (err instanceof Error && /not signed in/i.test(err.message)) {
        router.push("/login");
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Could not load the feed");
    } finally {
      setLoading(false);
    }
  }, [significance, type, router]);

  useEffect(() => {
    load();
  }, [load]);

  const filterButton = (
    label: string,
    active: boolean,
    onClick: () => void
  ) => (
    <button
      key={label}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm font-medium ${
        active ? "bg-indigo-700 text-white" : "bg-white text-neutral-700 border border-neutral-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-indigo-700">
        <Link href="/dashboard" className="hover:underline">← Dashboard</Link>
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Intelligence feed</h1>
      <p className="mt-2 text-neutral-600">
        Every meaningful change the scans detected — price moves, new plans,
        new features, new jobs, and new reviews — across all your competitors.
        High means worth looking at today: a price increase, a removed plan,
        or a negative review.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {filterButton("All", significance === "", () => setSignificance(""))}
        {filterButton("High", significance === "high", () => setSignificance("high"))}
        {filterButton("Medium", significance === "medium", () => setSignificance("medium"))}
        {filterButton("Low", significance === "low", () => setSignificance("low"))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {filterButton("All sources", type === "", () => setType(""))}
        {filterButton("Pricing", type === "pricing", () => setType("pricing"))}
        {filterButton("Changelog", type === "changelog", () => setType("changelog"))}
        {filterButton("Careers", type === "careers", () => setType("careers"))}
        {filterButton("Reviews", type === "reviews", () => setType("reviews"))}
      </div>

      {loadError && (
        <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      )}
      {loading ? (
        <p className="mt-6 text-neutral-600">Loading changes…</p>
      ) : changes.length === 0 ? (
        <p className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 text-neutral-700">
          No changes detected yet. Scan a competitor twice with something
          changed on its pages in between — a price, a new feature, a new job,
          or a new review — and it will show up here.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {changes.map((c) => (
            <ChangeCard key={c.id} change={c} showCompetitor />
          ))}
        </ul>
      )}
    </main>
  );
}
