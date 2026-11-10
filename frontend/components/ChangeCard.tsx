import Link from "next/link";
import type { ChangeEvent } from "@/types";

// Shared change card (Phase 5): one detected change, used by the
// intelligence feed and by the competitor detail page.

export function categoryLabel(category: ChangeEvent["category"]): string {
  return (
    {
      price_increase: "Price increase",
      price_decrease: "Price decrease",
      plan_added: "Plan added",
      plan_removed: "Plan removed",
      entry_added: "New changelog entry",
      entry_removed: "Changelog entry removed",
      job_posted: "New job",
      job_removed: "Job removed",
      review_added: "New review",
      negative_review: "Negative review",
    } as Record<ChangeEvent["category"], string>
  )[category];
}

export function sourceLabel(type: ChangeEvent["sourceType"]): string {
  return { pricing: "Pricing", changelog: "Changelog", careers: "Careers", reviews: "Reviews" }[type];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function ChangeCard({
  change,
  showCompetitor,
}: {
  change: ChangeEvent;
  showCompetitor?: boolean;
}) {
  const prev = formatValue(change.previousValue);
  const next = formatValue(change.newValue);
  const showValues = prev !== "" || next !== "";
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                change.significance === "high"
                  ? "bg-red-100 text-red-800"
                  : change.significance === "medium"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {change.significance === "high"
                ? "High"
                : change.significance === "medium"
                  ? "Medium"
                  : "Low"}
            </span>
            <span className="font-medium">{categoryLabel(change.category)}</span>
            <span className="text-neutral-500">· {sourceLabel(change.sourceType)}</span>
          </p>
          <p className="mt-2 font-medium">{change.title}</p>
          {showValues && (
            <p className="mt-1 text-sm text-neutral-600">
              {prev !== "" ? prev : "—"} → {next !== "" ? next : "—"}
            </p>
          )}
          <p className="mt-1 text-sm text-neutral-500">
            {new Date(change.detectedAt).toLocaleString()}
            {showCompetitor && change.competitorName ? (
              <>
                {" · "}
                <Link
                  href={`/competitors/${change.competitorId}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {change.competitorName}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <a
          href={change.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm text-indigo-700 hover:underline"
        >
          Source ↗
        </a>
      </div>
    </li>
  );
}
