"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getCompetitor } from "@/services/competitors";
import {
  generateBattlecard,
  getBattlecard,
  getBattlecardVersion,
  listBattlecardVersions,
  regenerateBattlecard,
  updateBattlecard,
  type BattlecardEdit,
} from "@/services/battlecards";
import BattlecardView, { type BattlecardContent } from "@/components/BattlecardView";
import type {
  Battlecard,
  BattlecardVersionDetail,
  BattlecardVersionInfo,
  Competitor,
} from "@/types";

// Phase 7: one battlecard — view, generate, regenerate, edit the AI
// sections, read previous versions, and print / save as PDF (the browser's
// print dialog). Pricing, features, recent changes, complaints, and
// sources are verified data and are never editable here; they change only
// via a new scan + Regenerate.
export default function BattlecardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.competitorId as string;
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [battlecard, setBattlecard] = useState<Battlecard | null>(null);
  const [versions, setVersions] = useState<BattlecardVersionInfo[]>([]);
  const [viewingVersion, setViewingVersion] = useState<BattlecardVersionDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notGenerated, setNotGenerated] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<BattlecardEdit>({});

  const loadVersions = useCallback(async () => {
    setVersions(await listBattlecardVersions(id));
  }, [id]);

  useEffect(() => {
    getCompetitor(id)
      .then(async (c) => {
        setCompetitor(c);
        try {
          const b = await getBattlecard(id);
          setBattlecard(b);
          await loadVersions();
        } catch (err) {
          if (err instanceof Error && /No battlecard yet/i.test(err.message)) {
            setNotGenerated(true);
            return;
          }
          throw err;
        }
      })
      .catch((err) => {
        if (err instanceof Error && /not signed in/i.test(err.message)) {
          router.push("/login");
          return;
        }
        setLoadError(err instanceof Error ? err.message : "Could not load battlecard");
      });
  }, [id, router, loadVersions]);

  async function handleGenerate() {
    setWorking(true);
    setActionError("");
    setActionMessage("");
    try {
      const result = await generateBattlecard(id);
      setBattlecard(result.battlecard);
      setNotGenerated(false);
      if (result.message) setActionMessage(result.message);
      await loadVersions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not generate battlecard");
    } finally {
      setWorking(false);
    }
  }

  async function handleRegenerate() {
    setWorking(true);
    setActionError("");
    setActionMessage("");
    try {
      const result = await regenerateBattlecard(id);
      setBattlecard(result.battlecard);
      setViewingVersion(null);
      if (result.message) setActionMessage(result.message);
      await loadVersions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not regenerate battlecard");
    } finally {
      setWorking(false);
    }
  }

  function startEditing() {
    if (!battlecard) return;
    setEditForm({
      overview: battlecard.overview,
      positioning: battlecard.positioning,
      strengths: battlecard.strengths,
      weaknesses: battlecard.weaknesses,
      talkingPoints: battlecard.talkingPoints,
      objectionHandling: battlecard.objectionHandling,
    });
    setEditing(true);
  }

  async function handleSaveEdit() {
    setWorking(true);
    setActionError("");
    try {
      const updated = await updateBattlecard(id, editForm);
      setBattlecard(updated);
      setEditing(false);
      await loadVersions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save battlecard");
    } finally {
      setWorking(false);
    }
  }

  async function handleViewVersion(version: number) {
    setActionError("");
    try {
      setViewingVersion(await getBattlecardVersion(id, version));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not load that version");
    }
  }

  // One-per-line textareas map to string arrays.
  const linesToArray = (text: string) =>
    text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const arrayToLines = (items?: string[]) => (items ?? []).join("\n");

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
        <Link href="/battlecards" className="mt-4 inline-block font-medium text-indigo-700">
          ← Back to battlecards
        </Link>
      </main>
    );
  }
  if (!competitor) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-neutral-600">Loading battlecard…</p>
      </main>
    );
  }

  const shownContent: BattlecardContent | null = viewingVersion
    ? {
        ...(viewingVersion.content as unknown as BattlecardContent),
        version: viewingVersion.version,
        generatedAt: viewingVersion.createdAt,
      }
    : battlecard;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-indigo-700 print:hidden">
        <Link href="/battlecards" className="hover:underline">← Battlecards</Link>
      </p>
      <div className="mt-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Battlecard: {competitor.companyName}</h1>
          <a href={competitor.websiteUrl} target="_blank" rel="noreferrer"
            className="text-sm text-indigo-700 hover:underline">
            {competitor.websiteUrl}
          </a>
        </div>
        {battlecard && !editing && (
          <div className="flex shrink-0 gap-2 print:hidden">
            <button
              onClick={handleRegenerate}
              disabled={working}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {working ? "Working…" : "Regenerate"}
            </button>
            <button
              onClick={startEditing}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white"
            >
              Print / PDF
            </button>
          </div>
        )}
      </div>

      {actionError && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 print:hidden">{actionError}</p>}
      {actionMessage && <p className="mt-4 rounded-md bg-indigo-50 p-3 text-sm text-indigo-800 print:hidden">{actionMessage}</p>}

      {notGenerated && !battlecard ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-neutral-700">
            No battlecard yet for {competitor.companyName}. Generating builds
            it from the latest scans and AI analysis — pricing, features,
            recent changes, complaints, and talking points.
          </p>
          <button
            onClick={handleGenerate}
            disabled={working}
            className="mt-4 rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {working ? "Generating…" : "Generate battlecard"}
          </button>
        </div>
      ) : editing && battlecard ? (
        <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-medium">Edit battlecard</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Only the AI-written sections can be edited here. Pricing,
            features, recent changes, complaints, and sources come from
            scans — rescan and Regenerate to update those. One item per
            line in the lists.
          </p>
          <label className="mt-4 block text-sm font-medium">Overview</label>
          <textarea
            value={editForm.overview ?? ""}
            onChange={(e) => setEditForm({ ...editForm, overview: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
          />
          <label className="mt-4 block text-sm font-medium">Positioning</label>
          <textarea
            value={editForm.positioning ?? ""}
            onChange={(e) => setEditForm({ ...editForm, positioning: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
          />
          {(
            [
              ["strengths", "Strengths"],
              ["weaknesses", "Weaknesses"],
              ["talkingPoints", "Talking points"],
              ["objectionHandling", "Objection handling"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="mt-4 block text-sm font-medium">{label}</label>
              <textarea
                value={arrayToLines(editForm[key])}
                onChange={(e) => setEditForm({ ...editForm, [key]: linesToArray(e.target.value) })}
                rows={4}
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
              />
            </div>
          ))}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={working}
              className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {working ? "Saving…" : "Save (new version)"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : shownContent ? (
        <>
          {viewingVersion && (
            <p className="mt-4 rounded-md bg-indigo-50 p-3 text-sm text-indigo-800 print:hidden">
              Viewing version {viewingVersion.version} from{" "}
              {new Date(viewingVersion.createdAt).toLocaleString()} — this is
              not the current version.{" "}
              <button onClick={() => setViewingVersion(null)} className="font-medium underline">
                Back to current
              </button>
            </p>
          )}
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <BattlecardView content={shownContent} />
          </div>
          {!viewingVersion && versions.length > 1 && (
            <section className="mt-6 print:hidden">
              <h2 className="text-lg font-medium">Previous versions</h2>
              <ul className="mt-2 space-y-1">
                {versions.map((v) => (
                  <li key={v.version}>
                    <button
                      onClick={() => handleViewVersion(v.version)}
                      className="text-sm text-indigo-700 hover:underline"
                    >
                      Version {v.version} — {new Date(v.createdAt).toLocaleString()}
                      {battlecard && v.version === battlecard.version ? " (current)" : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="mt-6 text-neutral-600">Loading battlecard…</p>
      )}
    </main>
  );
}
