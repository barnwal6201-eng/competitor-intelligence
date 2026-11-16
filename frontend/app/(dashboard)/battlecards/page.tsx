"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listCompetitors } from "@/services/competitors";
import { generateBattlecard, listBattlecards } from "@/services/battlecards";
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-indigo-700">
        <Link href="/dashboard" className="hover:underline">← Dashboard</Link>
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Battlecards</h1>
      <p className="mt-2 text-neutral-600">
        One battlecard per competitor, built from your real scans and AI
        analyses — pricing, features, recent changes, complaints, and
        talking points for sales calls.
      </p>

      {loadError && (
        <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      )}
      {actionError && (
        <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{actionError}</p>
      )}

      {competitors.length === 0 ? (
        <p className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 text-neutral-700">
          No competitors yet.{" "}
          <Link href="/competitors/new" className="font-medium text-indigo-700 hover:underline">
            Add one
          </Link>{" "}
          and scan it first — a battlecard needs real snapshot data.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {competitors.map((c) => {
            const card = cards.get(c.id);
            return (
              <li key={c.id} className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-5">
                <div>
                  <p className="font-medium">{c.companyName}</p>
                  <p className="text-sm text-neutral-500">
                    {card
                      ? `Version ${card.version} · Last updated ${new Date(card.updatedAt).toLocaleString()}`
                      : "No battlecard yet"}
                  </p>
                </div>
                {card ? (
                  <Link
                    href={`/battlecards/${c.id}`}
                    className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium"
                  >
                    View
                  </Link>
                ) : (
                  <button
                    onClick={() => handleGenerate(c.id)}
                    disabled={generatingId === c.id}
                    className="shrink-0 rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {generatingId === c.id ? "Generating…" : "Generate"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
