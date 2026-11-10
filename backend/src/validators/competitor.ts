import { z } from "zod";

// Phase 3: validation for competitor records (PRD sections 2 and 6).
// Optional URL fields accept an empty string from HTML forms — it is
// normalised to "not provided" before it is stored, so a blank field is
// never saved as an empty string.

const optionalUrl = z
  .union([z.literal(""), z.string().trim().url("Must be a valid URL starting with http:// or https://")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

const competitorFields = {
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
  websiteUrl: z.string().trim().url("Website must be a valid URL starting with http:// or https://"),
  pricingPageUrl: optionalUrl,
  changelogUrl: optionalUrl,
  careersPageUrl: optionalUrl,
  reviewSourceUrl: optionalUrl,
  monitoringFrequency: z.enum(["hourly", "daily", "weekly"]),
  isMonitoringEnabled: z.boolean(),
};

export const createCompetitorSchema = z.object({
  ...competitorFields,
  // Defaults match the Competitor model, so the frontend may omit them.
  monitoringFrequency: competitorFields.monitoringFrequency.default("daily"),
  isMonitoringEnabled: competitorFields.isMonitoringEnabled.default(true),
});

export const updateCompetitorSchema = z
  .object({
    companyName: competitorFields.companyName.optional(),
    websiteUrl: competitorFields.websiteUrl.optional(),
    pricingPageUrl: optionalUrl,
    changelogUrl: optionalUrl,
    careersPageUrl: optionalUrl,
    reviewSourceUrl: optionalUrl,
    monitoringFrequency: competitorFields.monitoringFrequency.optional(),
    isMonitoringEnabled: competitorFields.isMonitoringEnabled.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nothing to update",
  });

export type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;
export type UpdateCompetitorInput = z.infer<typeof updateCompetitorSchema>;
