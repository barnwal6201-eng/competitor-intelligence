import { ReactNode } from "react";
import { ScanLine, Activity, Server, CheckCircle2 } from "lucide-react";

type IconMap = Record<string, React.ComponentType<{ className?: string }>>;

const iconMap: IconMap = {
  scanning: ScanLine,
  activity: Activity,
  server: Server,
  check: CheckCircle2,
};

export function IconChip({
  className,
  iconName = "scanning",
}: {
  className?: string;
  iconName?: keyof IconMap;
}) {
  const Icon = iconMap[iconName];
  if (!Icon) throw new Error(`Unknown icon name: ${iconName}`);

  return (
    <span
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--chip-bg,_#EEF0FF)] text-indigo-600 shadow-sm ${className}"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}