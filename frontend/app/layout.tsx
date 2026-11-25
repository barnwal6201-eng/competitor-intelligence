import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// https://tailwindcss.com/docs/dark-mode#class
export const metadata = {
  title: "Competitor Intelligence — Track competitors, win deals",
  description:
    "Track competitors' pricing, changelogs, job listings, and reviews — detect what changed and keep your sales battlecards up to date.",
};

export default function RootLayout({
  children}: {
    children: React.ReactNode;
  }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} antialiased`}
    >
      <body className="bg-[var(--bg,_linear-gradient(_var(--from-lavender,_#EEF0FF),_var (_to-white,_#FFFFFF),_var(--secondary,_#FDF2F8),_var(--tertiary,_#EFF6FF)))] text-[var(--text,_#0F172A)]">
        <div>{children}</div>
      </body>
    </html>
  );
}