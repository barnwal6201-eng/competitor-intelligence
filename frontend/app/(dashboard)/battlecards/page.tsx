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
    <div>
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
        <Card className="mt-6">
          <EmptyState
            icon={<Swords className="h-5 w-5" />}
            title="No competitors yet"
            description="Add a competitor and scan it first — a battlecard needs real snapshot data."
            action={
              <Link href="/competitors/new" className={btnPrimary}>
                <Plus className="h-4 w-4" /> Add a competitor
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {competitors.map((c) => {
            const card = cards.get(c.id);
            return (
              <Card key={c.id} className="flex items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-base font-semibold text-indigo-700">
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
                {card ? (
                  <Link href={`/battlecards/${c.id}`} className={`${btnSecondary} shrink-0`}>
                    View
                  </Link>
                ) : (
                  <button
                    onClick={() => handleGenerate(c.id)}
                    disabled={generatingId === c.id}
                    className={`${btnPrimary} shrink-0`}
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
