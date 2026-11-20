import { Activity, Radar, ScanLine, Swords } from "lucide-react";

// Phase 12 auth shell: a brand panel on the left (desktop) and the
// sign-in / register card on the right. The panel states only what the
// product really does — no invented numbers or customers.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-[420px] shrink-0 flex-col justify-between bg-slate-900 px-10 py-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Radar className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-tight">Competitor Intelligence</span>
              <span className="block text-xs text-slate-400">Scraper &amp; Battlecard Agent</span>
            </span>
          </div>
          <h1 className="mt-14 text-3xl font-semibold leading-snug tracking-tight">
            Know what your competitors changed — before your next sales call.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Watch pricing pages, changelogs, job listings, and reviews. Every
            change is detected against the last snapshot and written into a
            battlecard your team can actually use.
          </p>
          <ul className="mt-10 space-y-5 text-sm">
            <li className="flex gap-3">
              <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
              <span>
                <span className="font-medium text-white">Scheduled scans.</span>{" "}
                <span className="text-slate-400">Pricing, changelog, careers, and review pages checked on your schedule.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <Activity className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
              <span>
                <span className="font-medium text-white">Change detection.</span>{" "}
                <span className="text-slate-400">Price moves, new plans, new features, and bad reviews — ranked by significance.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <Swords className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
              <span>
                <span className="font-medium text-white">Battlecards.</span>{" "}
                <span className="text-slate-400">Verified data from scans, with AI analysis clearly labelled — never invented.</span>
              </span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          Every number in the product comes from your own scans. Nothing is faked or sampled.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Radar className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold tracking-tight text-slate-900">Competitor Intelligence</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
