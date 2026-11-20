import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui";
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
  const accent =
    change.significance === "high"
      ? "border-l-red-500"
      : change.significance === "medium"
        ? "border-l-amber-400"
        : "border-l-slate-300";
  return (
    <li className={`rounded-xl border border-slate-200 border-l-4 ${accent} bg-white p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Badge
              tone={
                change.significance === "high" ? "red" : change.significance === "medium" ? "amber" : "neutral"
              }
            >
              {change.significance === "high" ? "High" : change.significance === "medium" ? "Medium" : "Low"}
            </Badge>
            <span className="font-semibold text-slate-900">{categoryLabel(change.category)}</span>
            <span className="text-slate-500">· {sourceLabel(change.sourceType)}</span>
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900">{change.title}</p>
          {showValues && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
              <span className="rounded-md bg-slate-100 px-2 py-0.5">{prev !== "" ? prev : "—"}</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">{next !== "" ? next : "—"}</span>
            </p>
          )}
          <p className="mt-1.5 text-xs text-slate-500">
            {new Date(change.detectedAt).toLocaleString()}
            {showCompetitor && change.competitorName ? (
              <>
                {" · "}
                <Link
                  href={`/competitors/${change.competitorId}`}
                  className="font-medium text-indigo-600 hover:underline"
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
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
        >
          Source <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </li>
  );
}
devicePixelRatio