"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

function field(label: string, error: string | undefined, input: React.ReactNode) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {input}
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

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

  const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2";

  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4">
      {field(
        "Company name *",
        errors.companyName?.message,
        <input id="companyName" type="text" placeholder="e.g. Asana" {...register("companyName")} className={inputClass} />
      )}
      {field(
        "Website URL *",
        errors.websiteUrl?.message,
        <input id="websiteUrl" type="url" placeholder="https://asana.com" {...register("websiteUrl")} className={inputClass} />
      )}
      {field(
        "Pricing page URL",
        errors.pricingPageUrl?.message,
        <input id="pricingPageUrl" type="url" placeholder="https://asana.com/pricing" {...register("pricingPageUrl")} className={inputClass} />
      )}
      {field(
        "Changelog URL",
        errors.changelogUrl?.message,
        <input id="changelogUrl" type="url" placeholder="https://asana.com/changelog" {...register("changelogUrl")} className={inputClass} />
      )}
      {field(
        "Careers page URL",
        errors.careersPageUrl?.message,
        <input id="careersPageUrl" type="url" placeholder="https://asana.com/jobs" {...register("careersPageUrl")} className={inputClass} />
      )}
      {field(
        "Review source URL",
        errors.reviewSourceUrl?.message,
        <input id="reviewSourceUrl" type="url" placeholder="https://www.g2.com/products/asana/reviews" {...register("reviewSourceUrl")} className={inputClass} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="monitoringFrequency" className="text-sm font-medium">How often to check</label>
          <select id="monitoringFrequency" {...register("monitoringFrequency")} className={inputClass}>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" {...register("isMonitoringEnabled")} className="h-4 w-4" />
            Monitoring enabled
          </label>
        </div>
      </div>
      <p className="text-sm text-neutral-500">
        Only the company name and website are required. The other URLs are the pages
        this tool will watch in the scraping phase — you can add them later.
      </p>
      {serverError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-indigo-700 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
