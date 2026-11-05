import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || "";
if (!jwtSecret) {
  console.warn(
    "WARNING: JWT_SECRET is not set. Using a dev-only fallback secret. " +
      "Set a long random JWT_SECRET in backend/.env before any real use — see backend/.env.example."
  );
}

export const env = {
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",
  mongodbUri: process.env.MONGODB_URI || "",
  // Dev fallback only; production must set JWT_SECRET (see .env.example).
  jwtSecret: jwtSecret || "dev-only-secret-change-me-in-production",
  jwtExpiresInDays: 7,
  isProduction: process.env.NODE_ENV === "production",
};
