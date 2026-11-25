"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, Swords } from "lucide-react";
import { listCompetitors } from "@/services/competitors";
import { generateBattlecard, listBattlecards } from "@/services/battlecards";
import { Badge, Card, EmptyState, PageHeader, btnPrimary, btnSecondary } from "@/components/ui";
import type { BattlecardListItem, Competitor } from "@/types";

// Phase 7: the battlecards list — every competitor with its battlecard
// status. Generated ones link to their battlecard; the rest get a
// Generate button (which needs at least one scan first).
export default function BattlecardsPage() {
  const router = useRouter();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [cards, setCards] = useState<Map<string, BattlecardListItem>>(new Map());
  const [loadError, setLoadError] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    try {
      const [comps, list] = await Promise.all([listCompetitors(), listBattlecards()]);
      setCompetitors(comps);
      setCards(new Map(list.map((b) => [b.competitorId, b])));
    } catch (err) {
      if (err instanceof Error && /not signed in/i.test(err.message)) {
        router.push("/login");
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Could not load battlecards");
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate(competitorId: string) {
    setGeneratingId(competitorId);
    setActionError("");
    try {
      await generateBattlecard(competitorId);
      router.push(`/battlecards/${competitorId}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not generate battlecard");
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Subtle grid background overlay */}
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
          {/* Page header */}
          <PageHeader
            title="Battlecards"
            description="One battlecard per competitor, built from your real scans and AI analyses — pricing, features, recent changes, complaints, and talking points for sales calls."
          />

          {loadError && (
            <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
          )}
          {actionError && (
            <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>
          )}

          {competitors.length === 0 ? (
            <Card className="mt-6 p-12 text-center">
              <EmptyState
                icon={<Swords className="h-5 w-5" />}
                title="No competitors yet"
                description="Add a competitor and scan it first — a battlecard needs real snapshot data."
                action={
                  <Link
                    href="/competitors/new"
                    className="mt-4 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm"
                  >
                    <Plus className="h-4 w-4" /> Add a competitor
                  </Link>
                }
              />
            </Card>
          ) : (
            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              {competitors.map((c) => {
                const card = cards.get(c.id);
                return (
                  <Card
                    key={c.id}
                    className="flex flex-col p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-base font-semibold text-indigo-700"
                        >
                          {c.companyName.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{c.companyName}</p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {card
                              ? `Version ${card.version} · Last updated ${new Date(card.updatedAt).toLocaleString()}`
                              : "No battlecard yet"}
                          </p>
                          {card ? <Badge tone="green">Generated</Badge> : <Badge tone="neutral">Not generated</Badge>}
                        </div>
                      </div>
                      <div>
                        {card ? (
                          <Link
                            href={`/battlecards/${c.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm"
                          >
                            View
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleGenerate(c.id)}
                            disabled={generatingId === c.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-disabled"
                          >
                            {generatingId === c.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" /> Generate
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
