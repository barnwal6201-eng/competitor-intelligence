"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import CompetitorForm from "../../CompetitorForm";
import { getCompetitor, updateCompetitor } from "@/services/competitors";
import { BackLink, Card, PageHeader } from "@/components/ui";
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
      <div>
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
        <BackLink href="/competitors">
          <ArrowLeft className="h-4 w-4" /> Back to competitors
        </BackLink>
      </div>
    );
  }
  if (!competitor) {
    return (
      <p className="flex items-center gap-2 py-16 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading competitor…
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          <BackLink href="/competitors">
            <ArrowLeft className="h-4 w-4" /> Competitors
          </BackLink>
        }
        title={`Edit ${competitor.companyName}`}
        description="Changes are saved under your organization only."
      />
      <Card className="mt-6 max-w-3xl p-6 sm:p-8">
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
      </Card>
    </div>
  );
}
