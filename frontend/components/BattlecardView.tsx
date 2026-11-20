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
    <section className="mt-7 first:mt-0">
      <h2 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-base font-semibold text-slate-900">
        {title}
        {ai && <Badge tone="amber">AI-generated</Badge>}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function BattlecardView({ content }: { content: BattlecardContent }) {
  const isAi = (section: string) => content.aiSections.includes(section);
  const updated = content.updatedAt || content.generatedAt;
  return (
    <div id="battlecard-print">
      {content.version !== undefined && (
        <p className="text-sm text-slate-500">
          Version {content.version}
          {updated ? ` · Last updated ${new Date(updated).toLocaleString()}` : ""}
        </p>
      )}
      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-800">
        Sections marked AI-generated come from the latest OpenAI analysis —
        verify them before a sales call. Everything else is verified data
        from scans.
      </p>

      <div className="mt-6">
        <Section title="Overview">
          <p className="text-sm leading-relaxed text-slate-700">{content.overview}</p>
        </Section>

        <Section title="Positioning" ai={isAi("positioning")}>
          <p className="text-sm leading-relaxed text-slate-700">{content.positioning}</p>
        </Section>

        <Section title="Pricing">
          {content.pricing.length === 0 ? (
            <p className="text-sm text-slate-500">No pricing data captured yet — scan the competitor first.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3 font-medium">Plan</th>
                    <th className="pb-2 pr-3 font-medium">Price</th>
                    <th className="pb-2 font-medium">Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {content.pricing.map((p) => (
                    <tr key={p.name} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-900">{p.name}</td>
                      <td className="py-2 pr-3 text-slate-700">{p.raw}</td>
                      <td className="py-2 text-slate-600">{p.interval}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {content.pricingSourceUrl && (
            <p className="mt-2 text-sm text-slate-500">
              Source:{" "}
              <a href={content.pricingSourceUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                {content.pricingSourceUrl}
              </a>
              {content.pricingSnapshotDate ? ` · captured ${new Date(content.pricingSnapshotDate).toLocaleString()}` : ""}
            </p>
          )}
        </Section>

        <Section title="Product features">
          {content.features.length === 0 ? (
            <p className="text-sm text-slate-500">No changelog entries captured yet.</p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
              {content.features.map((f, i) => (
                <li key={i}>
                  {f.title}
                  {f.date ? <span className="text-slate-500"> ({f.date})</span> : null}
                </li>
              ))}
            </ul>
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
            <p className="text-sm text-slate-500">No changes detected yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {content.recentChanges.map((c, i) => (
                <li key={i} className="text-sm leading-relaxed text-slate-700">
                  <Badge tone={c.significance === "high" ? "red" : c.significance === "medium" ? "amber" : "neutral"}>
                    {categoryLabel(c.category)}
                  </Badge>{" "}
                  {sourceLabelFor(c.category)}, {c.title}{" "}
                  <span className="text-slate-500">({new Date(c.detectedAt).toLocaleString()})</span>{" "}
                  <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                    Source ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Customer complaints">
          {content.complaints.length === 0 ? (
            <p className="text-sm text-slate-500">No negative reviews (2 stars or below) in the latest snapshot.</p>
          ) : (
            <ul className="space-y-2">
              {content.complaints.map((c, i) => (
                <li key={i} className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm leading-relaxed text-red-800">
                  “{c.text}”{c.rating !== null ? ` — ${c.rating}/5` : ""}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Talking points" ai={isAi("talkingPoints")}>
          <BulletList items={content.talkingPoints} empty="No AI analysis yet — run Analyse latest changes on the competitor page, then Regenerate." />
        </Section>

        <Section title="Objection handling" ai={isAi("objectionHandling")}>
          <BulletList items={content.objectionHandling} empty="No AI analysis yet — run Analyse latest changes on the competitor page, then Regenerate." />
        </Section>

        <Section title="Sources">
          <ul className="space-y-1.5 text-sm">
            {content.sources.map((s) => (
              <li key={s.url}>
                <span className="font-medium text-slate-700">{s.label}:</span>{" "}
                <a href={s.url} target="_blank" rel="noreferrer" className="break-all font-medium text-indigo-600 hover:underline">
                  {s.url}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
