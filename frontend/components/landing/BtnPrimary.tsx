import { ReactNode } from "react";
import Link from "next/link";

export function BtnPrimary({ children, href, className }: { children: ReactNode; href?: string; className?: string }) {
  const baseClass = "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all disabled:cursor-not-allowed disabled:opacity-50";

  if (href) {
    return (
      <Link href={href} className={`${baseClass} ${className ?? ""}`} target="_blank" rel="noreferrer">
        {children}
      </Link>
    );
  }

  return <button className={`${baseClass} ${className ?? ""}`}>{children}</button>;
}