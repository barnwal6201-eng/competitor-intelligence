"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, History, Loader2, Pencil, Printer, RefreshCw, Sparkles } from "lucide-react";
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
import { BackLink, Card, EmptyState, PageHeader, btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/ui";
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
      <div>
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
        <BackLink href="/battlecards">
          <ArrowLeft className="h-4 w-4" /> Back to battlecards
        </BackLink>
      </div>
    );
  }
  if (!competitor) {
    return (
      <p className="flex items-center gap-2 py-16 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading battlecard…
      </p>
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
    <div>
      <PageHeader
        eyebrow={
          <BackLink href="/battlecards">
            <ArrowLeft className="h-4 w-4" /> Battlecards
          </BackLink>
        }
        title={`Battlecard: ${competitor.companyName}`}
        description={competitor.websiteUrl}
        actions={
          battlecard && !editing ? (
            <div className="flex flex-wrap gap-2 print:hidden">
              <button onClick={handleRegenerate} disabled={working} className={btnSecondary}>
                <RefreshCw className="h-4 w-4" /> {working ? "Working…" : "Regenerate"}
              </button>
              <button onClick={startEditing} className={btnSecondary}>
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button onClick={() => window.print()} className={btnPrimary}>
                <Printer className="h-4 w-4" /> Print / PDF
              </button>
            </div>
          ) : undefined
        }
      />

      {actionError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{actionError}</p>}
      {actionMessage && <p className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800 print:hidden">{actionMessage}</p>}

      {notGenerated && !battlecard ? (
        <Card className="mt-6">
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title={`No battlecard yet for ${competitor.companyName}`}
            description="Generating builds it from the latest scans and AI analysis — pricing, features, recent changes, complaints, and talking points."
            action={
              <button onClick={handleGenerate} disabled={working} className={btnPrimary}>
                {working ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  "Generate battlecard"
                )}
              </button>
            }
          />
        </Card>
      ) : editing && battlecard ? (
        <Card className="mt-6 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Edit battlecard</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Only the AI-written sections can be edited here. Pricing,
            features, recent changes, complaints, and sources come from
            scans — rescan and Regenerate to update those. One item per
            line in the lists.
          </p>
          <div className="mt-6 space-y-5">
            <div>
              <label className={labelClass}>Overview</label>
              <textarea
                value={editForm.overview ?? ""}
                onChange={(e) => setEditForm({ ...editForm, overview: e.target.value })}
                rows={3}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Positioning</label>
              <textarea
                value={editForm.positioning ?? ""}
                onChange={(e) => setEditForm({ ...editForm, positioning: e.target.value })}
                rows={3}
                className={inputClass}
              />
            </div>
            {(
              [
                ["strengths", "Strengths"],
                ["weaknesses", "Weaknesses"],
                ["talkingPoints", "Talking points"],
                ["objectionHandling", "Objection handling"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <textarea
                  value={arrayToLines(editForm[key])}
                  onChange={(e) => setEditForm({ ...editForm, [key]: linesToArray(e.target.value) })}
                  rows={4}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <button onClick={handleSaveEdit} disabled={working} className={btnPrimary}>
              {working ? "Saving…" : "Save (new version)"}
            </button>
            <button onClick={() => setEditing(false)} className={btnSecondary}>
              Cancel
            </button>
          </div>
        </Card>
      ) : shownContent ? (
        <>
          {viewingVersion && (
            <p className="mt-6 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800 print:hidden">
              Viewing version {viewingVersion.version} from{" "}
              {new Date(viewingVersion.createdAt).toLocaleString()} — this is
              not the current version.{" "}
              <button onClick={() => setViewingVersion(null)} className="font-medium underline">
                Back to current
              </button>
            </p>
          )}
          <Card className="mt-6 p-6 sm:p-8">
            <BattlecardView content={shownContent} />
          </Card>
          {!viewingVersion && versions.length > 1 && (
            <Card className="mt-6 p-6 print:hidden">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <History className="h-5 w-5 text-indigo-600" /> Previous versions
              </h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {versions.map((v) => (
                  <li key={v.version} className="py-2 first:pt-0 last:pb-0">
                    <button
                      onClick={() => handleViewVersion(v.version)}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Version {v.version} — {new Date(v.createdAt).toLocaleString()}
                      {battlecard && v.version === battlecard.version ? " (current)" : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      ) : (
        <p className="mt-6 flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading battlecard…
        </p>
      )}
    </div>
  );
}
