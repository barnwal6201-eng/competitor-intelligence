"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import LinkMui from "@mui/material/Link";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getCompetitor } from "@/services/competitors";
import {
  listIntegrations,
  pushBattlecardToNotion,
  pushBattlecardToSalesforce,
} from "@/services/integration";
import type { IntegrationInfo } from "@/types";
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
import { BackLink, EmptyState, PageHeader } from "@/components/ui";
import { motion } from "framer-motion";
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
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [parentPageId, setParentPageId] = useState("");
  const [pushWorking, setPushWorking] = useState<"notion" | "salesforce" | null>(null);
  const [pushResultUrl, setPushResultUrl] = useState("");

  const loadVersions = useCallback(async () => {
    setVersions(await listBattlecardVersions(id));
  }, [id]);

  const loadIntegrations = useCallback(async () => {
    try {
      const list = await listIntegrations();
      setIntegrations(list);
      const notion = list.find((i) => i.provider === "notion");
      if (notion?.notionParentPageId) setParentPageId(notion.notionParentPageId);
    } catch {
      // Push buttons stay hidden if integrations cannot be listed.
    }
  }, []);

  async function handlePush(provider: "notion" | "salesforce") {
    setPushWorking(provider);
    setActionError("");
    setActionMessage("");
    setPushResultUrl("");
    try {
      const result =
        provider === "notion"
          ? await pushBattlecardToNotion(id, parentPageId.trim() || undefined)
          : await pushBattlecardToSalesforce(id);
      setIntegrations((current) =>
        current.map((i) =>
          i.provider === "notion" ? { ...i, notionParentPageId: parentPageId.trim() || i.notionParentPageId } : i
        )
      );
      setActionMessage(
        `Pushed to ${provider === "notion" ? "Notion" : "Salesforce"} as “${result.title}”.`
      );
      if (result.externalUrl) setPushResultUrl(result.externalUrl);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not push the battlecard");
    } finally {
      setPushWorking(null);
    }
  }

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
    loadIntegrations();
  }, [id, router, loadVersions, loadIntegrations]);

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
      <Box>
        <Alert severity="error">{loadError}</Alert>
        <Box sx={{ mt: 2 }}>
          <BackLink href="/battlecards">
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to battlecards
          </BackLink>
        </Box>
      </Box>
    );
  }
  if (!competitor) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 8, color: "text.secondary" }}>
        <CircularProgress size={18} /> Loading battlecard…
      </Box>
    );
  }

  const shownContent: BattlecardContent | null = viewingVersion
    ? {
        ...(viewingVersion.content as unknown as BattlecardContent),
        version: viewingVersion.version,
        generatedAt: viewingVersion.createdAt,
      }
    : battlecard;

  const editFields = (
    [
      ["strengths", "Strengths"],
      ["weaknesses", "Weaknesses"],
      ["talkingPoints", "Talking points"],
      ["objectionHandling", "Objection handling"],
    ] as const
  );

  return (
    <Box>
      <PageHeader
        eyebrow={
          <BackLink href="/battlecards">
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Battlecards
          </BackLink>
        }
        title={`Battlecard: ${competitor.companyName}`}
        description={competitor.websiteUrl}
        actions={
          battlecard && !editing ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, "@media print": { display: "none" } }}>
              <Button onClick={handleRegenerate} disabled={working} variant="outlined" startIcon={<RefreshIcon />}>
                {working ? "Working…" : "Regenerate"}
              </Button>
              <Button onClick={startEditing} variant="outlined" startIcon={<EditIcon />}>
                Edit
              </Button>
              <Button onClick={() => window.print()} variant="contained" startIcon={<PrintIcon />}>
                Print / PDF
              </Button>
            </Box>
          ) : undefined
        }
      />

      {actionError && (
        <Alert severity="error" sx={{ mt: 2, "@media print": { display: "none" } }}>{actionError}</Alert>
      )}
      {actionMessage && (
        <Alert severity="info" sx={{ mt: 2, "@media print": { display: "none" } }}>
          {actionMessage}{" "}
          {pushResultUrl ? (
            <LinkMui href={pushResultUrl} target="_blank" rel="noreferrer" sx={{ fontWeight: 600 }}>
              Open in Notion
            </LinkMui>
          ) : null}
        </Alert>
      )}

      {/* Phase 10: push this battlecard to Notion or Salesforce. */}
      {battlecard && !editing && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.45, ease: "easeOut" }}>
        <Card sx={{ mt: 3, "@media print": { display: "none" } }}>
          <Box sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Push to your tools</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Send this battlecard to Notion as a page, or to Salesforce as a Task on your activity
              timeline. Connect them first on the{" "}
              <LinkMui component={Link} href="/integrations" sx={{ fontWeight: 600 }}>
                Integrations page
              </LinkMui>
              .
            </Typography>
            <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 1.5 }}>
              <TextField
                label="Notion parent page id (first push only)"
                placeholder="Paste the page id from the Notion page URL"
                value={parentPageId}
                onChange={(e) => setParentPageId(e.target.value)}
                size="small"
                sx={{ minWidth: 220, flex: 1 }}
              />
              <Button
                onClick={() => handlePush("notion")}
                disabled={pushWorking !== null || !integrations.find((i) => i.provider === "notion")?.connected}
                variant="outlined"
                title={
                  integrations.find((i) => i.provider === "notion")?.connected
                    ? "Create this battlecard as a Notion page"
                    : "Connect Notion first on the Integrations page"
                }
              >
                {pushWorking === "notion" ? "Pushing…" : "Push to Notion"}
              </Button>
              <Button
                onClick={() => handlePush("salesforce")}
                disabled={pushWorking !== null || !integrations.find((i) => i.provider === "salesforce")?.connected}
                variant="outlined"
                title={
                  integrations.find((i) => i.provider === "salesforce")?.connected
                    ? "Create this battlecard as a Salesforce Task"
                    : "Connect Salesforce first on the Integrations page"
                }
              >
                {pushWorking === "salesforce" ? "Pushing…" : "Push to Salesforce"}
              </Button>
            </Box>
          </Box>
        </Card>
        </motion.div>
      )}

      {notGenerated && !battlecard ? (
        <Card sx={{ mt: 3 }}>
          <EmptyState
            icon={<AutoAwesomeIcon />}
            title={`No battlecard yet for ${competitor.companyName}`}
            description="Generating builds it from the latest scans and AI analysis — pricing, features, recent changes, complaints, and talking points."
            action={
              <Button
                onClick={handleGenerate}
                disabled={working}
                variant="contained"
                startIcon={working ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {working ? "Generating…" : "Generate battlecard"}
              </Button>
            }
          />
        </Card>
      ) : editing && battlecard ? (
        <Card sx={{ mt: 3 }}>
          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Typography variant="h6">Edit battlecard</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
              Only the AI-written sections can be edited here. Pricing,
              features, recent changes, complaints, and sources come from
              scans — rescan and Regenerate to update those. One item per
              line in the lists.
            </Typography>
            <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
              <TextField
                label="Overview"
                multiline
                rows={3}
                fullWidth
                value={editForm.overview ?? ""}
                onChange={(e) => setEditForm({ ...editForm, overview: e.target.value })}
              />
              <TextField
                label="Positioning"
                multiline
                rows={3}
                fullWidth
                value={editForm.positioning ?? ""}
                onChange={(e) => setEditForm({ ...editForm, positioning: e.target.value })}
              />
              {editFields.map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  multiline
                  rows={4}
                  fullWidth
                  value={arrayToLines(editForm[key])}
                  onChange={(e) => setEditForm({ ...editForm, [key]: linesToArray(e.target.value) })}
                />
              ))}
            </Box>
            <Box sx={{ mt: 3, display: "flex", gap: 1 }}>
              <Button onClick={handleSaveEdit} disabled={working} variant="contained" startIcon={working ? <CircularProgress size={16} color="inherit" /> : undefined}>
                {working ? "Saving…" : "Save (new version)"}
              </Button>
              <Button onClick={() => setEditing(false)} variant="outlined">
                Cancel
              </Button>
            </Box>
          </Box>
        </Card>
      ) : shownContent ? (
        <>
          {viewingVersion && (
            <Alert severity="info" sx={{ mt: 3, "@media print": { display: "none" } }}>
              Viewing version {viewingVersion.version} from{" "}
              {new Date(viewingVersion.createdAt).toLocaleString()} — this is
              not the current version.{" "}
              <LinkMui component="button" onClick={() => setViewingVersion(null)} sx={{ fontWeight: 600, cursor: "pointer" }}>
                Back to current
              </LinkMui>
            </Alert>
          )}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" }}>
          <Card sx={{ mt: 3 }}>
            <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
              <BattlecardView content={shownContent} />
            </Box>
          </Card>
          </motion.div>
          {!viewingVersion && versions.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.45, ease: "easeOut" }}>
            <Card sx={{ mt: 3, "@media print": { display: "none" } }}>
              <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <HistoryIcon color="primary" /> Previous versions
                </Typography>
                <Box component="ul" sx={{ m: 0, mt: 1.5, p: 0, listStyle: "none" }}>
                  {versions.map((v) => (
                    <Box
                      key={v.version}
                      component="li"
                      sx={{ py: 1, borderBottom: "1px solid rgba(17,24,39,0.06)", "&:last-child": { borderBottom: "none", pb: 0 }, "&:first-of-type": { pt: 0 } }}
                    >
                      <LinkMui component="button" onClick={() => handleViewVersion(v.version)} sx={{ fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                        Version {v.version} — {new Date(v.createdAt).toLocaleString()}
                        {battlecard && v.version === battlecard.version ? " (current)" : ""}
                      </LinkMui>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Card>
            </motion.div>
          )}
        </>
      ) : (
        <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 1.5, color: "text.secondary" }}>
          <CircularProgress size={18} /> Loading battlecard…
        </Box>
      )}
    </Box>
  );
}
