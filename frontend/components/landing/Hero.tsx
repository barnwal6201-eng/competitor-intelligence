import Link from "next/link";

export function Hero() {
  return (
    <section className="pt-24 md:pt-32 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <p className="mb-6 text-xs font-medium uppercase tracking-wider text-indigo-600">
          THE SALES TEAM'S COMPETITIVE EDGE
        </p>

        <h1 className="mt-3 text-[clamp(2.5rem,5.5vw,4.25rem)] leading-[1.08] text-[var(--text,#0F172A)] whitespace-nowrap sm:break-words">
          Know what your competitors changed — <span className="bg-indigo-600/20 to-indigo-500/50 bg-clip-text text-gradient">before your next</span><span className="bg-indigo-600/20 to-violet-500/50 bg-clip-text text-transparent">sales call</span>.
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-slate-600 max-w-2xl mx-auto">
          Watch pricing pages, changelogs, job listings, and reviews across your competitive landscape. Changes are detected against the last snapshot and written into battlecards your team can actually use.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register" className="btnPrimary">
            Create your workspace →
          </Link>
          <Link href="/dashboard" className="btnSecondary">
            Open dashboard →
          </Link>
        </div>
      </div>
    </section>
  );
}