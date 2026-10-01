"use client";
import { useEffect, useState } from "react";
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
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";

type Overview = {
  vendors: { total: number; pending: number; approved: number; suspended: number; rejected: number; verified: number };
  members: { total: number; active: number; thisWeek: number };
  waitlist: { total: number; members: number; vendors: number; last24h: number };
  offers: { pending: number; approved: number; total: number };
  catalog: { pending: number; approved: number; total: number };
  redemptions: { lifetimeCount: number; thisMonthCount: number; lifetimeSavings: number };
  recentApplications: {
    id: string;
    company_name: string;
    contact_name: string;
    contact_email: string;
    status: string;
    created_at: string;
    vendor_id: string | null;
  }[];
  pendingOffers: {
    id: string;
    headline: string;
    discount_value: string;
    review_status: string;
    catalog_items: { name: string; type: string } | null;
  }[];
  foundingCap: number;
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/overview", { cache: "no-store" });
        const body = (await res.json()) as Overview & { error?: string };
        if (!active) return;
        if (!res.ok || body.error) {
          setError(body.error ?? `Failed to load (${res.status})`);
          return;
        }
        setData(body);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress size={28} sx={{ color: "#A07823" }} />
      </Stack>
    );
  }

  if (error || !data) {
    return (
      <Stack spacing={2} sx={{ py: 4 }}>
        <Typography sx={{ color: "error.main" }}>Could not load overview.</Typography>
        <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>{error}</Typography>
      </Stack>
    );
  }

  const foundingProgress =
    data.foundingCap > 0 ? (data.members.total / data.foundingCap) * 100 : 0;

  return (
    <Stack spacing={4}>
      {/* Header */}
      <Box>
        <Typography variant="overline" sx={{ display: "block" }}>
          ADMIN OVERVIEW
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Operations dashboard
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 720 }}>
          Live state of the network. Action queues are highlighted first; clear those before scrolling.
        </Typography>
      </Box>

      {/* Action queues */}
      <Box>
        <Typography variant="overline" sx={{ color: "#A07823", display: "block", fontWeight: 700, letterSpacing: "0.18em", mb: 1.5 }}>
          NEEDS YOUR ATTENTION
        </Typography>
        <Grid container spacing={2.5}>
          <ActionQueue
            icon={StoreOutlinedIcon}
            label="Company approvals"
            count={data.vendors.pending}
            detail="pending review"
            href="/admin/vendors?filter=pending_review"
            urgency={data.vendors.pending > 0 ? "high" : "normal"}
          />
          <ActionQueue
            icon={LocalOfferOutlinedIcon}
            label="Offer reviews"
            count={data.offers.pending}
            detail="awaiting review"
            href="/admin/offers"
            urgency={data.offers.pending > 0 ? "high" : "normal"}
          />
          <ActionQueue
            icon={Inventory2OutlinedIcon}
            label="Catalog reviews"
            count={data.catalog.pending}
            detail="awaiting review"
            href="/admin/content"
            urgency={data.catalog.pending > 0 ? "high" : "normal"}
          />
          <ActionQueue
            icon={MarkEmailReadOutlinedIcon}
            label="Waitlist · 24h"
            count={data.waitlist.last24h}
            detail="new signups"
            href="/admin/waitlist"
          />
        </Grid>
      </Box>

      {/* KPI cards */}
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block", fontWeight: 700, letterSpacing: "0.18em", mb: 1.5 }}>
          KEY METRICS
        </Typography>
        <Grid container spacing={2.5}>
          <Stat
            icon={PeopleAltOutlinedIcon}
            label="Total members"
            value={`${data.members.total}`}
            footer={`${foundingProgress.toFixed(1)}% of founding cap (${data.foundingCap}) · ${data.members.thisWeek} this week`}
          />
          <Stat
            icon={StoreOutlinedIcon}
            label="Active companies"
            value={`${data.vendors.approved}`}
            footer={`${data.vendors.pending} pending · ${data.vendors.verified} verified · ${data.vendors.total} total`}
            accent="secondary"
          />
          <Stat
            icon={TrendingUpOutlinedIcon}
            label="Redemptions · MTD"
            value={`${data.redemptions.thisMonthCount}`}
            footer={`${data.redemptions.lifetimeCount} lifetime`}
          />
          <Stat
            icon={SavingsOutlinedIcon}
            label="Company savings · lifetime"
            value={`$${data.redemptions.lifetimeSavings.toLocaleString()}`}
            footer={`${data.offers.approved} active offers in market`}
            accent="secondary"
          />
        </Grid>
      </Box>

      {/* Founding progress */}
      <Box
        sx={{
          p: { xs: 2.75, md: 3.5 },
          borderRadius: "18px",
          backgroundImage: "linear-gradient(135deg, #06182A 0%, #0E2A3D 50%, #1B4258 100%)",
          color: "common.white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(40% 40% at 80% 0%, rgba(217,168,75,0.4) 0%, transparent 60%)",
          }}
        />
        <Grid container spacing={3} sx={{ position: "relative", alignItems: "center" }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="overline" sx={{ color: "secondary.light", display: "block", fontWeight: 700 }}>
              FOUNDING COHORT
            </Typography>
            <Typography variant="h3" sx={{ color: "common.white", fontSize: { xs: "1.85rem", md: "2.5rem" }, mt: 0.5, mb: 1 }}>
              {data.members.total} of {data.foundingCap.toLocaleString()} seats claimed
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.85)", maxWidth: 540 }}>
              Once the founding cap fills, post-cap members pay the standard rate. Founding rate is locked once allocated.
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ p: 2.75, borderRadius: "18px", bgcolor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)" }}>
              <Typography sx={{ fontFamily: "var(--font-display)", color: "secondary.light", fontSize: "2.5rem", lineHeight: 1, mb: 1 }}>
                {foundingProgress.toFixed(1)}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, foundingProgress)}
                sx={{
                  height: 6,
                  borderRadius: 999,
                  bgcolor: "rgba(255,255,255,0.18)",
                  mb: 1.25,
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999,
                    backgroundImage: "linear-gradient(90deg, #D9A84B 0%, #F0C16E 100%)",
                  },
                }}
              />
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)", fontSize: "0.82rem" }}>
                {Math.max(0, data.foundingCap - data.members.total)} seats remaining
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Recent activity */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Box
            sx={{
              borderRadius: "18px",
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "common.white",
              overflow: "hidden",
            }}
          >
            <Box sx={{ p: 2.75, borderBottom: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                <Box>
                  <Typography variant="overline" sx={{ display: "block" }}>
                    COMPANIES
                  </Typography>
                  <Typography variant="h5">Recent applications</Typography>
                </Box>
                <Box component={Link} href="/admin/vendors" sx={{ color: "primary.main", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  Open queue <ArrowForwardIcon sx={{ fontSize: 16 }} />
                </Box>
              </Stack>
            </Box>
            {data.recentApplications.length === 0 ? (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                No applications yet.
              </Box>
            ) : (
              <Stack divider={<Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />}>
                {data.recentApplications.map((a) => (
                  <Box key={a.id} sx={{ p: 2 }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1.5 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.75} sx={{ mb: 0.5, flexWrap: "wrap" }}>
                          <VendorStatusChip status={a.status} />
                        </Stack>
                        <Typography sx={{ fontSize: "0.92rem", fontWeight: 600 }}>
                          {a.company_name}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary", mt: 0.25 }}>
                          {a.contact_name} · {a.contact_email}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary", flexShrink: 0 }}>
                        {a.created_at.slice(0, 10)}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Box
            sx={{
              borderRadius: "18px",
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "common.white",
              overflow: "hidden",
            }}
          >
            <Box sx={{ p: 2.75, borderBottom: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                <Box>
                  <Typography variant="overline" sx={{ display: "block" }}>
                    OFFER REVIEW
                  </Typography>
                  <Typography variant="h5">Pending company offers</Typography>
                </Box>
                <Box component={Link} href="/admin/offers" sx={{ color: "primary.main", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  Review <ArrowForwardIcon sx={{ fontSize: 16 }} />
                </Box>
              </Stack>
            </Box>
            <Stack divider={<Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />}>
              {data.pendingOffers.map((o) => (
                <Stack key={o.id} direction="row" sx={{ p: 2, alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.92rem", fontWeight: 600 }} noWrap>
                      {o.headline}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary" }} noWrap>
                      {o.catalog_items?.name ?? "catalog item"} · {o.discount_value}
                    </Typography>
                  </Box>
                  <Button component={Link} href="/admin/offers" variant="outlined" color="primary" size="small">
                    Review
                  </Button>
                </Stack>
              ))}
              {data.pendingOffers.length === 0 && (
                <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                  <Typography variant="body2">No pending offers, queue is clear.</Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Stack>
  );
}

function ActionQueue({
  icon: Icon,
  label,
  count,
  detail,
  href,
  urgency,
}: {
  icon: React.ElementType<{ sx?: object }>;
  label: string;
  count: number;
  detail: string;
  href: string;
  urgency?: "critical" | "high" | "normal";
}) {
  const tint = urgency === "critical"
    ? { bg: "rgba(140,29,29,0.12)", border: "rgba(140,29,29,0.32)", color: "#8C1D1D" }
    : urgency === "high"
      ? { bg: "rgba(217,168,75,0.16)", border: "rgba(217,168,75,0.4)", color: "#A07823" }
      : { bg: "rgba(14,42,61,0.07)", border: "rgba(14,42,61,0.18)", color: "#0E2A3D" };

  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <Box
        component={Link}
        href={href}
        sx={{
          display: "block",
          textDecoration: "none",
          height: "100%",
          p: 2.5,
          borderRadius: "18px",
          border: "1px solid",
          borderColor: tint.border,
          bgcolor: tint.bg,
          transition: "transform 200ms ease, box-shadow 200ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 16px 32px -20px rgba(14,42,61,0.3)",
          },
        }}
      >
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: "10px", bgcolor: "rgba(255,255,255,0.7)", display: "grid", placeItems: "center", color: tint.color }}>
            <Icon sx={{ fontSize: 18 }} />
          </Box>
          <ArrowForwardIcon sx={{ fontSize: 18, color: tint.color }} />
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "2.1rem", color: tint.color, lineHeight: 1 }}>
            {count}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "0.78rem", color: tint.color, fontWeight: 600 }}>
            {detail}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: tint.color, mt: 0.5 }}>
          {label}
        </Typography>
      </Box>
    </Grid>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  footer,
  accent = "primary",
}: {
  icon: React.ElementType<{ sx?: object }>;
  label: string;
  value: string;
  footer?: string;
  accent?: "primary" | "secondary";
}) {
  const tint =
    accent === "secondary"
      ? { bg: "rgba(217,168,75,0.12)", border: "rgba(217,168,75,0.32)", color: "#A07823" }
      : { bg: "rgba(14,42,61,0.07)", border: "rgba(14,42,61,0.18)", color: "#0E2A3D" };
  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      <Box
        sx={{
          height: "100%",
          p: 2.75,
          borderRadius: "18px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
        }}
      >
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary", letterSpacing: "0.04em", fontWeight: 600, textTransform: "uppercase" }}>
            {label}
          </Typography>
          <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: tint.bg, border: `1px solid ${tint.border}`, display: "grid", placeItems: "center", color: tint.color }}>
            <Icon sx={{ fontSize: 18 }} />
          </Box>
        </Stack>
        <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "2.1rem", lineHeight: 1, color: "text.primary" }}>
          {value}
        </Typography>
        {footer && (
          <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary" }}>
            {footer}
          </Typography>
        )}
      </Box>
    </Grid>
  );
}

function VendorStatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending_review: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "Pending" },
    approved: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "Approved" },
    suspended: { bg: "rgba(140,29,29,0.12)", color: "#8C1D1D", label: "Suspended" },
    rejected: { bg: "rgba(140,29,29,0.08)", color: "#8C1D1D", label: "Rejected" },
  };
  const s = map[status] ?? map.pending_review;
  return (
    <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.62rem", height: 20 }} />
  );
}
