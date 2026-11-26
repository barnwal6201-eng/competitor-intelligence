import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";
import { Badge } from "@/components/ui";
import { motion } from "framer-motion";
import { fadeUp } from "@/components/Motion";
import type { ChangeEvent } from "@/types";

// Shared change card (Phase 5): one detected change, used by the
// intelligence feed and by the competitor detail page. Glass card with a
// significance accent bar on the left.

export function categoryLabel(category: ChangeEvent["category"]): string {
  return (
    {
      price_increase: "Price increase",
      price_decrease: "Price decrease",
      plan_added: "Plan added",
      plan_removed: "Plan removed",
      entry_added: "New changelog entry",
      entry_removed: "Changelog entry removed",
      job_posted: "New job",
      job_removed: "Job removed",
      review_added: "New review",
      negative_review: "Negative review",
    } as Record<ChangeEvent["category"], string>
  )[category];
}

export function sourceLabel(type: ChangeEvent["sourceType"]): string {
  return {
    pricing: "Pricing",
    changelog: "Changelog",
    careers: "Careers",
    reviews: "Reviews",
  }[type];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function ChangeCard({
  change,
  showCompetitor,
  notionConnected,
  salesforceConnected,
  pushing,
  onPush,
}: {
  change: ChangeEvent;
  showCompetitor?: boolean;
  notionConnected?: boolean;
  salesforceConnected?: boolean;
  pushing?: boolean;
  onPush?: (provider: "notion" | "salesforce") => void;
}) {
  const prev = formatValue(change.previousValue);
  const next = formatValue(change.newValue);
  const showValues = prev !== "" || next !== "";
  const accent =
    change.significance === "high"
      ? "#ef4444"
      : change.significance === "medium"
        ? "#f59e0b"
        : "rgba(100, 116, 139, 0.5)";
  return (
    <Card
      component={motion.li}
      variants={fadeUp}
      whileHover={{ y: -3 }}
      sx={{ borderLeft: `4px solid ${accent}`, listStyle: "none" }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          p: 2.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Badge
              tone={
                change.significance === "high"
                  ? "red"
                  : change.significance === "medium"
                    ? "amber"
                    : "neutral"
              }
            >
              {change.significance === "high"
                ? "High"
                : change.significance === "medium"
                  ? "Medium"
                  : "Low"}
            </Badge>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {categoryLabel(change.category)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              · {sourceLabel(change.sourceType)}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{ mt: 1, fontWeight: 500, lineHeight: 1.6 }}
          >
            {change.title}
          </Typography>
          {showValues && (
            <Box
              sx={{
                mt: 1,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 0.75,
              }}
            >
              <Chip
                label={prev !== "" ? prev : "—"}
                size="small"
                sx={{ background: "rgba(100,116,139,0.12)" }}
              />
              <ArrowForwardIcon
                sx={{ fontSize: 16, color: "text.secondary" }}
              />
              <Chip
                label={next !== "" ? next : "—"}
                size="small"
                color="primary"
                sx={{ background: "rgba(94,106,210,0.14)", color: "#4f46e5" }}
              />
            </Box>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1 }}
          >
            {new Date(change.detectedAt).toLocaleString()}
            {showCompetitor && change.competitorName ? (
              <>
                {" · "}
                <MuiLink
                  component={Link}
                  href={`/competitors/${change.competitorId}`}
                  sx={{ fontWeight: 600 }}
                >
                  {change.competitorName}
                </MuiLink>
              </>
            ) : null}
          </Typography>
          {onPush && (notionConnected || salesforceConnected) ? (
            <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
              {notionConnected ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onPush("notion")}
                  disabled={pushing}
                  startIcon={
                    pushing ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : undefined
                  }
                >
                  {pushing ? "Pushing…" : "Send to Notion"}
                </Button>
              ) : null}
              {salesforceConnected ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onPush("salesforce")}
                  disabled={pushing}
                  startIcon={
                    pushing ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : undefined
                  }
                >
                  {pushing ? "Pushing…" : "Send to Salesforce"}
                </Button>
              ) : null}
            </Box>
          ) : null}
        </Box>
        <MuiLink
          href={change.sourceUrl}
          target="_blank"
          rel="noreferrer"
          sx={{
            display: "inline-flex",
            flexShrink: 0,
            alignItems: "center",
            gap: 0.5,
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          Source <OpenInNewIcon sx={{ fontSize: 14 }} />
        </MuiLink>
      </Box>
    </Card>
  );
}
