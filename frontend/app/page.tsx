"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  Loader2,
  Radar,
  ScanLine,
  Server,
  Swords,
  XCircle,
} from "lucide-react";
import { getApiUrl, getBackendHealth } from "@/services/api";
import type { BackendHealth } from "@/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: BackendHealth };

const FEATURES = [
  {
    icon: ScanLine,
    title: "Scheduled scans",
    text: "Pricing, changelog, careers, and review pages fetched on your schedule and stored as snapshots.",
  },
  {
    icon: Activity,
    title: "Change detection",
    text: "Every new snapshot is compared with the last one. Price moves, new plans, and negative reviews are ranked by significance.",
  },
  {
    icon: Swords,
    title: "Battlecards",
    text: "One battlecard per competitor, built from your real scans — pricing, features, complaints, and talking points.",
  },
  {
    icon: CheckCircle2,
    title: "Nothing faked",
    text: "Every number on every page comes from your own data. Empty states stay empty until a scan finds something real.",
  },
];

export default function HomePage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getBackendHealth()
      .then((data) => {
        if (!cancelled) setState({ kind: "ok", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Unknown error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Radar className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight text-slate-900">
                Competitor Intelligence
              </span>
              <span className="block text-xs text-slate-500">Scraper &amp; Battlecard Agent</span>
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
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Competitor tracking for sales teams
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Know what your competitors changed — before your next sales call.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Watch pricing pages, changelogs, job listings, and reviews. Changes
            are detected against the last snapshot and written into battlecards
            your team can actually use.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              Create your workspace <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Open dashboard
            </Link>
          </div>
        </div>

        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Server className="h-5 w-5 text-indigo-600" /> Backend connection
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This status is live — it asks the backend right now, instead of showing a fixed “online” badge.
          </p>

          {state.kind === "loading" && (
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking {getApiUrl()}/api/health…
            </p>
          )}

          {state.kind === "error" && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 font-medium text-red-800">
                <XCircle className="h-5 w-5" /> Backend not reachable
              </p>
              <p className="mt-2 text-sm text-red-700">
                {state.message}. Start the backend first: open a second terminal, go into{" "}
                <code className="rounded bg-white px-1 py-0.5">backend</code> and run{" "}
                <code className="rounded bg-white px-1 py-0.5">npm run dev</code>, then refresh this page.
              </p>
            </div>
          )}

          {state.kind === "ok" && (
            <div className="mt-4 space-y-2">
              <p className="flex items-center gap-2 font-medium text-emerald-800">
                <CheckCircle2 className="h-5 w-5" /> Backend connected — {state.data.service}
              </p>
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Database className="h-4 w-4" />
                Database: {state.data.database} — {state.data.databaseNote}
              </p>
              <p className="text-sm text-slate-500">
                Checked at {new Date(state.data.timestamp).toLocaleString()} · API: {getApiUrl()}
              </p>
              {state.data.database === "disconnected" && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Database disconnected is normal until you add a MongoDB Atlas URI to
                  backend/.env. The frontend-backend link itself is already working.
                </p>
              )}
            </div>
          )}
        </section>

        <p className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>{" "}
          to your workspace.
        </p>
      </main>
    </div>
  );
}
