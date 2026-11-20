"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import CompetitorForm from "../CompetitorForm";
import { createCompetitor } from "@/services/competitors";
import { BackLink, Card, PageHeader } from "@/components/ui";
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
    <div>
      <PageHeader
        eyebrow={
          <BackLink href="/competitors">
            <ArrowLeft className="h-4 w-4" /> Competitors
          </BackLink>
        }
        title="Add a competitor"
        description="It is saved under your organization only — no other organization can see it."
      />
      <Card className="mt-6 max-w-3xl p-6 sm:p-8">
        <CompetitorForm submitLabel="Add competitor" serverError={serverError} onSubmit={onSubmit} />
      </Card>
    </div>
  );
}
