"use client";

import { useState } from "react";
import { Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

/**
 * UpgradePlanChoice
 *
 * The plan choices a partner or expert can pick to start (or replace)
 * their paid subscription: the $49 growth rate (months 7 to 12) and the
 * $199 standard rate (monthly or annual) from month 13. There is no
 * early tier. Used inside the portal billing page when:
 *
 *   - The expert/partner is still in the founding waiver (they can
 *     pre-pick a plan to lock the launch rate or jump to annual), OR
 *   - The waiver has ended and they have no active subscription.
 *
 * Posts to `/api/{role}/billing/checkout` with a plan key, follows the
 * returned Stripe Checkout URL.
 *
 * `audience` controls the accent color (gold = partner, green = expert)
 * so the same component reads on-brand in both portals.
 */
export type UpgradePlan = {
  key: string;          // Stripe plan key, e.g. "expert_growth_monthly"
  cap: string;          // header band text, e.g. "Months 7 to 12"
  price: string;        // e.g. "$49"
  per: string;          // e.g. "/mo"
  highlight?: string;   // optional ribbon, e.g. "BEST VALUE"
  body: string;         // 1-line description
  features: string[];   // bullet list (3-5)
  ctaLabel: string;     // button label
};

export default function UpgradePlanChoice({
  endpoint,
  plans,
  audience,
  title,
  subtitle,
}: {
  endpoint: string;
  plans: UpgradePlan[];
  audience: "gold" | "green";
  title: string;
  subtitle: string;
}) {
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accentColor = audience === "gold" ? "#A07823" : "#1F5238";
  const accentBright = audience === "gold" ? "#D9A84B" : "#2C7A52";
  const accentTint = audience === "gold" ? "rgba(217,168,75,0.08)" : "rgba(44,122,82,0.08)";

  const startCheckout = async (planKey: string) => {
    setBusyPlan(planKey);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string; redirectTo?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? `Could not start checkout (${res.status})`);
        setBusyPlan(null);
        return;
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBusyPlan(null);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: "#FFFFFF",
        border: "1px solid #E0DACE",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid rgba(14,42,61,0.06)" }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: "#0A1320" }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: "0.76rem", color: "#5C6770", mt: 0.25 }}>
          {subtitle}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: `repeat(${Math.min(Math.max(plans.length, 1), 3)}, 1fr)` },
          gap: 2,
          p: 2.5,
        }}
      >
        {plans.map((p) => {
          const hot = !!p.highlight;
          const busy = busyPlan === p.key;
          return (
            <Box
              key={p.key}
              sx={{
                position: "relative",
                borderRadius: 2,
                border: hot ? `2px solid ${accentBright}` : "1px solid rgba(14,42,61,0.1)",
                bgcolor: hot ? accentTint : "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {p.highlight && (
                <Chip
                  label={p.highlight}
                  size="small"
                  sx={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    bgcolor: accentBright,
                    color: "#FFFFFF",
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    height: 20,
                    "& .MuiChip-label": { px: 0.75 },
                  }}
                />
              )}
              <Box
                sx={{
                  bgcolor: "#0A1320",
                  color: "#FFFFFF",
                  textAlign: "center",
                  py: 1,
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {p.cap}
              </Box>
              <Box sx={{ textAlign: "center", py: 2.5, px: 1.5 }}>
                <Stack direction="row" spacing={0.5} sx={{ justifyContent: "center", alignItems: "baseline" }}>
                  <Typography
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontSize: "2rem",
                      fontWeight: 600,
                      color: "#0A1320",
                      lineHeight: 1,
                    }}
                  >
                    {p.price}
                  </Typography>
                  {p.per && (
                    <Typography sx={{ fontSize: "0.86rem", color: "#5C6770", fontWeight: 500 }}>
                      {p.per}
                    </Typography>
                  )}
                </Stack>
                <Typography sx={{ fontSize: "0.8rem", color: "#5C6770", mt: 0.75, lineHeight: 1.45 }}>
                  {p.body}
                </Typography>
              </Box>
              <Stack spacing={0.75} sx={{ px: 2, pb: 2, flex: 1 }}>
                {p.features.map((f) => (
                  <Stack key={f} direction="row" spacing={0.85} sx={{ alignItems: "flex-start" }}>
                    <CheckRoundedIcon sx={{ fontSize: 14, color: accentColor, mt: 0.2, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: "0.78rem", color: "#0A1320", lineHeight: 1.4 }}>
                      {f}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Box sx={{ px: 2, pb: 2 }}>
                <Button
                  fullWidth
                  variant={hot ? "contained" : "outlined"}
                  onClick={() => startCheckout(p.key)}
                  disabled={busy}
                  startIcon={busy ? <CircularProgress size={12} sx={{ color: "inherit" }} /> : null}
                  sx={{
                    borderRadius: 999,
                    textTransform: "none",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    py: 0.85,
                    ...(hot && {
                      bgcolor: accentColor,
                      color: "#FFFFFF",
                      backgroundImage: `linear-gradient(180deg, ${accentBright} 0%, ${accentColor} 100%)`,
                      "&:hover": {
                        backgroundImage: `linear-gradient(180deg, ${accentBright} 0%, ${accentColor} 100%)`,
                      },
                    }),
                    ...(!hot && {
                      borderColor: "rgba(14,42,61,0.18)",
                      color: "#0A1320",
                    }),
                  }}
                >
                  {busy ? "Opening Stripe..." : p.ctaLabel}
                </Button>
              </Box>
            </Box>
          );
        })}
      </Box>
      {error && (
        <Typography sx={{ px: 2.5, pb: 2, fontSize: "0.78rem", color: "#8C1D1D" }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
