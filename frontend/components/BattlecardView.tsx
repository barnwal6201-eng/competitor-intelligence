import { categoryLabel } from "@/components/ChangeCard";
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
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        {title}
        {ai && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            AI-generated
          </span>
        )}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
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
        <p className="text-sm text-neutral-500">
          Version {content.version}
          {updated ? ` · Last updated ${new Date(updated).toLocaleString()}` : ""}
        </p>
      )}
      <p className="mt-1 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
        Sections marked AI-generated come from the latest OpenAI analysis —
        verify them before a sales call. Everything else is verified data
        from scans.
      </p>

      <Section title="Overview">
        <p className="text-sm leading-relaxed text-neutral-700">{content.overview}</p>
      </Section>

      <Section title="Positioning" ai={isAi("positioning")}>
        <p className="text-sm leading-relaxed text-neutral-700">{content.positioning}</p>
      </Section>

      <Section title="Pricing">
        {content.pricing.length === 0 ? (
          <p className="text-sm text-neutral-500">No pricing data captured yet — scan the competitor first.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-1 pr-2 font-medium">Plan</th>
                <th className="py-1 pr-2 font-medium">Price</th>
                <th className="py-1 font-medium">Billing</th>
              </tr>
            </thead>
            <tbody>
              {content.pricing.map((p) => (
                <tr key={p.name} className="border-b border-neutral-100">
                  <td className="py-1 pr-2 font-medium">{p.name}</td>
                  <td className="py-1 pr-2">{p.raw}</td>
                  <td className="py-1 text-neutral-600">{p.interval}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {content.pricingSourceUrl && (
          <p className="mt-2 text-sm text-neutral-500">
            Source:{" "}
            <a href={content.pricingSourceUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
              {content.pricingSourceUrl}
            </a>
            {content.pricingSnapshotDate ? ` · captured ${new Date(content.pricingSnapshotDate).toLocaleString()}` : ""}
          </p>
        )}
      </Section>

      <Section title="Product features">
        {content.features.length === 0 ? (
          <p className="text-sm text-neutral-500">No changelog entries captured yet.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {content.features.map((f, i) => (
              <li key={i}>
                {f.title}
                {f.date ? <span className="text-neutral-500"> ({f.date})</span> : null}
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
          <p className="text-sm text-neutral-500">No changes detected yet.</p>
        ) : (
          <ul className="space-y-2">
            {content.recentChanges.map((c, i) => (
              <li key={i} className="text-sm text-neutral-700">
                <span className="font-medium">{categoryLabel(c.category)}</span> · {sourceLabelFor(c.category)},{" "}
                {c.title} <span className="text-neutral-500">({new Date(c.detectedAt).toLocaleString()})</span>{" "}
                <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                  Source ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Customer complaints">
        {content.complaints.length === 0 ? (
          <p className="text-sm text-neutral-500">No negative reviews (2 stars or below) in the latest snapshot.</p>
        ) : (
          <ul className="space-y-2">
            {content.complaints.map((c, i) => (
              <li key={i} className="rounded-md bg-red-50 p-3 text-sm text-red-800">
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
        <ul className="space-y-1 text-sm">
          {content.sources.map((s) => (
            <li key={s.url}>
              <span className="font-medium text-neutral-700">{s.label}:</span>{" "}
              <a href={s.url} target="_blank" rel="noreferrer" className="break-all text-indigo-700 hover:underline">
                {s.url}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
