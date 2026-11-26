"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
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
    <Box>
      <PageHeader
        eyebrow={
          <BackLink href="/competitors">
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Competitors
          </BackLink>
        }
        title="Add a competitor"
        description="It is saved under your organization only — no other organization can see it."
      />
      <Card sx={{ mt: 3, maxWidth: 768 }} disablePadding>
        <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
          <CompetitorForm submitLabel="Add competitor" serverError={serverError} onSubmit={onSubmit} />
        </Box>
      </Card>
    </Box>
  );
}
