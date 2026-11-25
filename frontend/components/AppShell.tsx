"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import DashboardIcon from "@mui/icons-material/Dashboard";
import InsightsIcon from "@mui/icons-material/Insights";
import IntegrationIcon from "@mui/icons-material/IntegrationInstructions";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import RadarIcon from "@mui/icons-material/Radar";
import StyleIcon from "@mui/icons-material/Style";
import { motion } from "framer-motion";
import { FloatingOrbs, PageTransition } from "@/components/motion";
import { getCurrentUser, logoutUser } from "@/services/auth";
import type { AuthUser } from "@/types";

// MUI glassmorphic app shell: dark glass sidebar on desktop, glass top
// bar + pill nav on mobile. The workspace name and user come from the
// real /api/auth/me response — nothing here is hard-coded.

const DRAWER_WIDTH = 264;

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/competitors", label: "Competitors", icon: BusinessIcon },
  { href: "/intelligence", label: "Intelligence", icon: InsightsIcon },
  { href: "/battlecards", label: "Battlecards", icon: StyleIcon },
  { href: "/integrations", label: "Integrations", icon: IntegrationIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

const MotionLink = motion(Link);

function Logo() {
  return (
    <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <Box
        sx={{
          display: "flex",
          height: 36,
          width: 36,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 2,
          background: "linear-gradient(135deg, #5e6ad2 0%, #7c3aed 100%)",
          color: "#fff",
          boxShadow: "0 4px 14px rgba(94, 106, 210, 0.45)",
        }}
      >
        <RadarIcon sx={{ fontSize: 20 }} />
      </Box>
      <Box sx={{ lineHeight: 1.2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#fff", fontSize: "0.88rem", whiteSpace: "nowrap" }}>
          Competitor Intelligence
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
          Scraper &amp; Battlecard Agent
        </Typography>
      </Box>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        // Pages themselves redirect on 401; the shell just shows a
        // minimal state until then.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await logoutUser();
    router.push("/login");
    router.refresh();
  }

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ px: 2.5, pb: 2, pt: 2.5 }}>
        <Logo />
      </Box>
      <List sx={{ flex: 1, px: 1.5, py: 1 }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <ListItemButton
              key={href}
              component={MotionLink}
              href={href}
              selected={active}
              onClick={() => setMobileOpen(false)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              sx={{
                position: "relative",
                borderRadius: 2,
                mb: 0.5,
                color: active ? "#fff" : "rgba(255,255,255,0.72)",
                backgroundColor: "transparent",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
                "&.Mui-selected": { backgroundColor: "transparent" },
                "&.Mui-selected:hover": { backgroundColor: "rgba(255,255,255,0.16)" },
              }}
            >
              {active ? (
                <motion.span
                  layoutId="nav-active-pill"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.12)",
                    borderLeft: "3px solid #818cf8",
                  }}
                />
              ) : null}
              <ListItemIcon sx={{ position: "relative", zIndex: 1, color: active ? "#a5b4fc" : "rgba(255,255,255,0.6)", minWidth: 36 }}>
                <Icon />
              </ListItemIcon>
              <ListItemText primary={label} sx={{ position: "relative", zIndex: 1 }} primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: active ? 600 : 500 }} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.10)", p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ width: 36, height: 36, background: "linear-gradient(135deg, #5e6ad2, #7c3aed)", fontSize: "0.9rem", fontWeight: 700 }}>
            {user ? user.name.slice(0, 1).toUpperCase() : "?"}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#fff" }} noWrap>
              {user ? user.name : "Loading…"}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }} noWrap>
              {user ? `${user.organization.name} · ${user.role}` : "Your workspace"}
            </Typography>
          </Box>
          <IconButton onClick={handleSignOut} aria-label="Sign out" sx={{ color: "rgba(255,255,255,0.6)", "&:hover": { color: "#fff", background: "rgba(255,255,255,0.08)" } }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Box>
        {user ? (
          <Typography variant="caption" sx={{ display: "block", mt: 1, color: "rgba(255,255,255,0.45)" }} noWrap>
            {user.email}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ position: "relative", display: "flex", minHeight: "100vh", overflow: "hidden" }}>
      <FloatingOrbs subtle />
      {/* Mobile top bar */}
      <AppBar
        position="fixed"
        sx={{
          display: { lg: "none" },
          background: "rgba(255, 255, 255, 0.65)",
          backdropFilter: "blur(18px) saturate(160%)",
          color: "text.primary",
          boxShadow: "0 4px 20px rgba(31, 38, 135, 0.08)",
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 1.5, background: "linear-gradient(135deg, #5e6ad2, #7c3aed)", color: "#fff" }}>
                <RadarIcon sx={{ fontSize: 18 }} />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap" }}>
                Competitor Intelligence
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleSignOut} aria-label="Sign out">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
        <Box sx={{ display: "flex", gap: 1, overflowX: "auto", px: 2, pb: 1.5 }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Box
                key={href}
                component={MotionLink}
                href={href}
                whileTap={{ scale: 0.95 }}
                sx={{
                  display: "inline-flex",
                  flexShrink: 0,
                  alignItems: "center",
                  gap: 0.75,
                  borderRadius: 999,
                  px: 1.75,
                  py: 0.75,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: active ? "#fff" : "text.secondary",
                  background: active ? "linear-gradient(135deg, #5e6ad2, #4f46e5)" : "rgba(255,255,255,0.6)",
                  boxShadow: active ? "0 4px 14px rgba(94, 106, 210, 0.35)" : "none",
                  textDecoration: "none",
                }}
              >
                <Icon sx={{ fontSize: 16 }} />
                {label}
              </Box>
            );
          })}
        </Box>
      </AppBar>

      {/* Desktop sidebar + mobile drawer — dark glass. */}
      <Box component="nav" sx={{ width: { lg: DRAWER_WIDTH }, flexShrink: { lg: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", lg: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", lg: "block" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: DRAWER_WIDTH, border: "none" },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Page content */}
      <Box
        component="main"
        sx={{
          position: "relative",
          zIndex: 1,
          flexGrow: 1,
          width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` },
          px: { xs: 2, sm: 3, lg: 4 },
          py: { xs: 2, lg: 4 },
          pt: { xs: 17, lg: 4 },
          maxWidth: 1152,
          mx: "auto",
        }}
      >
        <PageTransition>{children}</PageTransition>
      </Box>
    </Box>
  );
}
