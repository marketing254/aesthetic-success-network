"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import MedicalServicesOutlinedIcon from "@mui/icons-material/MedicalServicesOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchCurrentVendor,
  fetchVendorCatalog,
  type CatalogItemWithMedia,
} from "@/lib/supabase/vendorQueries";
import type { CatalogItemsRow } from "@/lib/supabase/types";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusPill,
  TagPill,
} from "@/components/vendor/PortalUI";

const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";
const HOVER_ROW = "#F9FAFB";
const FILL = "#F3F4F6";

type CatalogType = CatalogItemsRow["type"];

const TYPE_FILTERS: { key: "all" | CatalogType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "service", label: "Services" },
  { key: "product", label: "Products" },
  { key: "course", label: "Courses" },
];

function TypeIcon({ type, size = 16 }: { type: CatalogType; size?: number }) {
  const Icon =
    type === "service"
      ? MedicalServicesOutlinedIcon
      : type === "product"
        ? Inventory2OutlinedIcon
        : SchoolOutlinedIcon;
  return <Icon sx={{ fontSize: size }} />;
}

const GRID_COLUMNS = "56px minmax(0, 2fr) 120px 120px 120px 80px 32px";

export default function VendorCatalogPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CatalogItemWithMedia[]>([]);
  const [filter, setFilter] = useState<"all" | CatalogType>("all");
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
      const data = await fetchVendorCatalog(supabase, v.id);
      if (!active) return;
      setItems(data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return items.filter((c) => {
      if (filter !== "all" && c.type !== filter) return false;
      if (!ql) return true;
      return (
        c.name.toLowerCase().includes(ql) ||
        c.category.toLowerCase().includes(ql) ||
        (c.tagline ?? "").toLowerCase().includes(ql)
      );
    });
  }, [items, filter, q]);

  const counts = useMemo(() => {
    const acc = { all: items.length, service: 0, product: 0, course: 0 };
    for (const c of items) acc[c.type] += 1;
    return acc;
  }, [items]);

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 8, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography sx={{ color: MUTED, fontSize: "0.875rem" }}>Loading catalog…</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Catalog"
        subtitle="Your services, products and courses. Each row is one listing. Open a row to see details, media and attached offers."
        actions={
          <Button
            component={Link}
            href="/vendor/catalog/new"
            variant="contained"
            startIcon={<AddOutlinedIcon sx={{ fontSize: 18 }} />}
          >
            Add item
          </Button>
        }
      />

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Tabs
          value={filter}
          onChange={(_, v) => setFilter(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ minHeight: 40, borderBottom: `1px solid ${LINE}`, flex: 1 }}
        >
          {TYPE_FILTERS.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <span>{t.label}</span>
                  <Box
                    component="span"
                    sx={{
                      bgcolor: filter === t.key ? "rgba(14,42,61,0.08)" : FILL,
                      color: filter === t.key ? NAVY : BODY,
                      borderRadius: "6px",
                      px: 0.75,
                      minWidth: 20,
                      height: 20,
                      display: "inline-grid",
                      placeItems: "center",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      lineHeight: 1,
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
          placeholder="Search items"
          sx={{ width: { xs: "100%", md: 280 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon sx={{ fontSize: 18, color: FAINT }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      {rows.length === 0 ? (
        q || filter !== "all" ? (
          <EmptyState icon={SearchOutlinedIcon} title="No results" body="Adjust the filter or search." />
        ) : (
          <EmptyState
            icon={Inventory2OutlinedIcon}
            title="Nothing here yet"
            body="Add the services, products, or courses you want to offer through the network."
            action={
              <Button
                component={Link}
                href="/vendor/catalog/new"
                variant="contained"
                startIcon={<AddOutlinedIcon sx={{ fontSize: 18 }} />}
              >
                Add your first item
              </Button>
            }
          />
        )
      ) : (
        <SectionCard padding="none">
          <Box
            sx={{
              display: { xs: "none", md: "grid" },
              gridTemplateColumns: GRID_COLUMNS,
              alignItems: "center",
              gap: 1.5,
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
            <Box />
            <Box>Name</Box>
            <Box>Type</Box>
            <Box>Status</Box>
            <Box sx={{ textAlign: "right" }}>Price</Box>
            <Box sx={{ textAlign: "right" }}>Offers</Box>
            <Box />
          </Box>

          <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
            {rows.map((item) => (
              <CatalogRow key={item.id} item={item} />
            ))}
          </Stack>
        </SectionCard>
      )}
    </Stack>
  );
}

function CatalogRow({ item }: { item: CatalogItemWithMedia }) {
  const hero = item.catalog_media.find((m) => m.kind === "image");
  const updatedOn = (item.updated_at ?? "").slice(0, 10);

  return (
    <Box
      component={Link}
      href={`/vendor/catalog/${item.id}`}
      sx={{
        textDecoration: "none",
        color: "inherit",
        display: { xs: "flex", md: "grid" },
        flexWrap: { xs: "wrap", md: "nowrap" },
        gridTemplateColumns: GRID_COLUMNS,
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.5,
        "&:hover": { bgcolor: HOVER_ROW },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "6px",
          overflow: "hidden",
          flexShrink: 0,
          bgcolor: FILL,
          border: `1px solid ${LINE}`,
          display: "grid",
          placeItems: "center",
          color: FAINT,
        }}
      >
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <TypeIcon type={item.type} size={20} />
        )}
      </Box>

      <Box sx={{ minWidth: 0, flex: { xs: 1, md: "unset" } }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK, mb: 0.25 }} noWrap>
          {item.name}
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: MUTED }} noWrap>
          {item.category} · Updated {updatedOn}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <TagPill label={item.type} tone="neutral" size="sm" />
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <StatusPill status={item.review_status} size="sm" />
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" }, textAlign: "right" }}>
        <Typography
          sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK, fontVariantNumeric: "tabular-nums" }}
          noWrap
        >
          {item.price_label}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" }, textAlign: "right" }}>
        <Typography sx={{ fontSize: "0.875rem", color: BODY, fontVariantNumeric: "tabular-nums" }}>
          {item.offer_count}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: "none", md: "flex" }, justifyContent: "flex-end", color: FAINT }} aria-hidden>
        <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
      </Box>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          display: { xs: "flex", md: "none" },
          flexWrap: "wrap",
          rowGap: 0.5,
          alignItems: "center",
          width: "100%",
        }}
      >
        <TagPill label={item.type} tone="neutral" size="sm" />
        <StatusPill status={item.review_status} size="sm" />
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: INK }}>
          {item.price_label}
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>
          {item.offer_count} offer{item.offer_count === 1 ? "" : "s"}
        </Typography>
      </Stack>
    </Box>
  );
}
