import { ReactNode } from "react";

type Tone = "neutral" | "red";

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  const toneClass: Record<Tone, string> = {
    neutral: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset bg-slate-100 text-slate-600",
    red: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-600 ring-red-200",
  };

  const baseClass = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  const finalClass = `${baseClass} ${toneClass[tone]} ${className || ""}`.trim();

  return <span className={finalClass}>{children}</span>;
}