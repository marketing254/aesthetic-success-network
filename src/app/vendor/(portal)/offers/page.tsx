"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import MedicalServicesOutlinedIcon from "@mui/icons-material/MedicalServicesOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchCurrentVendor,
  fetchVendorCatalog,
  fetchVendorOffers,
  type CatalogItemWithMedia,
  type OfferWithCatalog,
} from "@/lib/supabase/vendorQueries";
import type { CatalogItemsRow, ReviewStatus } from "@/lib/supabase/types";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusPill,
  TagPill,
  portalText,
} from "@/components/vendor/PortalUI";

const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const LINE = "#E5E7EB";
const ROW_HOVER = "#F9FAFB";
const SOFT = "#F3F4F6";
const NAVY = "#0E2A3D";
const NAVY_TINT = "rgba(14,42,61,0.08)";

const GRID_COLUMNS = "minmax(0, 2.5fr) 130px 120px 150px 130px 56px";

type CatalogType = CatalogItemsRow["type"];

function TypeIcon({ type, size = 16 }: { type: CatalogType; size?: number }) {
  const Icon =
    type === "service"
      ? MedicalServicesOutlinedIcon
      : type === "product"
        ? Inventory2OutlinedIcon
        : SchoolOutlinedIcon;
  return <Icon sx={{ fontSize: size }} />;
}

type StatusFilter = "all" | ReviewStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approved", label: "Live" },
  { key: "pending_review", label: "In review" },
  { key: "draft", label: "Draft" },
  { key: "rejected", label: "Rejected" },
];

export default function VendorOffersPage() {
  const [loading, setLoading] = useState(true);
  const [hasCatalog, setHasCatalog] = useState(false);
  const [offers, setOffers] = useState<OfferWithCatalog[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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

      const [catalogData, offerData] = await Promise.all([
        fetchVendorCatalog(supabase, v.id),
        fetchVendorOffers(supabase, v.id),
      ]);
      if (!active) return;
      setHasCatalog((catalogData as CatalogItemWithMedia[]).length > 0);
      setOffers(offerData);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const acc: Record<StatusFilter, number> = {
      all: offers.length,
      approved: 0,
      pending_review: 0,
      draft: 0,
      rejected: 0,
      needs_changes: 0,
    };
    for (const o of offers) acc[o.review_status] += 1;
    return acc;
  }, [offers]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return offers.filter((o) => {
      if (statusFilter !== "all" && o.review_status !== statusFilter) return false;
      if (!ql) return true;
      return (
        o.headline.toLowerCase().includes(ql) ||
        (o.promo_code ?? "").toLowerCase().includes(ql) ||
        (o.catalog_items?.name ?? "").toLowerCase().includes(ql)
      );
    });
  }, [offers, statusFilter, q]);

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 8, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography sx={portalText.meta}>Loading offers…</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Offers"
        subtitle="Each offer is a discount or bonus on top of a service, product, or course you list. Our team reviews new offers before they go live to members."
        actions={
          <Button
            component={Link}
            href="/vendor/offers/new"
            variant="contained"
            disabled={!hasCatalog}
            startIcon={<AddCircleOutlineOutlinedIcon sx={{ fontSize: 16 }} />}
          >
            Create offer
          </Button>
        }
      />

      {!hasCatalog ? (
        <EmptyState
          icon={Inventory2OutlinedIcon}
          title="Add a catalog item first"
          body="Offers attach to a service, product, or course. Add one to your catalog first."
          action={
            <Button component={Link} href="/vendor/catalog/new" variant="contained">
              Add catalog item
            </Button>
          }
        />
      ) : (
        <>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
          >
            <Tabs
              value={statusFilter}
              onChange={(_, v) => setStatusFilter(v)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ borderBottom: `1px solid ${LINE}`, flex: 1, minWidth: 0 }}
            >
              {STATUS_FILTERS.map((t) => (
                <Tab
                  key={t.key}
                  value={t.key}
                  label={
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <span>{t.label}</span>
                      <Box
                        component="span"
                        sx={{
                          bgcolor: statusFilter === t.key ? NAVY_TINT : SOFT,
                          color: statusFilter === t.key ? NAVY : MUTED,
                          borderRadius: "6px",
                          px: 0.75,
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          minWidth: 20,
                          textAlign: "center",
                          lineHeight: "18px",
                        }}
                      >
                        {counts[t.key]}
                      </Box>
                    </Stack>
                  }
                />
              ))}
            </Tabs>
            <TextField
              size="small"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search offers"
              sx={{ width: { xs: "100%", md: 280 }, flexShrink: 0 }}
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
              icon={LocalOfferOutlinedIcon}
              title="No offers match"
              body="Try a different filter or clear your search."
            />
          ) : (
            <SectionCard padding="none">
              <Box
                sx={{
                  display: { xs: "none", md: "grid" },
                  gridTemplateColumns: GRID_COLUMNS,
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 1.25,
                  borderBottom: `1px solid ${LINE}`,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: MUTED,
                  letterSpacing: 0,
                  textTransform: "none",
                }}
              >
                <Box>Offer and catalog item</Box>
                <Box>Discount</Box>
                <Box>Status</Box>
                <Box>Validity</Box>
                <Box>Promo code</Box>
                <Box />
              </Box>
              <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
                {filtered.map((o) => (
                  <OfferRow key={o.id} offer={o} />
                ))}
              </Stack>
            </SectionCard>
          )}

          <Typography sx={portalText.meta}>
            New offers go through team review within 24 business hours.
          </Typography>
        </>
      )}
    </Stack>
  );
}

function OfferRow({ offer }: { offer: OfferWithCatalog }) {
  const item = offer.catalog_items;
  return (
    <Box
      sx={{
        display: { xs: "block", md: "grid" },
        gridTemplateColumns: GRID_COLUMNS,
        alignItems: "center",
        px: 2,
        py: 1.5,
        gap: 1,
        "&:hover": { bgcolor: ROW_HOVER },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }} noWrap>
          {offer.headline}
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
          {item && (
            <>
              <Box sx={{ color: FAINT, display: "inline-flex" }}>
                <TypeIcon type={item.type} size={13} />
              </Box>
              <Typography sx={{ fontSize: "0.75rem", color: MUTED }} noWrap>
                {item.name}
              </Typography>
            </>
          )}
          <Typography sx={{ fontSize: "0.75rem", color: FAINT }}>·</Typography>
          <TagPill label={`limit ${offer.redemption_limit_per_member}`} tone="neutral" size="sm" />
        </Stack>
        {offer.review_note && (
          <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 0.5 }}>
            Team note: {offer.review_note}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }} noWrap>
          {offer.discount_value}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <StatusPill status={offer.review_status} size="sm" />
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Typography sx={{ fontSize: "0.8125rem", color: BODY }} noWrap>
          {offer.valid_from}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: MUTED }} noWrap>
          to {offer.valid_to}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Box
            component="span"
            sx={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: offer.promo_code ? BODY : FAINT,
              px: 0.75,
              py: 0.25,
              borderRadius: "6px",
              bgcolor: SOFT,
            }}
          >
            {offer.promo_code || "No code"}
          </Box>
          {offer.promo_code && (
            <Tooltip title="Copy code">
              <IconButton size="small">
                <ContentCopyOutlinedIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Tooltip title="Edit offer">
          <IconButton size="small">
            <EditOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          display: { xs: "flex", md: "none" },
          flexWrap: "wrap",
          rowGap: 0.5,
          mt: 1,
          gridColumn: "1 / -1",
        }}
      >
        <StatusPill status={offer.review_status} size="sm" />
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: INK }}>
          {offer.discount_value}
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>
          {offer.valid_from} to {offer.valid_to}
        </Typography>
      </Stack>
    </Box>
  );
}
