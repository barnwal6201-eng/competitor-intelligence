// MUI theme — glassmorphic, Linear-style clean and modern.
//
// The look: a soft gradient mesh page background (see globals.css) with
// frosted-glass surfaces floating on it — translucent white cards with a
// blur, a hairline white border and a soft shadow. Primary is Linear's
// indigo (#5e6ad2); the sidebar is dark glass. Everything else is
// standard MUI — no custom CSS classes in pages, so the whole app gets
// the same treatment from this one file.

import { createTheme } from "@mui/material/styles";

export const glassCard = {
  background: "rgba(255, 255, 255, 0.62)",
  backdropFilter: "blur(18px) saturate(160%)",
  WebkitBackdropFilter: "blur(18px) saturate(160%)",
  border: "1px solid rgba(255, 255, 255, 0.75)",
  borderRadius: 20,
  boxShadow: "0 8px 32px rgba(31, 38, 135, 0.10)",
};

export const glassDark = {
  background: "rgba(17, 17, 27, 0.72)",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
  border: "1px solid rgba(255, 255, 255, 0.10)",
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#5e6ad2",
      dark: "#4f46e5",
      light: "#a5b4fc",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#7c3aed",
      light: "#c4b5fd",
      contrastText: "#ffffff",
    },
    background: {
      // Transparent on purpose — the gradient mesh in globals.css is
      // the page background; surfaces are glass on top of it.
      default: "transparent",
      paper: "rgba(255, 255, 255, 0.62)",
    },
    text: {
      primary: "#111827",
      secondary: "#5b6474",
    },
    success: { main: "#059669" },
    warning: { main: "#d97706" },
    error: { main: "#dc2626" },
    info: { main: "#0284c7" },
    divider: "rgba(17, 24, 39, 0.08)",
  },
  typography: {
    fontFamily: "var(--font-inter), Inter, ui-sans-system, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    h1: { fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontWeight: 600, letterSpacing: "-0.01em" },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundAttachment: "fixed",
        },
        a: { textDecoration: "none" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          ...glassCard,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        // Glass by default for elevated surfaces (menus, dialogs,
        // drawers get their own overrides below where they differ).
        elevation1: { ...glassCard, boxShadow: "0 4px 20px rgba(31, 38, 135, 0.08)" },
        elevation2: { ...glassCard, boxShadow: "0 8px 32px rgba(31, 38, 135, 0.10)" },
        elevation3: { ...glassCard, boxShadow: "0 12px 40px rgba(31, 38, 135, 0.12)" },
        elevation8: { ...glassCard, boxShadow: "0 16px 48px rgba(31, 38, 135, 0.14)" },
        elevation24: { ...glassCard, boxShadow: "0 24px 64px rgba(31, 38, 135, 0.18)" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #5e6ad2 0%, #4f46e5 100%)",
          boxShadow: "0 4px 14px rgba(94, 106, 210, 0.35)",
          "&:hover": {
            background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
            boxShadow: "0 6px 20px rgba(94, 106, 210, 0.45)",
          },
        },
        outlined: {
          background: "rgba(255, 255, 255, 0.55)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(255, 255, 255, 0.8)",
          "&:hover": { background: "rgba(255, 255, 255, 0.8)" },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            background: "rgba(255, 255, 255, 0.65)",
            backdropFilter: "blur(12px)",
            borderRadius: 12,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          background: "rgba(255, 255, 255, 0.65)",
          backdropFilter: "blur(12px)",
          borderRadius: 12,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(8px)",
          fontWeight: 600,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          ...glassDark,
          color: "#e5e7eb",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid rgba(17, 24, 39, 0.06)",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(12px)",
          borderRadius: 12,
        },
      },
    },
  },
});

export default theme;
