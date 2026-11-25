import { StatCardProps } from "./types";

export function StatsRow() {
  const stats = [
    {
      number: "200+",
      label: "teams trust Competitor Intelligence",
      description: "to keep their battlecards current",
    },
    {
      number: "15+",
      label: "countries represented",
      description: "across our customer base",
    },
  ];

  return (
    <section className="mt-8 grid grid-cols-2 gap-6 max-w-6xl mx-auto">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-indigo-100/80 shadow-[0_8px_30px_rgba(79,70,229,0.08)] p-8 text-center hover:shadow-[0_12px_40px_rgba(79,70,229,0.12)] transition-shadow"
        >
          <p className="text-5xl font-bold text-indigo-600">{stat.number}</p>
          <p className="mt-2 text-sm font-medium uppercase tracking-wider text-indigo-600">{stat.label}</p>
          <p className="mt-1 text-slate-500">{stat.description}</p>
        </div>
      ))}
    </section>
  );
}