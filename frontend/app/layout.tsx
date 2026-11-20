import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Competitor Intelligence — Track competitors, win deals",
  description:
    "Track competitors' pricing, changelogs, job listings, and reviews — detect what changed and keep your sales battlecards up to date.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
