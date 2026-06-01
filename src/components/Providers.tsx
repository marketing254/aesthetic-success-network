"use client";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import theme from "@/theme";

/**
 * MUI provider for the App Router. enableCssLayer puts MUI's styles into a
 * lower CSS @layer, so the site's plain CSS in globals.css always wins on
 * conflicting selectors — MUI is scoped to the ported form components.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
