"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid2";
import StyleIcon from "@mui/icons-material/Style";
import Typography from "@mui/material/Typography";
import { listCompetitors } from "@/services/competitors";
import { generateBattlecard, listBattlecards } from "@/services/battlecards";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { motion } from "framer-motion";
import { fadeUp, staggerParent } from "@/components/motion";
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
    <Box>
      <PageHeader
        title="Battlecards"
        description="One battlecard per competitor, built from your real scans and AI analyses — pricing, features, recent changes, complaints, and talking points for sales calls."
      />

      {loadError && (
        <Alert severity="error" sx={{ mt: 3 }}>{loadError}</Alert>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mt: 3 }}>{actionError}</Alert>
      )}

      {competitors.length === 0 ? (
        <Card sx={{ mt: 3 }}>
          <EmptyState
            icon={<StyleIcon />}
            title="No competitors yet"
            description="Add a competitor and scan it first — a battlecard needs real snapshot data."
            action={
              <Button variant="contained" component={Link} href="/competitors/new" startIcon={<AddIcon />}>
                Add a competitor
              </Button>
            }
          />
        </Card>
      ) : (
        <Grid container spacing={2.5} sx={{ mt: 0.5 }} component={motion.div} variants={staggerParent} initial="hidden" animate="show">
          {competitors.map((c) => {
            const card = cards.get(c.id);
            return (
              <Grid key={c.id} size={{ xs: 12, lg: 6 }} component={motion.div} variants={fadeUp} whileHover={{ y: -4 }}>
                <Card sx={{ height: "100%" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, p: 2.5 }}>
                    <Box sx={{ display: "flex", minWidth: 0, alignItems: "flex-start", gap: 1.5 }}>
                      <Avatar sx={{ background: "linear-gradient(135deg, #5e6ad2, #7c3aed)", fontWeight: 700 }}>
                        {c.companyName.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                          {c.companyName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                          {card
                            ? `Version ${card.version} · Last updated ${new Date(card.updatedAt).toLocaleString()}`
                            : "No battlecard yet"}
                        </Typography>
                        <Box sx={{ mt: 0.75 }}>
                          {card ? <Badge tone="green">Generated</Badge> : <Badge tone="neutral">Not generated</Badge>}
                        </Box>
                      </Box>
                    </Box>
                    {card ? (
                      <Button variant="outlined" component={Link} href={`/battlecards/${c.id}`} sx={{ flexShrink: 0 }}>
                        View
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={() => handleGenerate(c.id)}
                        disabled={generatingId === c.id}
                        startIcon={generatingId === c.id ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                        sx={{ flexShrink: 0 }}
                      >
                        {generatingId === c.id ? "Generating…" : "Generate"}
                      </Button>
                    )}
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
