"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CompetitorForm from "../CompetitorForm";
import { createCompetitor } from "@/services/competitors";
import type { CompetitorInput } from "@/types";

export default function NewCompetitorPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  async function onSubmit(data: CompetitorInput) {
    setServerError("");
    try {
      await createCompetitor(data);
      router.push("/competitors");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not add competitor");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-indigo-700">
        <Link href="/competitors" className="hover:underline">← Competitors</Link>
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Add a competitor</h1>
      <p className="mt-2 text-neutral-600">
        It is saved under your organization only — no other organization can see it.
      </p>
      <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-6">
        <CompetitorForm submitLabel="Add competitor" serverError={serverError} onSubmit={onSubmit} />
      </div>
    </main>
  );
}
