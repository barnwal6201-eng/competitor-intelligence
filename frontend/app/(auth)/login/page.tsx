"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginUser } from "@/services/auth";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    setServerError("");
    try {
      await loginUser(data);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-neutral-600">Sign in to your Competitor Intelligence workspace.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" type="email" autoComplete="email" {...register("email")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" />
          {errors.email && <p className="mt-1 text-sm text-red-700">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input id="password" type="password" autoComplete="current-password" {...register("password")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" />
          {errors.password && <p className="mt-1 text-sm text-red-700">{errors.password.message}</p>}
        </div>
        {serverError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</p>}
        <button type="submit" disabled={isSubmitting}
          className="w-full rounded-md bg-indigo-700 px-4 py-2 font-medium text-white disabled:opacity-50">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        No account yet? <Link href="/register" className="font-medium text-indigo-700">Create one</Link>
      </p>
    </div>
  );
}
