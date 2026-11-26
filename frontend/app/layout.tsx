import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ThemeRegistry from "@/components/ThemeRegistry";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Competitor Intelligence — Track competitors, win deals",
  description:
    "Track competitors' pricing, changelogs, job listings, and reviews — detect what changed and keep your sales battlecards up to date.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
