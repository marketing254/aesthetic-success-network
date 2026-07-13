"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "@/theme";

/** MUI providers — wraps the admin surfaces only; the public site is plain CSS. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // NOTE: no enableCssLayer here — layered MUI styles would lose to the
    // public site's global CSS reset and collapse all admin spacing.
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
