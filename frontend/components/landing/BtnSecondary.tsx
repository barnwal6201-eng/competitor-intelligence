import { ReactNode } from "react";
import Link from "next/link";

export function BtnSecondary({ children, href, className }: { children: ReactNode; href?: string; className?: string }) {
  const baseClass = "inline-flex items-center gap-2 rounded-lg border-2 border-indigo-600 bg-white px-6 py-3 text-sm font-medium text-indigo-600 shadow-sm hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all disabled:cursor-not-allowed disabled:opacity-50";

  if (href) {
    return (
      <Link href={href} className={`${baseClass} ${className ?? ""}`} target="_blank" rel="noreferrer">
        {children}
      </Link>
    );
  }

  return <button className={`${baseClass} ${className ?? ""}`}>{children}</button>;
}