"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ActivityIcon from "@mui/icons-material/Timeline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { listFeed } from "@/services/changes";
import {
  listIntegrations,
  pushChangeToNotion,
  pushChangeToSalesforce,
} from "@/services/integrations";
import ChangeCard from "@/components/ChangeCard";
import { motion } from "framer-motion";
import { staggerParent } from "@/components/motion";
import { EmptyState, PageHeader } from "@/components/ui";
import type { ChangeEvent, ChangeSignificance, IntegrationInfo, SnapshotSourceType } from "@/types";

// Phase 5: the intelligence feed — every detected change across the whole
// organization, newest first. Filter by significance and source type; the
// backend does the filtering, this page only holds the filter state.
export default function IntelligencePage() {
  const router = useRouter();
  const [changes, setChanges] = useState<ChangeEvent[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [significance, setSignificance] = useState<ChangeSignificance | "">("");
  const [type, setType] = useState<SnapshotSourceType | "">("");
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState("");
  const [pushError, setPushError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setChanges(
        await listFeed({
          significance: significance || undefined,
          type: type || undefined,
          limit: 50,
        })
      );
    } catch (err) {
      if (err instanceof Error && /not signed in/i.test(err.message)) {
        router.push("/login");
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Could not load the feed");
    } finally {
      setLoading(false);
    }
  }, [significance, type, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    listIntegrations().then(setIntegrations).catch(() => {
      // Push buttons stay hidden if integrations cannot be listed.
    });
  }, []);

  async function handlePush(changeId: string, provider: "notion" | "salesforce") {
    setPushingId(changeId);
    setPushNotice("");
    setPushError("");
    try {
      const result =
        provider === "notion"
          ? await pushChangeToNotion(changeId)
          : await pushChangeToSalesforce(changeId);
      setPushNotice(`Sent to ${provider === "notion" ? "Notion" : "Salesforce"}: “${result.title}”.`);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Could not send the change");
    } finally {
      setPushingId(null);
    }
  }

  const filterButton = (label: string, active: boolean, onClick: () => void) => (
    <Button
      key={label}
      onClick={onClick}
      variant={active ? "contained" : "outlined"}
      size="small"
      sx={{ borderRadius: 999, px: 2 }}
    >
      {label}
    </Button>
  );

  return (
    <Box>
      <PageHeader
        title="Intelligence feed"
        description="Every meaningful change the scans detected — price moves, new plans, new features, new jobs, and new reviews — across all your competitors. High means worth looking at today: a price increase, a removed plan, or a negative review."
      />

      <Card sx={{ mt: 3 }}>
        <Box sx={{ p: 2.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
            Significance
          </Typography>
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
            {filterButton("All", significance === "", () => setSignificance(""))}
            {filterButton("High", significance === "high", () => setSignificance("high"))}
            {filterButton("Medium", significance === "medium", () => setSignificance("medium"))}
            {filterButton("Low", significance === "low", () => setSignificance("low"))}
          </Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: "block", mt: 2.5 }}>
            Source
          </Typography>
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
            {filterButton("All sources", type === "", () => setType(""))}
            {filterButton("Pricing", type === "pricing", () => setType("pricing"))}
            {filterButton("Changelog", type === "changelog", () => setType("changelog"))}
            {filterButton("Careers", type === "careers", () => setType("careers"))}
            {filterButton("Reviews", type === "reviews", () => setType("reviews"))}
          </Box>
        </Box>
      </Card>

      {loadError && (
        <Alert severity="error" sx={{ mt: 3 }}>{loadError}</Alert>
      )}
      {pushNotice && (
        <Alert severity="info" sx={{ mt: 3 }}>{pushNotice}</Alert>
      )}
      {pushError && (
        <Alert severity="error" sx={{ mt: 3 }}>{pushError}</Alert>
      )}
      {loading ? (
        <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 1.5, color: "text.secondary" }}>
          <CircularProgress size={18} /> Loading changes…
        </Box>
      ) : changes.length === 0 ? (
        <Card sx={{ mt: 3 }}>
          <EmptyState
            icon={<ActivityIcon />}
            title="No changes detected yet"
            description="Scan a competitor twice with something changed on its pages in between — a price, a new feature, a new job, or a new review — and it will show up here."
          />
        </Card>
      ) : (
        <motion.ul variants={staggerParent} initial="hidden" animate="show" style={{ margin: 0, marginTop: 24, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {changes.map((c) => (
            <ChangeCard
              key={c.id}
              change={c}
              showCompetitor
              notionConnected={integrations.some((i) => i.provider === "notion" && i.connected)}
              salesforceConnected={integrations.some(
                (i) => i.provider === "salesforce" && i.connected
              )}
              pushing={pushingId === c.id}
              onPush={(provider) => handlePush(c.id, provider)}
            />
          ))}
        </motion.ul>
      )}
    </Box>
  );
}
