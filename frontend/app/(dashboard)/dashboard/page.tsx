"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ActivityIcon from "@mui/icons-material/Timeline";
import Alert from "@mui/material/Alert";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import Box from "@mui/material/Box";
import BusinessIcon from "@mui/icons-material/Business";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import LinkMui from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import WarningIcon from "@mui/icons-material/WarningAmber";
import StyleIcon from "@mui/icons-material/Style";
import { getCurrentUser } from "@/services/auth";
import { getDashboardOverview } from "@/services/dashboard";
import { categoryLabel } from "@/components/ChangeCard";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { motion } from "framer-motion";
import { AnimatedNumber, fadeUp, staggerParent } from "@/components/motion";
import type { AuthUser, DashboardOverview } from "@/types";

// Phase 12 restyle of the Phase 8 dashboard, MUI glass version. Every
// number is still a live count over the signed-in user's own data —
// competitors, changes, price moves, battlecards, and scan health. An
// empty workspace shows honest zeros and empty states, never sample data.
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCurrentUser(), getDashboardOverview()])
      .then(([u, o]) => {
        setUser(u);
        setOverview(o);
      })
      .catch(() => {
        setError("Your session could not be verified. Please sign in again.");
        router.push("/login");
      });
  }, [router]);

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!user || !overview) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 8, color: "text.secondary" }}>
        <CircularProgress size={20} /> Loading your workspace…
      </Box>
    );
  }

  const { stats } = overview;
  const maxDay = Math.max(1, ...overview.changesPerDay.map((d) => d.count));
  const totalTrend = overview.changesPerDay.reduce((sum, d) => sum + d.count, 0);

  const statCards = [
    {
      icon: BusinessIcon,
      iconBg: "rgba(94, 106, 210, 0.14)",
      iconColor: "#4f46e5",
      value: stats.competitors,
      label: "Competitors",
      sub: `${stats.monitoringEnabled} monitoring · ${stats.monitoringPaused} paused`,
    },
    {
      icon: ActivityIcon,
      iconBg: "rgba(94, 106, 210, 0.14)",
      iconColor: "#4f46e5",
      value: stats.changesLast7Days,
      label: "Changes · last 7 days",
      sub: `${stats.changes} total · ${stats.snapshots} snapshots`,
    },
    {
      icon: WarningIcon,
      iconBg: "rgba(220, 38, 38, 0.10)",
      iconColor: "#dc2626",
      value: stats.highChangesLast7Days,
      label: "High priority · last 7 days",
      sub: "Price rises, removed plans, bad reviews",
      valueColor: "#b91c1c",
    },
    {
      icon: StyleIcon,
      iconBg: "rgba(94, 106, 210, 0.14)",
      iconColor: "#4f46e5",
      value: stats.battlecards,
      label: "Battlecards",
      sub: `${stats.analyses} AI analyses`,
    },
  ];

  return (
    <Box>
      <PageHeader
        eyebrow={user.organization.name}
        title={`Welcome, ${user.name}`}
        description={`Signed in as ${user.email} · Role: ${user.role}`}
        actions={
          <Button variant="contained" component={Link} href="/competitors/new" startIcon={<AddIcon />}>
            Add competitor
          </Button>
        }
      />

      {/* Stat cards — real counts, nothing faked. */}
      <Grid container spacing={2.5} sx={{ mt: 3 }} component={motion.div} variants={staggerParent} initial="hidden" animate="show">
        {statCards.map(({ icon: Icon, iconBg, iconColor, value, label, sub, valueColor }) => (
          <Grid key={label} size={{ xs: 12, sm: 6, xl: 3 }} component={motion.div} variants={fadeUp} whileHover={{ y: -4 }}>
            <Card sx={{ height: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, p: 2.5 }}>
                <Box>
                  <Typography variant="h4" sx={{ color: valueColor ?? "text.primary" }}><AnimatedNumber value={value} /></Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>{label}</Typography>
                  <Typography variant="caption" color="text.secondary">{sub}</Typography>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    height: 40,
                    width: 40,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 2,
                    background: iconBg,
                    color: iconColor,
                  }}
                >
                  <Icon />
                </Box>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Changes over time — 14-day bar chart, plain divs, no chart library. */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}>
      <Card sx={{ mt: 3 }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="h6">Changes over time</Typography>
            <Typography variant="body2" color="text.secondary">
              Detected changes per day, last 14 days · {totalTrend} total
            </Typography>
          </Box>
          {totalTrend === 0 ? (
            <EmptyState
              icon={<ActivityIcon />}
              title="No changes in the last 14 days"
              description="Scan a competitor to start tracking — the first scan sets the baseline, the next one shows what moved."
              action={
                <Button variant="contained" component={Link} href="/competitors" endIcon={<ArrowRightIcon />}>
                  Go to competitors
                </Button>
              }
            />
          ) : (
            <Box sx={{ mt: 3, display: "flex", alignItems: "flex-end", gap: 0.75, borderBottom: "1px solid rgba(17,24,39,0.08)", pb: 0.5, height: 140 }}>
              {overview.changesPerDay.map((d) => (
                <Box
                  key={d.date}
                  title={`${d.date}: ${d.count} change${d.count === 1 ? "" : "s"}`}
                  sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 0.5, minWidth: 0 }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{d.count > 0 ? d.count : ""}</Typography>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(d.count === 0 ? 3 : (d.count / maxDay) * 96, 3)}px` }}
                    transition={{ delay: 0.3 + overview.changesPerDay.indexOf(d) * 0.03, duration: 0.5, ease: "easeOut" }}
                    style={{
                      width: "100%",
                      maxWidth: 32,
                      borderRadius: "6px 6px 0 0",
                      background: "linear-gradient(180deg, #818cf8 0%, #5e6ad2 100%)",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">{d.date.slice(5)}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Card>
      </motion.div>

      {/* Most active competitors + recent price moves. */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.45, ease: "easeOut" }}>
      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ mt: 2.5, height: "calc(100% - 20px)" }}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6">Most active competitors</Typography>
              {overview.topCompetitors.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  No changes detected yet.
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, mt: 1, p: 0, listStyle: "none" }}>
                  {overview.topCompetitors.map((c) => (
                    <Box
                      key={c.competitorId}
                      component="li"
                      sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1.5, borderBottom: "1px solid rgba(17,24,39,0.06)", "&:last-child": { borderBottom: "none", pb: 0 } }}
                    >
                      <LinkMui component={Link} href={`/competitors/${c.competitorId}`} sx={{ fontWeight: 600 }}>
                        {c.competitorName ?? c.competitorId}
                      </LinkMui>
                      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {c.changeCount} change{c.changeCount === 1 ? "" : "s"} ·{" "}
                        {new Date(c.latestChangeAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ mt: 2.5, height: "calc(100% - 20px)" }}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6">Recent price moves</Typography>
              {overview.priceMoves.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  No price moves detected yet.
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, mt: 1, p: 0, listStyle: "none" }}>
                  {overview.priceMoves.map((m) => (
                    <Box
                      key={m.id}
                      component="li"
                      sx={{ py: 1.5, borderBottom: "1px solid rgba(17,24,39,0.06)", "&:last-child": { borderBottom: "none", pb: 0 } }}
                    >
                      <Typography variant="body2">
                        <Badge tone={m.category === "price_increase" ? "red" : "green"}>{categoryLabel(m.category)}</Badge>{" "}
                        <Typography component="span" sx={{ fontWeight: 600 }}>{m.title}</Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {m.competitorName} · {new Date(m.detectedAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>
      </motion.div>

      {/* Recent activity. */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.45, ease: "easeOut" }}>
      <Card sx={{ mt: 3 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6">Recent activity</Typography>
          {overview.recentChanges.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Nothing yet — changes appear here after a scan finds something different.
            </Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, mt: 1, p: 0, listStyle: "none" }}>
              {overview.recentChanges.map((c) => (
                <Box
                  key={c.id}
                  component="li"
                  sx={{ py: 1.5, borderBottom: "1px solid rgba(17,24,39,0.06)", "&:last-child": { borderBottom: "none", pb: 0 } }}
                >
                  <Typography variant="body2">
                    <Badge tone={c.significance === "high" ? "red" : c.significance === "medium" ? "amber" : "neutral"}>
                      {categoryLabel(c.category)}
                    </Badge>{" "}
                    {c.title}{" "}
                    <Typography component="span" color="text.secondary">
                      — {c.competitorName} · {new Date(c.detectedAt).toLocaleString()}
                    </Typography>
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          <Box sx={{ mt: 2 }}>
            <LinkMui component={Link} href="/intelligence" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
              View the full intelligence feed <ArrowRightIcon sx={{ fontSize: 16 }} />
            </LinkMui>
          </Box>
        </Box>
      </Card>
      </motion.div>

      {/* Scan health — when each competitor was last scanned, and whether it worked. */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.45, ease: "easeOut" }}>
      <Card sx={{ mt: 3 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6">Scan health</Typography>
          {overview.scanHealth.length === 0 ? (
            <EmptyState
              icon={<BusinessIcon />}
              title="No competitors yet"
              description="Add your first competitor and scan it to start tracking."
              action={
                <Button variant="contained" component={Link} href="/competitors/new" startIcon={<AddIcon />}>
                  Add competitor
                </Button>
              }
            />
          ) : (
            <TableContainer sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Competitor</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Monitoring</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Last scan</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Snapshots</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview.scanHealth.map((row) => (
                    <TableRow key={row.competitorId}>
                      <TableCell>
                        <LinkMui component={Link} href={`/competitors/${row.competitorId}`} sx={{ fontWeight: 600 }}>
                          {row.competitorName}
                        </LinkMui>
                      </TableCell>
                      <TableCell>
                        {row.monitoringEnabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="neutral">Paused</Badge>}
                      </TableCell>
                      <TableCell>
                        {row.lastScanAt ? new Date(row.lastScanAt).toLocaleString() : "Never scanned"}
                      </TableCell>
                      <TableCell>
                        {row.lastScanStatus === "success" ? (
                          <Badge tone="green">Success</Badge>
                        ) : row.lastScanStatus === "blocked" ? (
                          <Badge tone="amber">Blocked</Badge>
                        ) : row.lastScanStatus === "failed" ? (
                          <Badge tone="red">Failed</Badge>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{row.totalSnapshots}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.45, ease: "easeOut" }}>
      <Card sx={{ mt: 3 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="body2">
            Everything above is live data from your workspace — nothing is faked or sampled.{" "}
            <LinkMui component={Link} href="/competitors" sx={{ fontWeight: 600 }}>
              Manage competitors →
            </LinkMui>{" "}
            <LinkMui component={Link} href="/battlecards" sx={{ fontWeight: 600, ml: 1.5 }}>
              View battlecards →
            </LinkMui>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Scans also run in the background on each competitor&apos;s schedule — you don&apos;t have to press Scan now by hand.
          </Typography>
        </Box>
      </Card>
      </motion.div>
    </Box>
  );
}
