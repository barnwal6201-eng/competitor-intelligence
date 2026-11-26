"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
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
      <Box>
        <Alert severity="error">{loadError}</Alert>
        <Box sx={{ mt: 2 }}>
          <BackLink href="/competitors">
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to competitors
          </BackLink>
        </Box>
      </Box>
    );
  }
  if (!competitor) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 8, color: "text.secondary" }}>
        <CircularProgress size={18} /> Loading competitor…
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        eyebrow={
          <BackLink href="/competitors">
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Competitors
          </BackLink>
        }
        title={`Edit ${competitor.companyName}`}
        description="Changes are saved under your organization only."
      />
      <Card sx={{ mt: 3, maxWidth: 768 }} disablePadding>
        <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
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
        </Box>
      </Card>
    </Box>
  );
}
