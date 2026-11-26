// Shared design-system pieces — MUI glassmorphic version. Same export
// names as the Phase 12 Tailwind version, so pages keep their structure;
// only the rendering changed. Every component is presentation-only: no
// data fetching, no mock content, no invented numbers.

import Link from "next/link";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CardMui from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";

type Tone = "neutral" | "green" | "red" | "amber" | "indigo" | "slate";

const toneColor: Record<Tone, "default" | "success" | "error" | "warning" | "primary" | "info"> = {
  neutral: "default",
  green: "success",
  red: "error",
  amber: "warning",
  indigo: "primary",
  slate: "default",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <Chip
      label={children}
      color={toneColor[tone]}
      size="small"
      sx={{
        fontWeight: 600,
        backgroundColor:
          tone === "indigo"
            ? "rgba(94, 106, 210, 0.14)"
            : tone === "green"
              ? "rgba(5, 150, 105, 0.12)"
              : tone === "red"
                ? "rgba(220, 38, 38, 0.10)"
                : tone === "amber"
                  ? "rgba(217, 119, 6, 0.12)"
                  : "rgba(100, 116, 139, 0.14)",
        color:
          tone === "indigo"
            ? "#4f46e5"
            : tone === "green"
              ? "#047857"
              : tone === "red"
                ? "#b91c1c"
                : tone === "amber"
                  ? "#b45309"
                  : "#475569",
      }}
    />
  );
}

// Glass card — the MUI Card already carries the glass look from the
// theme. Pages add their own inner padding (usually a Box with p: 3),
// so this wrapper adds none. `disablePadding` is kept for compatibility
// with pages that pass it; it changes nothing.
export function Card({
  children,
  sx,
}: {
  children: ReactNode;
  sx?: object;
  disablePadding?: boolean;
}) {
  return <CardMui sx={{ ...sx }}>{children}</CardMui>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h4" component="h1" sx={{ mt: 0.5, fontSize: { xs: "1.6rem", sm: "2rem" } }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 640 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {actions ? (
        <Box sx={{ display: "flex", flexShrink: 0, flexWrap: "wrap", gap: 1 }}>{actions}</Box>
      ) : null}
    </Box>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", px: 3, py: 5, textAlign: "center" }}>
      {icon ? (
        <Box
          sx={{
            display: "flex",
            height: 44,
            width: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: "rgba(94, 106, 210, 0.12)",
            color: "primary.main",
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 600 }}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 440 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 2 }}>{action}</Box> : null}
    </Box>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <MuiLink component={Link} href={href} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.875rem", fontWeight: 600 }}>
      {children}
    </MuiLink>
  );
}

// Convenience re-export so pages can use MUI buttons without importing
// from @mui/material every time.
export { Button };
