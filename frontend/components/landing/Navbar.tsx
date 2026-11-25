"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine } from "lucide-react";
import { Badge } from "./Badge";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-white/90 border-b border-slate-200/50"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-medium text-indigo-600">
            <ScanLine className="h-6 w-6" />
          </span>
          <span className="font-medium text-slate-900">
            Competitor Intelligence / Scraper & Battlecard Agent
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
          >
            Sign in
          </Link>
          <Link href="/register">
            <Badge tone="red">Get started</Badge>
          </Link>
        </div>
      </div>
    </nav>
  );
}