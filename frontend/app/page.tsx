"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ActivityIcon from "@mui/icons-material/Timeline";
import Alert from "@mui/material/Alert";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CircularProgress from "@mui/material/CircularProgress";
import DatabaseIcon from "@mui/icons-material/Storage";
import Grid from "@mui/material/Grid2";
import LinkMui from "@mui/material/Link";
import RadarIcon from "@mui/icons-material/Radar";
import ServerIcon from "@mui/icons-material/Dns";
import StyleIcon from "@mui/icons-material/Style";
import Typography from "@mui/material/Typography";
import ErrorIcon from "@mui/icons-material/Error";
import { getApiUrl, getBackendHealth } from "@/services/api";
import type { BackendHealth } from "@/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: BackendHealth };

const FEATURES = [
  {
    icon: RadarIcon,
    title: "Scheduled scans",
    text: "Pricing, changelog, careers, and review pages fetched on your schedule and stored as snapshots.",
  },
  {
    icon: ActivityIcon,
    title: "Change detection",
    text: "Every new snapshot is compared with the last one. Price moves, new plans, and negative reviews are ranked by significance.",
  },
  {
    icon: StyleIcon,
    title: "Battlecards",
    text: "One battlecard per competitor, built from your real scans — pricing, features, complaints, and talking points.",
  },
  {
    icon: CheckCircleIcon,
    title: "Nothing faked",
    text: "Every number on every page comes from your own data. Empty states stay empty until a scan finds something real.",
  },
];

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
    <Box sx={{ minHeight: "100vh" }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(255, 255, 255, 0.65)",
          backdropFilter: "blur(18px) saturate(160%)",
          borderBottom: "1px solid rgba(255,255,255,0.6)",
        }}
      >
        <Box sx={{ mx: "auto", maxWidth: 1152, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, px: { xs: 2, sm: 3 }, py: 1.75 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                display: "flex",
                height: 36,
                width: 36,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 1.5,
                background: "linear-gradient(135deg, #5e6ad2, #7c3aed)",
                color: "#fff",
                boxShadow: "0 4px 14px rgba(94, 106, 210, 0.35)",
              }}
            >
              <RadarIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ lineHeight: 1.2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                Competitor Intelligence
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Scraper &amp; Battlecard Agent
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button component={Link} href="/login" color="inherit">
              Sign in
            </Button>
            <Button component={Link} href="/register" variant="contained">
              Create account
            </Button>
          </Box>
        </Box>
      </Box>

      <Box component="main" sx={{ mx: "auto", maxWidth: 1152, px: { xs: 2, sm: 3 }, py: { xs: 6, lg: 8 } }}>
        <Box sx={{ maxWidth: 720 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
            Competitor tracking for sales teams
          </Typography>
          <Typography variant="h2" component="h1" sx={{ mt: 1.5, fontSize: { xs: "2.2rem", sm: "3rem" }, lineHeight: 1.15 }}>
            Know what your competitors changed — before your next sales call.
          </Typography>
          <Typography variant="h6" component="p" color="text.secondary" sx={{ mt: 2, fontWeight: 400, lineHeight: 1.6 }}>
            Watch pricing pages, changelogs, job listings, and reviews. Changes
            are detected against the last snapshot and written into battlecards
            your team can actually use.
          </Typography>
          <Box sx={{ mt: 4, display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <Button component={Link} href="/register" variant="contained" size="large" endIcon={<ArrowRightIcon />}>
              Create your workspace
            </Button>
            <Button component={Link} href="/dashboard" variant="outlined" size="large">
              Open dashboard
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2.5} sx={{ mt: 6 }}>
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Grid key={title} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card sx={{ height: "100%" }}>
                <Box sx={{ p: 2.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      height: 40,
                      width: 40,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 2,
                      background: "rgba(94, 106, 210, 0.14)",
                      color: "primary.main",
                    }}
                  >
                    <Icon />
                  </Box>
                  <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 700 }}>{title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>{text}</Typography>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Card sx={{ mt: 4 }}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ServerIcon color="primary" /> Backend connection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              This status is live — it asks the backend right now, instead of showing a fixed “online” badge.
            </Typography>

            {state.kind === "loading" && (
              <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                <CircularProgress size={16} /> Checking {getApiUrl()}/api/health…
              </Box>
            )}

            {state.kind === "error" && (
              <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Backend not reachable</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {state.message}. Start the backend first: open a second terminal, go into{" "}
                  <Typography component="code" sx={{ background: "rgba(255,255,255,0.7)", borderRadius: 1, px: 0.75, py: 0.25 }}>backend</Typography>{" "}
                  and run{" "}
                  <Typography component="code" sx={{ background: "rgba(255,255,255,0.7)", borderRadius: 1, px: 0.75, py: 0.25 }}>npm run dev</Typography>
                  , then refresh this page.
                </Typography>
              </Alert>
            )}

            {state.kind === "ok" && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 600, color: "#047857" }}>
                  <CheckCircleIcon /> Backend connected — {state.data.service}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <DatabaseIcon sx={{ fontSize: 18 }} />
                  Database: {state.data.database} — {state.data.databaseNote}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Checked at {new Date(state.data.timestamp).toLocaleString()} · API: {getApiUrl()}
                </Typography>
                {state.data.database === "disconnected" && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Database disconnected is normal until you add a MongoDB Atlas URI to
                    backend/.env. The frontend-backend link itself is already working.
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        </Card>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
          Already have an account?{" "}
          <LinkMui component={Link} href="/login" sx={{ fontWeight: 600 }}>
            Sign in
          </LinkMui>{" "}
          to your workspace.
        </Typography>
      </Box>
    </Box>
  );
}
