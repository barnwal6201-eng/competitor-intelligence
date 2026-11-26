import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { categoryLabel } from "@/components/ChangeCard";
import { Badge } from "@/components/ui";
import type { Battlecard, ChangeCategory } from "@/types";

// Shared battlecard renderer (Phase 7): the 12 sections from PRD section
// 12, in order. Used for the live battlecard and for frozen old versions
// (a version's stored content has the same shape). Sections that came
// from AI carry an "AI-generated" tag; the rest are verified data from
// scans and are labelled as such once, in the legend at the top.

export type BattlecardContent = Pick<
  Battlecard,
  | "overview"
  | "positioning"
  | "pricing"
  | "pricingSourceUrl"
  | "pricingSnapshotDate"
  | "features"
  | "strengths"
  | "weaknesses"
  | "recentChanges"
  | "complaints"
  | "talkingPoints"
  | "objectionHandling"
  | "sources"
  | "aiSections"
> & { version?: number; updatedAt?: string; generatedAt?: string };

function sourceLabelFor(category: ChangeCategory): string {
  if (category.startsWith("price_") || category.startsWith("plan_")) return "Pricing";
  if (category.startsWith("entry_")) return "Changelog";
  if (category.startsWith("job_")) return "Careers";
  return "Reviews";
}

function Section({
  title,
  ai,
  children,
}: {
  title: string;
  ai?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box component="section" sx={{ mt: 3.5, "&:first-of-type": { mt: 0 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid rgba(17,24,39,0.08)", pb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {ai && <Badge tone="amber">AI-generated</Badge>}
      </Box>
      <Box sx={{ mt: 1.5 }}>{children}</Box>
    </Box>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <Typography variant="body2" color="text.secondary">{empty}</Typography>;
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, "& li": { mb: 0.75, lineHeight: 1.6 } }}>
      {items.map((item, i) => (
        <Typography key={i} component="li" variant="body2">
          {item}
        </Typography>
      ))}
    </Box>
  );
}

export default function BattlecardView({ content }: { content: BattlecardContent }) {
  const isAi = (section: string) => content.aiSections.includes(section);
  const updated = content.updatedAt || content.generatedAt;
  return (
    <Box id="battlecard-print">
      {content.version !== undefined && (
        <Typography variant="body2" color="text.secondary">
          Version {content.version}
          {updated ? ` · Last updated ${new Date(updated).toLocaleString()}` : ""}
        </Typography>
      )}
      <Alert severity="warning" sx={{ mt: 2 }}>
        Sections marked AI-generated come from the latest OpenAI analysis — verify them before a sales call.
        Everything else is verified data from scans.
      </Alert>

      <Box sx={{ mt: 3 }}>
        <Section title="Overview">
          <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{content.overview}</Typography>
        </Section>

        <Section title="Positioning" ai={isAi("positioning")}>
          <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{content.positioning}</Typography>
        </Section>

        <Section title="Pricing">
          {content.pricing.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No pricing data captured yet — scan the competitor first.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Plan</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Price</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Billing</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {content.pricing.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                      <TableCell>{p.raw}</TableCell>
                      <TableCell>{p.interval}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {content.pricingSourceUrl && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Source:{" "}
              <Link href={content.pricingSourceUrl} target="_blank" rel="noreferrer" sx={{ fontWeight: 600 }}>
                {content.pricingSourceUrl}
              </Link>
              {content.pricingSnapshotDate ? ` · captured ${new Date(content.pricingSnapshotDate).toLocaleString()}` : ""}
            </Typography>
          )}
        </Section>

        <Section title="Product features">
          {content.features.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No changelog entries captured yet.</Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, pl: 2.5, "& li": { mb: 0.75, lineHeight: 1.6 } }}>
              {content.features.map((f, i) => (
                <Typography key={i} component="li" variant="body2">
                  {f.title}
                  {f.date ? <Typography component="span" color="text.secondary"> ({f.date})</Typography> : null}
                </Typography>
              ))}
            </Box>
          )}
        </Section>

        <Section title="Strengths" ai={isAi("strengths")}>
          <BulletList items={content.strengths} empty="No AI analysis yet — run Analyse latest changes on the competitor page, then Regenerate." />
        </Section>

        <Section title="Weaknesses" ai={isAi("weaknesses")}>
          <BulletList items={content.weaknesses} empty="No AI analysis yet — run Analyse latest changes on the competitor page, then Regenerate." />
        </Section>

        <Section title="Recent changes">
          {content.recentChanges.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No changes detected yet.</Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", "& li": { mb: 1.5 } }}>
              {content.recentChanges.map((c, i) => (
                <Typography key={i} component="li" variant="body2" sx={{ lineHeight: 1.6 }}>
                  <Badge tone={c.significance === "high" ? "red" : c.significance === "medium" ? "amber" : "neutral"}>
                    {categoryLabel(c.category)}
                  </Badge>{" "}
                  {sourceLabelFor(c.category)}, {c.title}{" "}
                  <Typography component="span" color="text.secondary">({new Date(c.detectedAt).toLocaleString()})</Typography>{" "}
                  <Link href={c.sourceUrl} target="_blank" rel="noreferrer" sx={{ fontWeight: 600 }}>
                    Source ↗
                  </Link>
                </Typography>
              ))}
            </Box>
          )}
        </Section>

        <Section title="Customer complaints">
          {content.complaints.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No negative reviews (2 stars or below) in the latest snapshot.</Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {content.complaints.map((c, i) => (
                <Paper key={i} elevation={0} sx={{ p: 1.5, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.6, color: "#991b1b" }}>
                    “{c.text}”{c.rating !== null ? ` — ${c.rating}/5` : ""}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </Section>

        <Section title="Talking points" ai={isAi("talkingPoints")}>
          <BulletList items={content.talkingPoints} empty="No AI analysis yet — run Analyse latest changes on the competitor page, then Regenerate." />
        </Section>

        <Section title="Objection handling" ai={isAi("objectionHandling")}>
          <BulletList items={content.objectionHandling} empty="No AI analysis yet — run Analyse latest changes on the competitor page, then Regenerate." />
        </Section>

        <Section title="Sources">
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", "& li": { mb: 0.75 } }}>
            {content.sources.map((s) => (
              <Typography key={s.url} component="li" variant="body2">
                <Typography component="span" sx={{ fontWeight: 600 }}>{s.label}:</Typography>{" "}
                <Link href={s.url} target="_blank" rel="noreferrer" sx={{ fontWeight: 600, wordBreak: "break-all" }}>
                  {s.url}
                </Link>
              </Typography>
            ))}
          </Box>
        </Section>
      </Box>
    </Box>
  );
}
