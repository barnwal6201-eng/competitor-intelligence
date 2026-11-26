"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import BusinessIcon from "@mui/icons-material/Business";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid2";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import LinkMui from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { listCompetitors, deleteCompetitor } from "@/services/competitors";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { motion } from "framer-motion";
import { fadeUp, staggerParent } from "@/components/motion";
import type { Competitor } from "@/types";

export default function CompetitorsPage() {
  const router = useRouter();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [search, setSearch] = useState("");
  const [monitoring, setMonitoring] = useState<"all" | "enabled" | "paused">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCompetitors(await listCompetitors({ search: search || undefined, monitoring }));
    } catch (err) {
      if (err instanceof Error && /not signed in/i.test(err.message)) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not load competitors");
    } finally {
      setLoading(false);
    }
  }, [search, monitoring, router]);

  // Debounced search: reload 400ms after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(load, 400);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    setError("");
    try {
      await deleteCompetitor(id);
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete competitor");
    } finally {
      setDeletingId(null);
    }
  }

  const watchedCount = (c: Competitor) =>
    [c.pricingPageUrl, c.changelogUrl, c.careersPageUrl, c.reviewSourceUrl].filter(Boolean).length;

  return (
    <Box>
      <PageHeader
        title="Competitors"
        description="The companies you track. Only your organization can see these."
        actions={
          <Button variant="contained" component={Link} href="/competitors/new" startIcon={<AddIcon />}>
            Add competitor
          </Button>
        }
      />

      <Box sx={{ mt: 3, display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5 }}>
        <TextField
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or website…"
          size="small"
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="monitoring-filter-label">Monitoring</InputLabel>
          <Select
            labelId="monitoring-filter-label"
            label="Monitoring"
            value={monitoring}
            onChange={(e) => setMonitoring(e.target.value as "all" | "enabled" | "paused")}
          >
            <MenuItem value="all">All competitors</MenuItem>
            <MenuItem value="enabled">Monitoring</MenuItem>
            <MenuItem value="paused">Paused</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ mt: 4, display: "flex", alignItems: "center", gap: 1.5, color: "text.secondary" }}>
          <CircularProgress size={18} /> Loading competitors…
        </Box>
      ) : competitors.length === 0 ? (
        <Card sx={{ mt: 3 }}>
          <EmptyState
            icon={<BusinessIcon />}
            title={search || monitoring !== "all" ? "Nothing matches this search" : "No competitors yet"}
            description={
              search || monitoring !== "all"
                ? "Try a different name or filter."
                : "Add your first competitor — for example, a company whose pricing page you want to watch."
            }
            action={
              !search && monitoring === "all" ? (
                <Button variant="contained" component={Link} href="/competitors/new" startIcon={<AddIcon />}>
                  Add your first competitor
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Grid container spacing={2.5} sx={{ mt: 0.5 }} component={motion.div} variants={staggerParent} initial="hidden" animate="show">
          {competitors.map((c) => (
            <Grid key={c.id} size={{ xs: 12, lg: 6 }} component={motion.div} variants={fadeUp} whileHover={{ y: -4 }}>
              <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <Box sx={{ display: "flex", flexDirection: "column", flex: 1, p: 2.5 }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
                    <Box sx={{ display: "flex", minWidth: 0, alignItems: "flex-start", gap: 1.5 }}>
                      <Avatar sx={{ background: "linear-gradient(135deg, #5e6ad2, #7c3aed)", fontWeight: 700 }}>
                        {c.companyName.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                          {c.companyName}
                        </Typography>
                        <LinkMui
                          href={c.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.875rem", maxWidth: "100%" }}
                        >
                          <Typography component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.websiteUrl.replace(/^https?:\/\//, "")}
                          </Typography>
                          <OpenInNewIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                        </LinkMui>
                      </Box>
                    </Box>
                    {c.isMonitoringEnabled ? <Badge tone="green">Monitoring</Badge> : <Badge tone="neutral">Paused</Badge>}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    Checks {c.monitoringFrequency} · {watchedCount(c)} of 4 pages watched
                    {c.lastScannedAt ? ` · Last scanned ${new Date(c.lastScannedAt).toLocaleDateString()}` : ""}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Added {new Date(c.createdAt).toLocaleDateString()}
                    {c.pricingPageUrl && " · Pricing"}
                    {c.changelogUrl && " · Changelog"}
                    {c.careersPageUrl && " · Careers"}
                    {c.reviewSourceUrl && " · Reviews"}
                  </Typography>
                  <Box sx={{ mt: 2, display: "flex", gap: 1, borderTop: "1px solid rgba(17,24,39,0.06)", pt: 2 }}>
                    <Button variant="contained" component={Link} href={`/competitors/${c.id}`} size="small" sx={{ flex: 1 }}>
                      View
                    </Button>
                    <Button variant="outlined" component={Link} href={`/competitors/${c.id}/edit`} size="small" startIcon={<EditIcon />}>
                      Edit
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handleDelete(c.id, c.companyName)}
                      disabled={deletingId === c.id}
                      startIcon={<DeleteIcon />}
                    >
                      {deletingId === c.id ? "Deleting…" : "Delete"}
                    </Button>
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
