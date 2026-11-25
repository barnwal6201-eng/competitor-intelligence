import { HowItWorksStep } from "./types";

const steps: HowItWorksStep[] = [
  {
    title: "Watch",
    description:
      "We scan pricing pages, changelogs, job listings, and reviews on a schedule you set.",
  },
  {
    title: "Detect changes",
    description:
      "Every new snapshot is compared with the last one. Price moves, new plans, and negative reviews are ranked by significance.",
  },
  {
    title: "Get battlecards",
    description:
      "One battlecard per competitor, built from your real scans — pricing, features, complaints, and talking points.",
  },
];

export function HowItWorks() {
  return (
    <section className="mt-8 max-w-4xl mx-auto">
      {steps.map((step, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-indigo-100/80 shadow-[0_8px_30px_rgba(79,70,229,0.08)] p-8 flex items-start gap-4 hover:shadow-[0_12px_40px_rgba(79,70,229,0.12)] transition-shadow"
        >
          <span className="text-4xl font-bold text-indigo-600">{i + 1}</span>
          <div>
            <h3 className="font-medium text-slate-900 mt-1">{step.title}</h3>
            <p className="text-slate-500">{step.description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}