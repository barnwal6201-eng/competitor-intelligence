"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerUser } from "@/services/auth";
import { btnPrimary, inputClass, labelClass } from "@/components/ui";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Please provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  organizationName: z.string().trim().min(2).max(100).optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterForm) {
    setServerError("");
    try {
      await registerUser({ ...data, organizationName: data.organizationName || undefined });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Registering also creates your organization workspace. You will be its owner.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
        <div>
          <label htmlFor="name" className={labelClass}>Your name</label>
          <input id="name" type="text" autoComplete="name" placeholder="Ankit Kumar" {...register("name")}
            className={inputClass} />
          {errors.name && <p className="mt-1 text-sm text-red-700">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="organizationName" className={labelClass}>Organization name (optional)</label>
          <input id="organizationName" type="text" {...register("organizationName")}
            placeholder="e.g. Acme Sales Team"
            className={inputClass} />
          {errors.organizationName && <p className="mt-1 text-sm text-red-700">{errors.organizationName.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register("email")}
            className={inputClass} />
          {errors.email && <p className="mt-1 text-sm text-red-700">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>Password (at least 8 characters)</label>
          <input id="password" type="password" autoComplete="new-password" {...register("password")}
            className={inputClass} />
          {errors.password && <p className="mt-1 text-sm text-red-700">{errors.password.message}</p>}
        </div>
        {serverError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
        <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full`}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account? <Link href="/login" className="font-medium text-indigo-600 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
