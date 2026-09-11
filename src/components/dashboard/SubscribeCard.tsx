"use client";

import { useEffect, useState } from "react";
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { SectionCard } from "@/components/portal/ui";
import type { SubscriptionPlanKey } from "@/lib/stripe";

type Availability = {
  founding: { isOpen: boolean; remaining: number };
  early: { isOpen: boolean; remaining: number };
};

type ActiveTier = "founding" | "early" | "standard";

const TIER_COPY: Record<ActiveTier, { label: string; monthly: number; annual: number; plan: { monthly: SubscriptionPlanKey; annual: SubscriptionPlanKey } }> = {
  founding: {
    label: "Founding",
    monthly: 49,
    annual: 490,
    plan: { monthly: "founding_monthly", annual: "founding_annual" },
  },
  early: {
    label: "Early",
    monthly: 99,
    annual: 990,
    plan: { monthly: "early_monthly", annual: "early_annual" },
  },
  standard: {
    label: "Standard",
    monthly: 199,
    annual: 1990,
    plan: { monthly: "standard_monthly", annual: "standard_annual" },
  },
};

/** Plan-picker for a member with no active subscription yet. Which tier is purchasable is decided by seat availability, not user choice. */
export function SubscribeCard() {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stripe/availability")
      .then((r) => r.json())
      .then(setAvailability)
      .catch(() => setAvailability(null));
  }, []);

  const activeTier: ActiveTier = !availability
    ? "founding"
    : availability.founding.isOpen
      ? "founding"
      : availability.early.isOpen
        ? "early"
        : "standard";

  const tier = TIER_COPY[activeTier];
  const plan = tier.plan[interval];

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <SectionCard title={`${tier.label} membership`}>
      <Stack spacing={2}>
        <Typography variant="body2">
          {activeTier === "founding" && "You're eligible for the founding rate — locked for as long as your membership stays active."}
          {activeTier === "early" && "Founding tier is full. You're eligible for the early rate, still locked in for life."}
          {activeTier === "standard" && "Early tier is full. Standard rate applies."}
        </Typography>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={interval}
          onChange={(_, v) => v && setInterval(v)}
          sx={{ alignSelf: "flex-start" }}
        >
          <ToggleButton value="monthly">Monthly</ToggleButton>
          <ToggleButton value="annual">Annual (2 months free)</ToggleButton>
        </ToggleButtonGroup>

        <Box>
          <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "2rem" }}>
            ${interval === "monthly" ? tier.monthly : tier.annual}
            <Typography component="span" variant="body2">
              {" "}
              / {interval === "monthly" ? "mo" : "yr"}
            </Typography>
          </Typography>
        </Box>

        {error && (
          <Typography variant="body2" sx={{ color: "error.main" }}>
            {error}
          </Typography>
        )}

        <Button variant="contained" size="large" onClick={startCheckout} disabled={busy} sx={{ alignSelf: "flex-start" }}>
          Claim your rate
        </Button>
      </Stack>
    </SectionCard>
  );
}
