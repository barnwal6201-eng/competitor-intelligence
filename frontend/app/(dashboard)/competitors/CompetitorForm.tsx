"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid2";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { CompetitorInput, MonitoringFrequency } from "@/types";

const competitorFormSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
  websiteUrl: z.string().trim().url("Website must be a valid URL starting with http:// or https://"),
  pricingPageUrl: z.string().trim().optional(),
  changelogUrl: z.string().trim().optional(),
  careersPageUrl: z.string().trim().optional(),
  reviewSourceUrl: z.string().trim().optional(),
  monitoringFrequency: z.enum(["hourly", "daily", "weekly"]),
  isMonitoringEnabled: z.boolean(),
});

type CompetitorFormValues = z.infer<typeof competitorFormSchema>;

export default function CompetitorForm({
  defaultValues,
  submitLabel,
  serverError,
  onSubmit,
}: {
  defaultValues?: Partial<CompetitorInput>;
  submitLabel: string;
  serverError: string;
  onSubmit: (data: CompetitorInput) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CompetitorFormValues>({
    resolver: zodResolver(competitorFormSchema),
    defaultValues: {
      companyName: defaultValues?.companyName ?? "",
      websiteUrl: defaultValues?.websiteUrl ?? "",
      pricingPageUrl: defaultValues?.pricingPageUrl ?? "",
      changelogUrl: defaultValues?.changelogUrl ?? "",
      careersPageUrl: defaultValues?.careersPageUrl ?? "",
      reviewSourceUrl: defaultValues?.reviewSourceUrl ?? "",
      monitoringFrequency: (defaultValues?.monitoringFrequency ?? "daily") as MonitoringFrequency,
      isMonitoringEnabled: defaultValues?.isMonitoringEnabled ?? true,
    },
  });

  async function submit(data: CompetitorFormValues) {
    // Blank optional URLs are sent as "" on purpose: the backend normalises
    // them to "not provided" — on create they are ignored, and on edit a
    // cleared field is removed. Sending undefined instead would leave the
    // old value in place, because JSON drops undefined keys.
    await onSubmit({
      companyName: data.companyName,
      websiteUrl: data.websiteUrl,
      pricingPageUrl: data.pricingPageUrl ?? "",
      changelogUrl: data.changelogUrl ?? "",
      careersPageUrl: data.careersPageUrl ?? "",
      reviewSourceUrl: data.reviewSourceUrl ?? "",
      monitoringFrequency: data.monitoringFrequency,
      isMonitoringEnabled: data.isMonitoringEnabled,
    });
  }

  return (
    <Box component="form" onSubmit={handleSubmit(submit)} sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Box component="section">
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          Company
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              id="companyName"
              label="Company name *"
              placeholder="e.g. Asana"
              fullWidth
              {...register("companyName")}
              error={!!errors.companyName}
              helperText={errors.companyName?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              id="websiteUrl"
              label="Website URL *"
              type="url"
              placeholder="https://asana.com"
              fullWidth
              {...register("websiteUrl")}
              error={!!errors.websiteUrl}
              helperText={errors.websiteUrl?.message}
            />
          </Grid>
        </Grid>
      </Box>

      <Box component="section">
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          Pages to watch
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Only the company name and website are required. Add the pages below to have them scanned — you can add them later.
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              id="pricingPageUrl"
              label="Pricing page URL"
              type="url"
              placeholder="https://asana.com/pricing"
              fullWidth
              {...register("pricingPageUrl")}
              error={!!errors.pricingPageUrl}
              helperText={errors.pricingPageUrl?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              id="changelogUrl"
              label="Changelog URL"
              type="url"
              placeholder="https://asana.com/changelog"
              fullWidth
              {...register("changelogUrl")}
              error={!!errors.changelogUrl}
              helperText={errors.changelogUrl?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              id="careersPageUrl"
              label="Careers page URL"
              type="url"
              placeholder="https://asana.com/jobs"
              fullWidth
              {...register("careersPageUrl")}
              error={!!errors.careersPageUrl}
              helperText={errors.careersPageUrl?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              id="reviewSourceUrl"
              label="Review source URL"
              type="url"
              placeholder="https://www.g2.com/products/asana/reviews"
              fullWidth
              {...register("reviewSourceUrl")}
              error={!!errors.reviewSourceUrl}
              helperText={errors.reviewSourceUrl?.message}
            />
          </Grid>
        </Grid>
      </Box>

      <Box component="section">
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          Monitoring
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="monitoringFrequency-label">How often to check</InputLabel>
              <Controller
                name="monitoringFrequency"
                control={control}
                render={({ field }) => (
                  <Select
                    id="monitoringFrequency"
                    labelId="monitoringFrequency-label"
                    label="How often to check"
                    {...field}
                  >
                    <MenuItem value="hourly">Hourly</MenuItem>
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }} sx={{ display: "flex", alignItems: "flex-end" }}>
            <Controller
              name="isMonitoringEnabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} color="primary" />}
                  label="Monitoring enabled"
                />
              )}
            />
          </Grid>
        </Grid>
      </Box>

      {serverError && <Alert severity="error">{serverError}</Alert>}
      <Button
        type="submit"
        disabled={isSubmitting}
        variant="contained"
        size="large"
        startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}
        sx={{ width: { xs: "100%", sm: "auto" }, alignSelf: "flex-start" }}
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </Box>
  );
}
