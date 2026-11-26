"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import LinkMui from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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
    <Card>
      <Box sx={{ p: 4 }}>
        <Typography variant="h5" component="h1">Create your account</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Registering also creates your organization workspace. You will be its owner.
        </Typography>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
          <TextField
            id="name"
            label="Your name"
            autoComplete="name"
            placeholder="Ankit Kumar"
            fullWidth
            {...register("name")}
            error={!!errors.name}
            helperText={errors.name?.message}
          />
          <TextField
            id="organizationName"
            label="Organization name (optional)"
            placeholder="e.g. Acme Sales Team"
            fullWidth
            {...register("organizationName")}
            error={!!errors.organizationName}
            helperText={errors.organizationName?.message}
          />
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            fullWidth
            {...register("email")}
            error={!!errors.email}
            helperText={errors.email?.message}
          />
          <TextField
            id="password"
            label="Password (at least 8 characters)"
            type="password"
            autoComplete="new-password"
            fullWidth
            {...register("password")}
            error={!!errors.password}
            helperText={errors.password?.message}
          />
          {serverError && <Alert severity="error">{serverError}</Alert>}
          <Button
            type="submit"
            disabled={isSubmitting}
            variant="contained"
            size="large"
            fullWidth
            startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
          Already have an account?{" "}
          <LinkMui component={Link} href="/login" sx={{ fontWeight: 600 }}>
            Sign in
          </LinkMui>
        </Typography>
      </Box>
    </Card>
  );
}
