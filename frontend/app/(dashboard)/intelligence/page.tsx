"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import { listFeed } from "@/services/changes";
import ChangeCard from "@/components/ChangeCard";
import { Card, EmptyState, PageHeader } from "@/components/ui";
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
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Intelligence feed"
        description="Every meaningful change the scans detected — price moves, new plans, new features, new jobs, and new reviews — across all your competitors. High means worth looking at today: a price increase, a removed plan, or a negative review."
      />

      <Card className="mt-6 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Significance</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {filterButton("All", significance === "", () => setSignificance(""))}
          {filterButton("High", significance === "high", () => setSignificance("high"))}
          {filterButton("Medium", significance === "medium", () => setSignificance("medium"))}
          {filterButton("Low", significance === "low", () => setSignificance("low"))}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Source</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {filterButton("All sources", type === "", () => setType(""))}
          {filterButton("Pricing", type === "pricing", () => setType("pricing"))}
          {filterButton("Changelog", type === "changelog", () => setType("changelog"))}
          {filterButton("Careers", type === "careers", () => setType("careers"))}
          {filterButton("Reviews", type === "reviews", () => setType("reviews"))}
        </div>
      </Card>

      {loadError && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      )}
      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading changes…
        </p>
      ) : changes.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={<Activity className="h-5 w-5" />}
            title="No changes detected yet"
            description="Scan a competitor twice with something changed on its pages in between — a price, a new feature, a new job, or a new review — and it will show up here."
          />
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {changes.map((c) => (
            <ChangeCard key={c.id} change={c} showCompetitor />
          ))}
        </ul>
      )}
    </div>
  );
}
