// Client-side MUI setup. The theme object contains functions (the
// breakpoints helpers), so it cannot be passed from the server layout
// to a Client Component — Next.js would try to serialise it and fail
// the build. Creating it here, inside a "use client" boundary, is the
// standard MUI + App Router pattern.
"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "../theme";

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
