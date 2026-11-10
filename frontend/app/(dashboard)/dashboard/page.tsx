"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser, logoutUser } from "@/services/auth";
import type { AuthUser } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {
        setError("Your session could not be verified. Please sign in again.");
        router.push("/login");
      });
  }, [router]);

  async function handleLogout() {
    await logoutUser();
    router.push("/login");
    router.refresh();
  }

  if (error) {
    return <main className="mx-auto max-w-3xl px-6 py-12"><p className="text-red-700">{error}</p></main>;
  }
  if (!user) {
    return <main className="mx-auto max-w-3xl px-6 py-12"><p className="text-neutral-600">Loading your workspace…</p></main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-700">{user.organization.name}</p>
          <h1 className="mt-1 text-3xl font-semibold">Welcome, {user.name}</h1>
          <p className="mt-2 text-neutral-600">
            Signed in as {user.email} · Role: {user.role}
          </p>
        </div>
        <button onClick={handleLogout} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium">
          Sign out
        </button>
      </div>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-medium">Your workspace is ready</h2>
        <p className="mt-2 text-neutral-700">
          Authentication (Phase 2) is complete: your account, your organization, and this
          protected page are all verified against the backend. Scraping (Phase 4) is
          live too — open a competitor and press Scan now to snapshot its pages.
          Change detection (Phase 5) compares each new snapshot with the last one
          and lists what moved. Battlecards come in the next phases — nothing is
          faked here.
        </p>
        <p className="mt-3">
          <Link href="/competitors" className="font-medium text-indigo-700 hover:underline">
            Manage your competitors →
          </Link>
        </p>
        <p className="mt-2">
          <Link href="/intelligence" className="font-medium text-indigo-700 hover:underline">
            View the intelligence feed →
          </Link>
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          Next: Phase 6 — AI analysis of the detected changes
          for {user.organization.name}.
        </p>
      </section>
    </main>
  );
}
