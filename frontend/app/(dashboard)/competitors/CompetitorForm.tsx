"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { btnPrimary, inputClass, labelClass } from "@/components/ui";
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

function field(label: string, error: string | undefined, input: React.ReactNode, hint?: string) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {input}
      {hint && !error ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
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

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Company</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pages to watch</h2>
        <p className="mt-1 text-sm text-slate-500">
          Only the company name and website are required. Add the pages below to have them scanned — you can add them later.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Monitoring</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="monitoringFrequency" className={labelClass}>How often to check</label>
            <select id="monitoringFrequency" {...register("monitoringFrequency")} className={inputClass}>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700">
              <input type="checkbox" {...register("isMonitoringEnabled")} className="h-4 w-4 accent-indigo-600" />
              Monitoring enabled
            </label>
          </div>
        </div>
      </section>

      {serverError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`${btnPrimary} w-full sm:w-auto`}
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
