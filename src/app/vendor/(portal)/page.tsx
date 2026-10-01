"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchCurrentVendor,
  fetchVendorKpis,
  fetchVendorOffers,
  fetchVendorRedemptions,
  type VendorKpis,
  type OfferWithCatalog,
  type RedemptionWithOffer,
} from "@/lib/supabase/vendorQueries";
import type { VendorsRow } from "@/lib/supabase/types";
import { ListDivider, SectionCard, StatCard, StatusPill, TagPill, listRowSx, portalText } from "@/components/vendor/PortalUI";
import { CP } from "@/components/shared/CommunityPortalShell";
import ReferralCard from "@/components/shared/ReferralCard";
import { currentRampRow, normalizeVendorPlan, vendorRamp } from "@/lib/vendorPricing";

const INK = CP.ink;
const MUTED = CP.muted;
const NAVY = CP.navy;

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function VendorOverview() {
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorsRow | null>(null);
  const [kpis, setKpis] = useState<VendorKpis | null>(null);
  const [offers, setOffers] = useState<OfferWithCatalog[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionWithOffer[]>([]);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      setSignedInEmail(userData.user?.email ?? null);

      const v = await fetchCurrentVendor(supabase);
      if (!active) return;
      setVendor(v);

      if (v) {
        const [kpiData, offerData, redemptionData] = await Promise.all([
          fetchVendorKpis(supabase, v.id),
          fetchVendorOffers(supabase, v.id),
          fetchVendorRedemptions(supabase, v.id, { limit: 5 }),
        ]);
        if (!active) return;
        setKpis(kpiData);
        setOffers(offerData);
        setRedemptions(redemptionData);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const firstName = useMemo(() => {
    if (!vendor) return "there";
    return vendor.contact_name?.split(" ")[0] ?? vendor.display_name ?? "there";
  }, [vendor]);

  // Data arrives client-side after the loading state, so the local hour is
  // safe to read here (no server/client mismatch).
  const greeting = greetingFor(new Date().getHours());

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 10, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography sx={portalText.meta}>Loading your dashboard...</Typography>
      </Stack>
    );
  }

  if (!vendor) {
    return (
      <SectionCard padding="default">
        <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center", py: 4 }}>
          <Typography sx={portalText.sectionTitle}>No company profile found.</Typography>
          {signedInEmail ? (
            <>
              <Typography sx={{ ...portalText.body, color: MUTED, maxWidth: 540 }}>
                You&apos;re signed in as <Box component="strong" sx={{ color: INK }}>{signedInEmail}</Box>, but no
                company record is linked to that email. If you&apos;re an admin testing the portal, sign out and sign
                back in with the email used on your company application.
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1, justifyContent: "center" }}>
                <Button component="a" href="/vendor/login" variant="contained">
                  Sign in as a different account
                </Button>
                <Button component="a" href="mailto:partners@aestheticsuccessnetwork.com" variant="outlined">
                  Email the partners team
                </Button>
              </Stack>
            </>
          ) : (
            <Typography sx={{ ...portalText.body, color: MUTED, maxWidth: 540 }}>
              Your session has expired. Head to{" "}
              <Box
                component="a"
                href="/vendor/login"
                sx={{ color: NAVY, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                /vendor/login
              </Box>{" "}
              and request a fresh sign-in code.
            </Typography>
          )}
        </Stack>
      </SectionCard>
    );
  }

  const k = kpis ?? {
    redemptionsThisMonth: 0,
    redemptionsLifetime: 0,
    savingsDeliveredMonth: 0,
    savingsDeliveredLifetime: 0,
    leadsThisMonth: 0,
    pendingOffersCount: 0,
    activeOffersCount: 0,
  };

  // Price terms for THIS company (vendors.billing_plan, 0071): free
  // founding months (6 from the member launch), then $39 standard or $149
  // large a month with no increase.
  const billingPlan = normalizeVendorPlan(vendor.billing_plan);
  const hasTrial = vendor.subscription_status === "trialing";
  const freeUntil = hasTrial ? vendor.current_period_end : null;
  const ramp = vendorRamp(billingPlan, freeUntil);
  const months = vendor.months_in_program ?? 0;
  const currentRow = currentRampRow(billingPlan, hasTrial, freeUntil);
  const isWebsite = !vendor.founding_partner_locked;
  const freeUntilLabel = freeUntil
    ? new Date(freeUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const planLabel = vendor.plan_id?.toUpperCase() ?? "FOUNDING";

  const subtitle =
    k.redemptionsThisMonth > 0
      ? `You delivered $${k.savingsDeliveredMonth.toLocaleString()} in member savings this month across ${k.redemptionsThisMonth} redemptions.`
      : vendor.verified
        ? "No member redemptions yet this month. Add or refresh an offer to keep your listing fresh."
        : "Your application is under team review. You can set up your catalog and draft offers now; they go live to members once your profile is approved.";

  const hasFocusItems =
    !vendor.verified || k.pendingOffersCount > 0 || (vendor.verified && k.leadsThisMonth > 0);

  return (
    <Stack spacing={3}>
      {/* Welcome hero: dark navy card with a gold glow; the stat tiles
          overlap its bottom edge on md+. */}
      <Box>
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "16px",
            bgcolor: CP.navy,
            backgroundImage: `linear-gradient(180deg, ${CP.navy} 0%, ${CP.sidebarEnd} 100%)`,
            color: CP.ivory,
            px: { xs: 3, md: 4 },
            pt: { xs: 3, md: 4 },
            pb: { xs: 3, md: 9 },
            boxShadow: "0 16px 40px -24px rgba(10,19,32,0.6)",
            "&::before": {
              content: '""',
              position: "absolute",
              top: -140,
              right: -100,
              width: 420,
              height: 420,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(217,168,75,0.32) 0%, rgba(217,168,75,0.10) 40%, transparent 70%)",
              pointerEvents: "none",
            },
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ position: "relative", justifyContent: "space-between", alignItems: { md: "flex-end" } }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: CP.gold, letterSpacing: "0.01em", mb: 0.75 }}>
                Company portal
              </Typography>
              <Typography
                component="h2"
                sx={{ fontSize: { xs: "1.5rem", md: "1.875rem" }, fontWeight: 800, letterSpacing: "-0.03em", color: "#FFFFFF", lineHeight: 1.15 }}
              >
                {greeting}, {firstName}
              </Typography>
              <Typography sx={{ fontSize: "0.9375rem", color: CP.ivory80, lineHeight: 1.55, maxWidth: 720, mt: 0.75 }}>{subtitle}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", rowGap: 1, alignItems: "center" }}>
                <HeroChip
                  tone={vendor.verified ? "success" : "warning"}
                  icon={vendor.verified ? <VerifiedRoundedIcon sx={{ fontSize: 14 }} /> : undefined}
                  label={vendor.verified ? "Verified company" : "Pending review"}
                />
                {planLabel === "FOUNDING" ? (
                  <HeroChip tone="gold" label="Founding" />
                ) : (
                  <HeroChip tone="neutral" label={planLabel} />
                )}
                <HeroChip tone="neutral" label={hasTrial ? "Free founding months" : `Month ${months}`} />
              </Stack>
            </Box>
            <Button
              component={Link}
              href="/vendor/offers/new"
              variant="contained"
              color="secondary"
              startIcon={<AddCircleOutlineOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", md: "auto" }, bgcolor: CP.gold, color: CP.ink, "&:hover": { bgcolor: "#E4B85E", color: CP.ink } }}
            >
              Create offer
            </Button>
          </Stack>
        </Box>

        {/* KPI tiles, overlapping the hero on md+ */}
        <Box sx={{ px: { xs: 0, md: 3 }, mt: { xs: 3, md: -6 }, position: "relative" }}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={ReceiptLongOutlinedIcon}
            accent="navy"
            label="Redemptions this month"
            value={String(k.redemptionsThisMonth)}
            footer={`${k.redemptionsLifetime} lifetime`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={SavingsOutlinedIcon}
            accent="navy"
            label="Savings delivered this month"
            value={`$${k.savingsDeliveredMonth.toLocaleString()}`}
            footer={`$${k.savingsDeliveredLifetime.toLocaleString()} lifetime`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={GroupsOutlinedIcon}
            accent="navy"
            label="Inbound leads this month"
            value={String(k.leadsThisMonth)}
            footer="Bookings and hotline"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={LocalOfferOutlinedIcon}
            accent="navy"
            label="Active offers"
            value={String(k.activeOffersCount)}
            footer={`${k.pendingOffersCount} pending review`}
          />
        </Grid>
      </Grid>
        </Box>
      </Box>

      {/* Two-column area */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="This week" subtitle="Where to focus" padding="none" sx={{ height: "100%" }}>
            <Stack divider={<ListDivider />}>
              {!vendor.verified && (
                <ActionRow label="Your application is under review by the team" hint="Read the agreement while you wait" href="/vendor/agreement" />
              )}
              {k.pendingOffersCount > 0 && (
                <ActionRow
                  label={`${k.pendingOffersCount} offer${k.pendingOffersCount === 1 ? "" : "s"} pending team review`}
                  hint="Usually approved within one business day"
                  href="/vendor/offers"
                />
              )}
              {vendor.verified && k.leadsThisMonth > 0 && (
                <ActionRow
                  label={`${k.leadsThisMonth} new lead${k.leadsThisMonth === 1 ? "" : "s"} this month`}
                  hint="See who redeemed and follow up"
                  href="/vendor/redemptions"
                />
              )}
              {!hasFocusItems && (
                <Box sx={{ px: 3, py: 2.5 }}>
                  <Typography sx={portalText.body}>
                    Nothing urgent. Consider adding a new offer to keep the listing fresh.
                  </Typography>
                </Box>
              )}
            </Stack>

            <Box sx={{ px: 3, pt: 2, pb: 1, borderTop: `1px solid ${CP.border}` }}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: MUTED }}>Latest redemptions</Typography>
                <TextLink href="/vendor/redemptions">See all</TextLink>
              </Stack>
            </Box>
            {redemptions.length === 0 ? (
              <Box sx={{ px: 3, pb: 3, pt: 1, color: MUTED, fontSize: "0.875rem", lineHeight: 1.6 }}>
                No redemptions yet. They&apos;ll appear here once members start using your offers.
              </Box>
            ) : (
              <Stack divider={<ListDivider />}>
                {redemptions.map((r) => (
                  <Box
                    key={r.id}
                    sx={{
                      ...(listRowSx as object),
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 1.5,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }} noWrap>
                        {r.member_display ?? "Member"}
                        {r.member_city ? `, ${r.member_city}` : ""}
                      </Typography>
                      <Typography sx={{ fontSize: "0.8125rem", color: MUTED }} noWrap>
                        {r.offers?.headline ?? ""}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontWeight: 700, color: INK, fontSize: "0.875rem", fontVariantNumeric: "tabular-nums" }}>
                        ${Number(r.amount_saved ?? 0).toLocaleString()}
                      </Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>
                        {r.redeemed_on}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard
            title="Your offers"
            subtitle="Status snapshot across all listings"
            padding="none"
            action={<TextLink href="/vendor/offers">Manage offers</TextLink>}
            sx={{ height: "100%" }}
          >
            {offers.length === 0 ? (
              <Box sx={{ px: 3, py: 3, color: MUTED, fontSize: "0.875rem", lineHeight: 1.6 }}>
                No offers yet.{" "}
                <Box
                  component={Link}
                  href="/vendor/catalog/new"
                  sx={{ color: NAVY, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                >
                  Add a catalog item first
                </Box>
                , then attach an offer to it.
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    display: { xs: "none", md: "grid" },
                    gridTemplateColumns: "minmax(0, 2fr) 110px 120px 170px",
                    gap: 1.5,
                    px: 3,
                    py: 1.25,
                    borderBottom: `1px solid ${CP.border}`,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: MUTED,
                  }}
                >
                  <Box>Offer</Box>
                  <Box sx={{ textAlign: "right" }}>Discount</Box>
                  <Box>Status</Box>
                  <Box>Valid</Box>
                </Box>
                <Stack divider={<ListDivider />}>
                  {offers.slice(0, 6).map((o) => (
                    <Box
                      key={o.id}
                      sx={{
                        ...(listRowSx as object),
                        display: { xs: "block", md: "grid" },
                        gridTemplateColumns: "minmax(0, 2fr) 110px 120px 170px",
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }} noWrap>
                          {o.headline}
                        </Typography>
                        <Typography sx={{ display: { xs: "block", md: "none" }, fontSize: "0.8125rem", color: MUTED, mt: 0.25 }}>
                          {o.discount_value} · {o.valid_from} to {o.valid_to}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{ display: { xs: "none", md: "block" }, fontSize: "0.875rem", fontWeight: 600, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                      >
                        {o.discount_value}
                      </Typography>
                      <Box sx={{ display: { xs: "inline-flex", md: "block" }, mt: { xs: 0.75, md: 0 } }}>
                        <StatusPill status={o.review_status} size="sm" />
                      </Box>
                      <Typography sx={{ display: { xs: "none", md: "block" }, fontSize: "0.8125rem", color: MUTED }}>
                        {o.valid_from} to {o.valid_to}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      {/* Pricing card: sand card with a navy header strip. Free founding
          months, then the flat rate. */}
      <SectionCard accent padding="none">
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 1.75, bgcolor: CP.navy, color: CP.ivory }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: CP.gold }} />
            <Typography sx={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#FFFFFF" }}>
              {isWebsite ? "Your rate" : "Founding company"}
            </Typography>
          </Stack>
          <HeroChip tone={isWebsite ? "neutral" : "gold"} label={isWebsite ? "Website" : "Founding"} />
        </Stack>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 2.5, md: 5 }}
          sx={{ alignItems: { md: "center" }, p: 3 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={portalText.body}>
              <Box component="strong" sx={{ color: INK, fontWeight: 700 }}>
                {hasTrial
                  ? freeUntilLabel
                    ? `Free until ${freeUntilLabel}, then ${ramp.rate} a month`
                    : `Free founding months, then ${ramp.rate} a month`
                  : `${ramp.rate} a month`}
              </Box>
              . Your rate never increases for as long as you are in the network.
              {hasTrial ? " We remind you 7 days before your first charge." : ""}
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={0}
            sx={{
              flexShrink: 0,
              bgcolor: CP.white,
              border: `1px solid ${CP.border}`,
              borderRadius: "12px",
              overflow: "hidden",
              width: { xs: "100%", md: "auto" },
            }}
          >
            {ramp.rows.map((row, i) => (
              <RampCell
                key={row.label}
                period={row.label}
                price={row.price}
                current={row.label === currentRow.label}
                last={i === ramp.rows.length - 1}
              />
            ))}
          </Stack>
        </Stack>
      </SectionCard>

      {/* Referral link, companies can share this on their own marketing */}
      <ReferralCard endpoint="/api/vendor/referral" accent={NAVY} />
    </Stack>
  );
}

function HeroChip({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: "success" | "warning" | "gold" | "neutral";
  icon?: React.ReactNode;
}) {
  const palette =
    tone === "gold"
      ? { bg: CP.gold, fg: CP.ink }
      : tone === "success"
        ? { bg: "rgba(34,197,94,0.18)", fg: "#BBF7D0" }
        : tone === "warning"
          ? { bg: "rgba(245,158,11,0.18)", fg: "#FDE68A" }
          : { bg: "rgba(255,255,255,0.10)", fg: CP.ivory };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.6,
        px: 1.1,
        height: 24,
        borderRadius: "8px",
        bgcolor: palette.bg,
        color: palette.fg,
        fontSize: "0.75rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

function RampCell({ period, price, current, last }: { period: string; price: string; current: boolean; last?: boolean }) {
  return (
    <Box
      sx={{
        flex: 1,
        px: { xs: 1.5, md: 2.25 },
        py: 1.5,
        minWidth: { md: 118 },
        borderRight: last ? 0 : `1px solid ${CP.border}`,
        bgcolor: current ? CP.goldTint : "transparent",
        textAlign: "center",
      }}
    >
      <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: current ? CP.goldText : MUTED, whiteSpace: "nowrap" }}>{period}</Typography>
      <Typography sx={{ fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2, mt: 0.25, fontVariantNumeric: "tabular-nums" }}>
        {price}
        <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 500, color: MUTED }}>/mo</Box>
      </Typography>
    </Box>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: NAVY,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        "&:hover": { textDecoration: "underline" },
      }}
    >
      {children} <ArrowForwardIcon sx={{ fontSize: 14 }} />
    </Box>
  );
}

function ActionRow({ label, hint, href }: { label: string; hint?: string; href: string }) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        ...(listRowSx as object),
        display: "flex",
        gap: 1.5,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: CP.gold, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK, lineHeight: 1.4 }}>{label}</Typography>
        {hint && <Typography sx={{ fontSize: "0.8125rem", color: MUTED, lineHeight: 1.4 }}>{hint}</Typography>}
      </Box>
      <ChevronRightRoundedIcon sx={{ fontSize: 18, color: CP.faint }} />
    </Box>
  );
}
