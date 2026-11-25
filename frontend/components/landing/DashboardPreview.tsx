import { StatCardProps, DashboardStats, PriceMove } from "./types";
import { Badge } from "./Badge";

export function DashboardPreview() {
  const stats: DashboardStats = {
    competitors: "1,234",
    changesLast7Days: "89",
    highPriority: "12",
    battlecards: "47",
  };

  const priceMoves: PriceMove[] = [
    {
      competitorName: "Acme Corp",
      title: "Enterprise plan price increase",
      category: "price_increase",
      detectedAt: "2 days ago",
    },
    {
      competitorName: "TechFlow",
      title: "Pro plan price decrease",
      category: "price_decrease",
      detectedAt: "5 days ago",
    },
  ];

  return (
    <section className="mt-12 bg-white rounded-2xl border border-indigo-100/80 shadow-[0_8px_30px_rgba(79,70,229,0.08)] overflow-hidden max-w-2xl mx-auto">
      {/* Stat cards row */}
      <div className="grid grid-cols-4 px-6 py-4 border-b border-slate-200/50">
        <StatCard label="Competitors" value={stats.competitors} />
        <StatCard label="Changes · last 7d" value={stats.changesLast7Days} />
        <StatCard label="High priority" value={stats.highPriority} />
        <StatCard label="Battlecards" value={stats.battlecards} />
      </div>

      {/* Changes over time bar chart */}
      <div className="h-24 bg-slate-50 px-6 pt-4">
        <div className="h-full bg-indigo-500 rounded-t-md w-3/4" style={{ width: "75%" }}></div>
      </div>

      {/* Recent price moves */}
      <div className="p-6 pt-0 border-t border-indigo-100/50">
        <p className="text-sm font-medium text-slate-600">Recent price moves</p>
        {priceMoves.map((move, i) => (
          <div key={i} className="mt-2 flex items-center gap-2">
            <span className="font-medium text-slate-900">{move.competitorName}</span>
            <Badge tone="red" className="ml-auto">
              {move.category === "price_increase" ? "Price increase" : "Price decrease"}
            </Badge>
          </div>
        ))}
        <p className="mt-2 text-xs text-slate-500">{priceMoves[0].detectedAt}</p>
      </div>
    </section>
  );
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}