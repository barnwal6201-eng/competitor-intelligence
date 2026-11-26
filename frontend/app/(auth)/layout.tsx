"use client";

import Box from "@mui/material/Box";
import RadarIcon from "@mui/icons-material/Radar";
import Typography from "@mui/material/Typography";
import { motion } from "framer-motion";
import { FloatingOrbs } from "@/components/motion";

// MUI glass auth shell, Framer Motion edition: no side panel — the
// sign-in / register glass card floats centered over a full-page neon
// background of slowly drifting glow orbs, in the same glassmorphic
// language as the rest of the app. Logo + name sit centered above the
// card, and the card springs in on mount.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        minHeight: "100vh",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 5,
      }}
    >
      <FloatingOrbs />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440 }}
      >
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
        >
          <Box
            sx={{
              display: "flex",
              height: 40,
              width: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 2,
              background: "linear-gradient(135deg, #5e6ad2, #7c3aed)",
              color: "#fff",
              boxShadow: "0 0 24px rgba(124, 58, 237, 0.65), 0 4px 14px rgba(94, 106, 210, 0.45)",
            }}
          >
            <RadarIcon />
          </Box>
          <Box sx={{ lineHeight: 1.2, textAlign: "left" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Competitor Intelligence
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Scraper &amp; Battlecard Agent
            </Typography>
          </Box>
        </motion.div>
        {children}
      </motion.div>
    </Box>
  );
}
