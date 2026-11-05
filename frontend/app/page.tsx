"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle, Database, Server } from "lucide-react";
import { getApiUrl, getBackendHealth } from "@/services/api";
import type { BackendHealth } from "@/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: BackendHealth };

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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="flex gap-4 text-sm font-medium">
        <Link href="/login" className="text-indigo-700">Sign in</Link>
        <Link href="/register" className="text-indigo-700">Create account</Link>
        <Link href="/dashboard" className="text-indigo-700">Dashboard (protected)</Link>
      </nav>
      <p className="mt-6 text-sm font-medium text-indigo-700">Competitor Intelligence Scraper &amp; Battlecard Agent</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Phase 1 — Setup check</h1>
      <p className="mt-3 text-neutral-600">
        This page shows only real data from the backend. If the backend is not running, it says so —
        no fake analytics, as required by the PRD.
      </p>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Server className="h-5 w-5" /> Backend connection
        </h2>

        {state.kind === "loading" && (
          <p className="mt-4 flex items-center gap-2 text-neutral-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking {getApiUrl()}/api/health…
          </p>
        )}

        {state.kind === "error" && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
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
          <div className="mt-4 space-y-3">
            <p className="flex items-center gap-2 font-medium text-emerald-800">
              <CheckCircle2 className="h-5 w-5" /> Backend connected — {state.data.service}
            </p>
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              <Database className="h-4 w-4" />
              Database: {state.data.database} — {state.data.databaseNote}
            </p>
            <p className="text-sm text-neutral-500">
              Checked at {new Date(state.data.timestamp).toLocaleString()} · API: {getApiUrl()}
            </p>
            {state.data.database === "disconnected" && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Database disconnected is normal in Phase 1 until you add a MongoDB Atlas URI to
                backend/.env. The frontend-backend link itself is already working.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-medium">What Phase 1 includes</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-neutral-700">
          <li>Next.js App Router frontend (TypeScript + Tailwind CSS) — no Vite, per the PRD</li>
          <li>Express.js + TypeScript backend with a /api/health endpoint</li>
          <li>MongoDB connection code (Mongoose) that reports its real status instead of crashing</li>
          <li>Frontend-backend communication through services/api.ts, kept separate from UI</li>
        </ul>
        <h2 className="mt-6 text-lg font-medium">What comes next (Phase 2)</h2>
        <p className="mt-2 text-neutral-700">
          Database models (User, Organization, Competitor) and register/login with bcrypt +
          HTTP-only cookies. Scraping, Redis/BullMQ, OpenAI and Notion/Salesforce are later phases —
          deliberately not faked here.
        </p>
      </section>
    </main>
  );
}
