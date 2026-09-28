"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
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
import { PageHeader, SectionCard, StatCard, StatusPill, TagPill, portalText } from "@/components/vendor/PortalUI";
import ReferralCard from "@/components/shared/ReferralCard";

const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";
const NAVY_HOVER = "#0B2232";
const HOVER = "#F9FAFB";

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

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 8, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography sx={portalText.meta}>Loading your dashboard…</Typography>
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
                sx={{ color: NAVY, fontWeight: 500, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                /vendor/login
              </Box>{" "}
              and request a fresh magic link.
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

  const monthsLeftInWaiver = Math.max(0, 6 - vendor.months_in_program);
  const waiverProgress = Math.min(100, (vendor.months_in_program / 6) * 100);
  const planLabel = vendor.plan_id?.toUpperCase() ?? "FOUNDING";

  const subtitle =
    k.redemptionsThisMonth > 0
      ? `You delivered $${k.savingsDeliveredMonth.toLocaleString()} in member savings this month across ${k.redemptionsThisMonth} redemptions.`
      : vendor.verified
        ? "No member redemptions yet this month. Add or refresh an offer to keep your listing fresh."
        : "Your application is under team review. You can set up your catalog and draft offers now; they'll go live to members once your profile is approved.";

  return (
    <Stack spacing={3}>
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle={subtitle}
        actions={
          <Button
            component={Link}
            href="/vendor/offers/new"
            variant="contained"
            startIcon={<AddCircleOutlineOutlinedIcon sx={{ fontSize: 16 }} />}
          >
            Create offer
          </Button>
        }
      />

      {/* Status markers */}
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}>
        <Chip
          size="small"
          color={vendor.verified ? "success" : "warning"}
          label={vendor.verified ? "Verified company" : "Pending review"}
        />
        {planLabel === "FOUNDING" ? (
          <TagPill label="Founding" tone="gold" size="sm" />
        ) : (
          <TagPill label={planLabel} tone="neutral" size="sm" />
        )}
        <TagPill label={`Month ${vendor.months_in_program}/12`} tone="neutral" size="sm" />
      </Stack>

      {/* KPI tiles */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={ReceiptLongOutlinedIcon}
            label="Redemptions, MTD"
            value={String(k.redemptionsThisMonth)}
            footer={`${k.redemptionsLifetime} lifetime`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={SavingsOutlinedIcon}
            label="Savings delivered, MTD"
            value={`$${k.savingsDeliveredMonth.toLocaleString()}`}
            footer={`$${k.savingsDeliveredLifetime.toLocaleString()} lifetime`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={GroupsOutlinedIcon}
            label="Inbound leads, MTD"
            value={String(k.leadsThisMonth)}
            footer="Bookings + hotline"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={LocalOfferOutlinedIcon}
            label="Active offers"
            value={String(k.activeOffersCount)}
            footer={`${k.pendingOffersCount} pending review`}
          />
        </Grid>
      </Grid>

      {/* Founding waiver */}
      <SectionCard title="Founding waiver" padding="default">
        <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
          <Typography sx={portalText.body}>
            <Box component="strong" sx={{ color: INK, fontWeight: 600 }}>
              {monthsLeftInWaiver}
            </Box>{" "}
            month{monthsLeftInWaiver === 1 ? "" : "s"} left at $0/mo
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={waiverProgress} />
        <Typography sx={{ ...portalText.meta, mt: 1 }}>
          From month 7 you bill at $29/mo (launch rate locked).
        </Typography>
      </SectionCard>

      {/* Referral link, partners can share this on their own marketing */}
      <ReferralCard endpoint="/api/vendor/referral" accent={NAVY} />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="This week" subtitle="Where to focus" padding="default">
            <Stack spacing={1.25}>
              {!vendor.verified && (
                <ActionRow label="Your application is under review by the team" href="/vendor/agreement" />
              )}
              {k.pendingOffersCount > 0 && (
                <ActionRow
                  label={`${k.pendingOffersCount} offer${k.pendingOffersCount === 1 ? "" : "s"} pending team review`}
                  href="/vendor/offers"
                />
              )}
              {vendor.verified && k.leadsThisMonth > 0 && (
                <ActionRow
                  label={`${k.leadsThisMonth} new lead${k.leadsThisMonth === 1 ? "" : "s"} this month`}
                  href="/vendor/redemptions"
                />
              )}
              {vendor.verified && k.pendingOffersCount === 0 && k.leadsThisMonth === 0 && (
                <Typography sx={portalText.body}>
                  Nothing urgent. Consider adding a new offer to keep the listing fresh.
                </Typography>
              )}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard
            title="Recent redemptions"
            subtitle="Latest members using your offers"
            padding="none"
            action={<TextLink href="/vendor/redemptions">See all</TextLink>}
          >
            {redemptions.length === 0 ? (
              <Box sx={{ px: 3, py: 3, color: MUTED, fontSize: "0.875rem" }}>
                No redemptions yet. They&apos;ll appear here once members start using your offers.
              </Box>
            ) : (
              <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
                {redemptions.map((r) => (
                  <Box
                    key={r.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      px: 3,
                      py: 1.5,
                      "&:hover": { bgcolor: HOVER },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK }} noWrap>
                        {r.member_display ?? "Member"}
                        {r.member_city ? `, ${r.member_city}` : ""}
                      </Typography>
                      <Typography sx={{ fontSize: "0.8125rem", color: MUTED }} noWrap>
                        {r.offers?.headline ?? ""}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ fontWeight: 600, color: INK, fontSize: "0.875rem", fontVariantNumeric: "tabular-nums" }}>
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

        <Grid size={{ xs: 12 }}>
          <SectionCard
            title="Your offers"
            subtitle="Status snapshot across all listings"
            padding="none"
            action={<TextLink href="/vendor/offers">Manage offers</TextLink>}
          >
            {offers.length === 0 ? (
              <Box sx={{ px: 3, py: 3, color: MUTED, fontSize: "0.875rem" }}>
                No offers yet.{" "}
                <Box
                  component={Link}
                  href="/vendor/catalog/new"
                  sx={{ color: NAVY, fontWeight: 500, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
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
                    gridTemplateColumns: "minmax(0, 2fr) 130px 110px 180px",
                    px: 3,
                    py: 1.25,
                    borderBottom: `1px solid ${LINE}`,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: MUTED,
                    letterSpacing: 0,
                    textTransform: "none",
                  }}
                >
                  <Box>Offer</Box>
                  <Box>Discount</Box>
                  <Box>Status</Box>
                  <Box>Valid</Box>
                </Box>
                <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
                  {offers.slice(0, 5).map((o) => (
                    <Box
                      key={o.id}
                      sx={{
                        display: { xs: "block", md: "grid" },
                        gridTemplateColumns: "minmax(0, 2fr) 130px 110px 180px",
                        alignItems: "center",
                        px: 3,
                        py: 1.5,
                        "&:hover": { bgcolor: HOVER },
                      }}
                    >
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK }} noWrap>
                        {o.headline}
                      </Typography>
                      <Typography sx={{ display: { xs: "none", md: "block" }, fontSize: "0.875rem", fontWeight: 500, color: INK }}>
                        {o.discount_value}
                      </Typography>
                      <Box sx={{ display: { xs: "none", md: "block" } }}>
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
    </Stack>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        fontSize: "0.875rem",
        fontWeight: 500,
        color: NAVY,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        "&:hover": { color: NAVY_HOVER, textDecoration: "underline" },
      }}
    >
      {children} <ArrowForwardIcon sx={{ fontSize: 14 }} />
    </Box>
  );
}

function ActionRow({ label, href }: { label: string; href: string }) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        borderRadius: "6px",
        bgcolor: "#FFFFFF",
        border: `1px solid ${LINE}`,
        textDecoration: "none",
        color: "inherit",
        "&:hover": { bgcolor: HOVER },
      }}
    >
      <Typography sx={{ flex: 1, fontSize: "0.875rem", color: INK, lineHeight: 1.4 }}>{label}</Typography>
      <ArrowForwardIcon sx={{ fontSize: 16, color: NAVY }} />
    </Box>
  );
}
