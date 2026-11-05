"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerUser } from "@/services/auth";

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
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Registering also creates your organization workspace. You will be its owner.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="text-sm font-medium">Your name</label>
          <input id="name" type="text" autoComplete="name" {...register("name")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" />
          {errors.name && <p className="mt-1 text-sm text-red-700">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="organizationName" className="text-sm font-medium">Organization name (optional)</label>
          <input id="organizationName" type="text" {...register("organizationName")}
            placeholder="e.g. Acme Sales Team"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" />
          {errors.organizationName && <p className="mt-1 text-sm text-red-700">{errors.organizationName.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" type="email" autoComplete="email" {...register("email")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" />
          {errors.email && <p className="mt-1 text-sm text-red-700">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">Password (at least 8 characters)</label>
          <input id="password" type="password" autoComplete="new-password" {...register("password")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" />
          {errors.password && <p className="mt-1 text-sm text-red-700">{errors.password.message}</p>}
        </div>
        {serverError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
        <button type="submit" disabled={isSubmitting}
          className="w-full rounded-md bg-indigo-700 px-4 py-2 font-medium text-white disabled:opacity-50">
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        Already have an account? <Link href="/login" className="font-medium text-indigo-700">Sign in</Link>
      </p>
    </div>
  );
}
