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
    <Card>
      <Box sx={{ p: 4 }}>
        <Typography variant="h5" component="h1">Welcome back</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Sign in to your Competitor Intelligence workspace.
        </Typography>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
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
            label="Password"
            type="password"
            autoComplete="current-password"
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
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
          No account yet?{" "}
          <LinkMui component={Link} href="/register" sx={{ fontWeight: 600 }}>
            Create one
          </LinkMui>
        </Typography>
      </Box>
    </Card>
  );
}
