import { ReactNode } from "react";

export type Tone = "neutral" | "red";

export interface IconChipProps {
  className?: string;
}

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

export interface BtnPrimaryProps {
  children: ReactNode;
  href?: string;
  className?: string;
}

export interface BtnSecondaryProps {
  children: ReactNode;
  href?: string;
  className?: string;
}

export interface NavbarProps {
  signInLabel?: string;
  getStartedLabel?: string;
}

export interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export interface HowItWorksStep {
  title: string;
  description: string;
}

export interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
}

export interface StatCardProps {
  label: string;
  value: string | number;
}

export interface DashboardStats {
  competitors: string;
  changesLast7Days: string;
  highPriority: string;
  battlecards: string;
}

export interface PriceMove {
  competitorName: string;
  title: string;
  category: "price_increase" | "price_decrease";
  detectedAt: string;
}