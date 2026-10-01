"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchCurrentVendor,
  fetchVendorKpis,
  fetchVendorRedemptions,
  type RedemptionWithOffer,
  type VendorKpis,
} from "@/lib/supabase/vendorQueries";
import {
  EmptyState,
  ListDivider,
  PageHeader,
  SectionCard,
  StatCard,
  listHeadSx,
  listRowSx,
  portalText,
} from "@/components/vendor/PortalUI";
import { CP } from "@/components/shared/CommunityPortalShell";

const INK = CP.ink;
const BODY = CP.body;
const MUTED = CP.muted;
const FAINT = CP.faint;

const GRID_COLUMNS = "minmax(0, 1.5fr) minmax(0, 2fr) 120px 150px 48px";

export default function RedemptionsPage() {
  const [loading, setLoading] = useState(true);
  const [redemptions, setRedemptions] = useState<RedemptionWithOffer[]>([]);
  const [kpis, setKpis] = useState<VendorKpis | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();
    (async () => {
      const v = await fetchCurrentVendor(supabase);
      if (!active) return;
      if (!v) {
        setLoading(false);
        return;
      }
      const [k, r] = await Promise.all([
        fetchVendorKpis(supabase, v.id),
        fetchVendorRedemptions(supabase, v.id),
      ]);
      if (!active) return;
      setKpis(k);
      setRedemptions(r);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return redemptions;
    return redemptions.filter(
      (r) =>
        (r.member_display ?? "").toLowerCase().includes(ql) ||
        (r.member_city ?? "").toLowerCase().includes(ql) ||
        (r.offers?.headline ?? "").toLowerCase().includes(ql),
    );
  }, [redemptions, q]);

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 10, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography sx={portalText.meta}>Loading redemptions...</Typography>
      </Stack>
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

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Redemptions"
        subtitle="Member identities are anonymized to first name and city. Use this view to verify attribution on your monthly company report."
        actions={
          <Button variant="outlined" startIcon={<DownloadOutlinedIcon sx={{ fontSize: 16 }} />}>
            Export CSV
          </Button>
        }
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={ReceiptLongOutlinedIcon}
            accent="gold"
            label="Redemptions this month"
            value={String(k.redemptionsThisMonth)}
            footer={`${k.redemptionsLifetime} lifetime`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={SavingsOutlinedIcon}
            accent="green"
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
            icon={TrendingUpRoundedIcon}
            accent="gold"
            label="Average savings per redemption"
            value={
              k.redemptionsLifetime > 0
                ? `$${Math.round(k.savingsDeliveredLifetime / k.redemptionsLifetime).toLocaleString()}`
                : "$0"
            }
            footer="Lifetime average"
          />
        </Grid>
      </Grid>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
        <Typography sx={portalText.sectionTitle}>
          Recent activity · {filtered.length} {filtered.length === 1 ? "row" : "rows"}
        </Typography>
        <TextField
          size="small"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search member, offer, city"
          sx={{ width: { xs: "100%", md: 320 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon sx={{ fontSize: 16, color: FAINT }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ReceiptLongOutlinedIcon}
          title={redemptions.length === 0 ? "No redemptions yet" : "No matches"}
          body={
            redemptions.length === 0
              ? "Redemptions will appear here once members start using your offers."
              : "Adjust the search to see redemptions."
          }
        />
      ) : (
        <SectionCard padding="none">
          <Box
            sx={{
              ...(listHeadSx as object),
              display: { xs: "none", md: "grid" },
              gridTemplateColumns: GRID_COLUMNS,
              gap: 1,
            }}
          >
            <Box>Member</Box>
            <Box>Offer</Box>
            <Box>Date</Box>
            <Box sx={{ textAlign: "right" }}>Saved</Box>
            <Box />
          </Box>
          <Stack divider={<ListDivider />}>
            {filtered.map((r) => (
              <Box
                key={r.id}
                sx={{
                  ...(listRowSx as object),
                  display: { xs: "block", md: "grid" },
                  gridTemplateColumns: GRID_COLUMNS,
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }} noWrap>
                    {r.member_display ?? "Member"}
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: MUTED }} noWrap>
                    {r.member_city ?? ""}
                  </Typography>
                </Box>
                <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.875rem", color: BODY }} noWrap>
                    {r.offers?.headline ?? ""}
                  </Typography>
                </Box>
                <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.8125rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {r.redeemed_on}
                </Box>
                <Box sx={{ display: { xs: "none", md: "block" }, textAlign: "right" }}>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                    ${Number(r.amount_saved ?? 0).toLocaleString()}
                  </Typography>
                  <Typography sx={{ ...portalText.meta, fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
                    +${Number(r.commission_accrued ?? 0).toLocaleString()} commission
                  </Typography>
                </Box>
                <Box sx={{ display: { xs: "none", md: "flex" }, justifyContent: "flex-end" }}>
                  <Tooltip title="Open redemption">
                    <IconButton size="small">
                      <OpenInNewOutlinedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Stack direction="row" spacing={1.5} sx={{ display: { xs: "flex", md: "none" }, mt: 0.5, flexWrap: "wrap", rowGap: 0.5 }}>
                  <Typography sx={{ fontSize: "0.8125rem", color: BODY }} noWrap>
                    {r.offers?.headline ?? ""}
                  </Typography>
                  <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>{r.redeemed_on}</Typography>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                    ${Number(r.amount_saved ?? 0).toLocaleString()}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </SectionCard>
      )}

      <Typography sx={portalText.meta}>
        Attribution windows follow the ASN Provider Agreement. To dispute a redemption, email partners@aestheticsuccessnetwork.com and we resolve it within 5 business days.
      </Typography>
    </Stack>
  );
}
