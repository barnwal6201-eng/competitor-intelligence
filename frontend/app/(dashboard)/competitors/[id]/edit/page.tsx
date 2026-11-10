"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CompetitorForm from "../../CompetitorForm";
import { getCompetitor, updateCompetitor } from "@/services/competitors";
import type { Competitor, CompetitorInput } from "@/types";

// The id comes from useParams() instead of the `params` prop: in Next.js
// 15/16 `params` is a Promise and reading `.id` off it directly crashes,
// while useParams() returns the plain id on every Next.js version.
export default function EditCompetitorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [loadError, setLoadError] = useState("");
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    getCompetitor(id)
      .then(setCompetitor)
      .catch((err) => {
        if (err instanceof Error && /not signed in/i.test(err.message)) {
          router.push("/login");
          return;
        }
        setLoadError(err instanceof Error ? err.message : "Could not load competitor");
      });
  }, [id, router]);

  async function onSubmit(data: CompetitorInput) {
    setServerError("");
    try {
      await updateCompetitor(id, data);
      router.push("/competitors");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not save changes");
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
        <Link href="/competitors" className="mt-4 inline-block font-medium text-indigo-700">
          ← Back to competitors
        </Link>
      </main>
    );
  }
  if (!competitor) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-neutral-600">Loading competitor…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-indigo-700">
        <Link href="/competitors" className="hover:underline">← Competitors</Link>
      </p>
      <h1 className="mt-1 text-3xl font-semibold">Edit {competitor.companyName}</h1>
      <p className="mt-2 text-neutral-600">Changes are saved under your organization only.</p>
      <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-6">
        <CompetitorForm
          defaultValues={{
            companyName: competitor.companyName,
            websiteUrl: competitor.websiteUrl,
            pricingPageUrl: competitor.pricingPageUrl,
            changelogUrl: competitor.changelogUrl,
            careersPageUrl: competitor.careersPageUrl,
            reviewSourceUrl: competitor.reviewSourceUrl,
            monitoringFrequency: competitor.monitoringFrequency,
            isMonitoringEnabled: competitor.isMonitoringEnabled,
          }}
          submitLabel="Save changes"
          serverError={serverError}
          onSubmit={onSubmit}
        />
      </div>
    </main>
  );
}
