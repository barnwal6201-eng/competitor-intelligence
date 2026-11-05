import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Competitor Intelligence — Phase 1",
  description: "Phase 1 setup check: Next.js frontend talking to the Express backend.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
