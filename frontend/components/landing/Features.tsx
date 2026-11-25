import { Feature } from "./types";
import { ScanLine, Activity, Server, CheckCircle2 } from "lucide-react";

const features: Feature[] = [
  {
    icon: ScanLine,
    title: "Pricing pages",
    description:
      "Automated scans on a schedule you set. Track price changes, plan updates, and pricing tiers across all your competitors.",
  },
  {
    icon: Activity,
    title: "Changelogs",
    description:
      "Track feature launches, bug fixes, and product updates. Get notified when competitors ship new features.",
  },
  {
    icon: Server,
    title: "Job listings",
    description:
      "Monitor hiring trends and team growth. See when competitors are expanding or reducing their teams.",
  },
  {
    icon: CheckCircle2,
    title: "Reviews",
    description:
      "Stay on top of customer feedback. Track new reviews, ratings, and sentiment changes over time.",
  },
];

export function Features() {
  return (
    <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-7xl mx-auto">
      {features.map((feature, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-indigo-100/80 shadow-[0_8px_30px_rgba(79,70,229,0.08)] p-6 hover:shadow-[0_12px_40px_rgba(79,70,229,0.12)] transition-shadow"
        >
          <div className="h-10 w-10 rounded-lg bg-[var(--chip-bg,_#EEF0FF)] flex items-center justify-center mb-4">
            <feature.icon className="h-5 w-5 text-indigo-600" />
          </div>
          <h3 className="font-medium text-slate-900 mb-2">{feature.title}</h3>
          <p className="text-sm text-slate-500">{feature.description}</p>
        </div>
      ))}
    </section>
  );
}