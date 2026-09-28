"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import MedicalServicesOutlinedIcon from "@mui/icons-material/MedicalServicesOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchCatalogItem,
  fetchVendorOffers,
  type CatalogItemWithMedia,
  type OfferWithCatalog,
} from "@/lib/supabase/vendorQueries";
import type { CatalogItemsRow } from "@/lib/supabase/types";
import {
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
const NAVY = "#0E2A3D";
const HOVER_ROW = "#F9FAFB";
const FILL = "#F3F4F6";

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

type RouteParams = Promise<{ id: string }>;

export default function CatalogDetailPage({ params }: { params: RouteParams }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<CatalogItemWithMedia | null>(null);
  const [offers, setOffers] = useState<OfferWithCatalog[]>([]);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();
    (async () => {
      const result = await fetchCatalogItem(supabase, id);
      if (!active) return;
      setItem(result);

      if (result) {
        const allOffers = await fetchVendorOffers(supabase, result.vendor_id);
        if (!active) return;
        setOffers(allOffers.filter((o) => o.catalog_item_id === id));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const images = useMemo(
    () => (item?.catalog_media ?? []).filter((m) => m.kind === "image"),
    [item],
  );
  const videos = useMemo(
    () => (item?.catalog_media ?? []).filter((m) => m.kind === "video"),
    [item],
  );
  const documents = useMemo(
    () => (item?.catalog_media ?? []).filter((m) => m.kind === "document"),
    [item],
  );

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 8, gap: 2 }}>
        <CircularProgress size={24} />
        <Typography sx={{ color: MUTED, fontSize: "0.875rem" }}>Loading item…</Typography>
      </Stack>
    );
  }

  if (!item) {
    return (
      <SectionCard padding="default">
        <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center", py: 4 }}>
          <Typography sx={portalText.sectionTitle}>Item not found.</Typography>
          <Typography sx={{ color: MUTED, fontSize: "0.875rem" }}>
            The item may have been removed or you don&apos;t have access.
          </Typography>
          <Button onClick={() => router.push("/vendor/catalog")} variant="outlined" sx={{ mt: 1 }}>
            Back to catalog
          </Button>
        </Stack>
      </SectionCard>
    );
  }

  const heroImage = images[activeImage];
  const createdOn = (item.created_at ?? "").slice(0, 10);
  const updatedOn = (item.updated_at ?? "").slice(0, 10);
  const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);

  return (
    <Stack spacing={3}>
      <Box>
        <Button
          component={Link}
          href="/vendor/catalog"
          variant="text"
          size="small"
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          sx={{ px: 0.5, ml: -0.5 }}
        >
          Back to catalog
        </Button>
      </Box>

      <PageHeader
        title={item.name}
        subtitle={item.tagline ? `${typeLabel} · ${item.category} · ${item.tagline}` : `${typeLabel} · ${item.category}`}
        actions={
          <>
            <Button variant="outlined" startIcon={<EditOutlinedIcon sx={{ fontSize: 18 }} />}>
              Edit
            </Button>
            <Button
              component={Link}
              href={`/vendor/offers/new?catalog=${item.id}`}
              variant="contained"
              startIcon={<AddOutlinedIcon sx={{ fontSize: 18 }} />}
            >
              Add offer
            </Button>
          </>
        }
      />

      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.5 }}>
        <Box sx={{ display: "inline-flex", alignItems: "center", color: FAINT }} aria-hidden>
          <TypeIcon type={item.type} size={16} />
        </Box>
        <StatusPill status={item.review_status} />
        {(item.tags ?? []).map((t) => (
          <TagPill key={t} label={t} tone="neutral" />
        ))}
      </Stack>

      {item.review_note && (
        <Box
          sx={{
            bgcolor: "#FEF3C7",
            border: "1px solid #FDE68A",
            borderRadius: "6px",
            px: 2,
            py: 1.25,
          }}
        >
          <Typography sx={{ fontSize: "0.8125rem", color: "#92400E", lineHeight: 1.5 }}>
            <Box component="strong" sx={{ fontWeight: 600, mr: 0.5 }}>
              Team note:
            </Box>
            {item.review_note}
          </Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={3}>
            {images.length > 0 && heroImage && (
              <SectionCard padding="none">
                <Box
                  sx={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    bgcolor: FILL,
                    overflow: "hidden",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImage.url}
                    alt={heroImage.caption ?? item.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  {heroImage.caption && (
                    <Box
                      sx={{
                        position: "absolute",
                        left: 12,
                        bottom: 12,
                        px: 1,
                        py: 0.5,
                        borderRadius: "4px",
                        bgcolor: "rgba(17,24,39,0.8)",
                        color: "#FFFFFF",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                      }}
                    >
                      {heroImage.caption}
                    </Box>
                  )}
                </Box>
                {images.length > 1 && (
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{
                      px: 1,
                      py: 1,
                      borderTop: `1px solid ${LINE}`,
                      overflowX: "auto",
                    }}
                  >
                    {images.map((img, i) => (
                      <Box
                        key={img.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveImage(i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveImage(i);
                          }
                        }}
                        sx={{
                          width: 64,
                          height: 64,
                          flexShrink: 0,
                          borderRadius: "6px",
                          overflow: "hidden",
                          border: "2px solid",
                          borderColor: i === activeImage ? NAVY : LINE,
                          cursor: "pointer",
                          opacity: i === activeImage ? 1 : 0.7,
                          "&:hover": { opacity: 1, borderColor: NAVY },
                          "&:focus-visible": { outline: `2px solid ${NAVY}`, outlineOffset: 2 },
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.caption ?? ""}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            )}

            <SectionCard title="About this listing">
              <Typography sx={portalText.body}>{item.description}</Typography>
            </SectionCard>

            {item.highlights && item.highlights.length > 0 && (
              <SectionCard title="Highlights">
                <Stack spacing={1.25}>
                  {item.highlights.map((h) => (
                    <Stack key={h} direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                      <CheckRoundedIcon sx={{ fontSize: 16, color: MUTED, mt: "3px", flexShrink: 0 }} />
                      <Typography sx={portalText.body}>{h}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </SectionCard>
            )}

            {videos.length > 0 && (
              <SectionCard
                title="Videos"
                subtitle={`${videos.length} video${videos.length === 1 ? "" : "s"}`}
                padding="default"
              >
                <Grid container spacing={2}>
                  {videos.map((v) => (
                    <Grid key={v.id} size={{ xs: 12, sm: 6 }}>
                      <Box
                        component="a"
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: "block",
                          textDecoration: "none",
                          color: "inherit",
                          borderRadius: "6px",
                          overflow: "hidden",
                          border: `1px solid ${LINE}`,
                          "&:hover": { borderColor: "#D1D5DB" },
                        }}
                      >
                        <Box
                          sx={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "16 / 9",
                            bgcolor: INK,
                          }}
                        >
                          {v.thumbnail_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={v.thumbnail_url}
                              alt={v.caption ?? ""}
                              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
                            />
                          )}
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              display: "grid",
                              placeItems: "center",
                              color: "#FFFFFF",
                            }}
                          >
                            <PlayArrowRoundedIcon sx={{ fontSize: 36 }} />
                          </Box>
                          {v.duration_label && (
                            <Box
                              sx={{
                                position: "absolute",
                                right: 8,
                                bottom: 8,
                                px: 0.75,
                                py: 0.25,
                                borderRadius: "4px",
                                bgcolor: "rgba(17,24,39,0.85)",
                                color: "#FFFFFF",
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                              }}
                            >
                              {v.duration_label}
                            </Box>
                          )}
                        </Box>
                        {v.caption && (
                          <Box sx={{ px: 1.5, py: 1.25 }}>
                            <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK }}>
                              {v.caption}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </SectionCard>
            )}

            {documents.length > 0 && (
              <SectionCard
                title="Documents"
                subtitle={`${documents.length} file${documents.length === 1 ? "" : "s"} attached`}
                padding="none"
              >
                <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
                  {documents.map((d) => {
                    const filename = d.url.split("/").pop() ?? "document";
                    const sizeKb = d.file_size_bytes
                      ? Math.max(1, Math.round(d.file_size_bytes / 1024))
                      : null;
                    return (
                      <Box
                        key={d.id}
                        component="a"
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          px: 3,
                          py: 1.5,
                          textDecoration: "none",
                          color: "inherit",
                          "&:hover": { bgcolor: HOVER_ROW },
                        }}
                      >
                        <DescriptionOutlinedIcon sx={{ fontSize: 20, color: MUTED, flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK }} noWrap>
                            {d.caption || filename}
                          </Typography>
                          <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>
                            {(d.mime_type ?? "Document").replace("application/", "").toUpperCase()}
                            {sizeKb ? ` · ${sizeKb} KB` : ""}
                          </Typography>
                        </Box>
                        <OpenInNewOutlinedIcon sx={{ fontSize: 16, color: FAINT }} />
                      </Box>
                    );
                  })}
                </Stack>
              </SectionCard>
            )}

            <SectionCard
              title="Attached offers"
              subtitle={`${offers.length} offer${offers.length === 1 ? "" : "s"} on this item`}
              padding="none"
              action={
                <Button
                  component={Link}
                  href={`/vendor/offers/new?catalog=${item.id}`}
                  variant="text"
                  size="small"
                  startIcon={<AddOutlinedIcon sx={{ fontSize: 16 }} />}
                >
                  Add offer
                </Button>
              }
            >
              {offers.length === 0 ? (
                <Box sx={{ px: 3, py: 3, color: MUTED, fontSize: "0.875rem" }}>
                  No offers attached yet. Create one to give members a discount on this listing.
                </Box>
              ) : (
                <>
                  <Box
                    sx={{
                      display: { xs: "none", md: "grid" },
                      gridTemplateColumns: "minmax(0, 2fr) 110px 110px 160px",
                      gap: 1,
                      px: 3,
                      py: 1.25,
                      borderBottom: `1px solid ${LINE}`,
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
                  <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
                    {offers.map((o) => (
                      <Box
                        key={o.id}
                        sx={{
                          px: 3,
                          py: 1.5,
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) 110px 110px 160px" },
                          gap: 1,
                          alignItems: "center",
                          "&:hover": { bgcolor: HOVER_ROW },
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK, mb: 0.25 }} noWrap>
                            {o.headline}
                          </Typography>
                          <Typography sx={{ fontSize: "0.75rem", color: MUTED }} noWrap>
                            {o.description}
                          </Typography>
                        </Box>
                        <Box sx={{ display: { xs: "none", md: "block" }, textAlign: "right" }}>
                          <Typography
                            sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK, fontVariantNumeric: "tabular-nums" }}
                          >
                            {o.discount_value}
                          </Typography>
                        </Box>
                        <Box sx={{ display: { xs: "none", md: "block" } }}>
                          <StatusPill status={o.review_status} size="sm" />
                        </Box>
                        <Box sx={{ display: { xs: "none", md: "block" }, color: MUTED, fontSize: "0.75rem" }}>
                          {o.valid_from} to {o.valid_to}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
            </SectionCard>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3} sx={{ position: { lg: "sticky" }, top: { lg: 76 } }}>
            <SectionCard title="Details" padding="default">
              <Stack spacing={1.25}>
                <MetaRow label="Price" value={item.price_label} highlight />
                {item.duration_hours !== null && item.duration_hours !== undefined && (
                  <MetaRow label="Duration" value={`${item.duration_hours} hours`} />
                )}
                {item.module_count !== null && item.module_count !== undefined && (
                  <MetaRow label="Modules" value={`${item.module_count}`} />
                )}
                {item.ce_credits !== null && item.ce_credits !== undefined && (
                  <MetaRow label="CE credits" value={`${item.ce_credits}`} />
                )}
                <MetaRow label="Category" value={item.category} />
                <MetaRow label="Created" value={createdOn} />
                <MetaRow label="Updated" value={updatedOn} />
              </Stack>
            </SectionCard>

            <SectionCard title="Performance" padding="default">
              <Stack spacing={1.25}>
                <MetaRow label="Attached offers" value={`${item.offer_count}`} />
                <MetaRow label="Lifetime redemptions" value={`${item.redemptions_lifetime}`} />
                <MetaRow
                  label="Media"
                  value={`${images.length} images · ${videos.length} videos · ${documents.length} docs`}
                />
              </Stack>
            </SectionCard>

            <SectionCard title="Media library" padding="default">
              <Stack direction="row" spacing={2} sx={{ alignItems: "center", color: MUTED }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <PhotoLibraryOutlinedIcon sx={{ fontSize: 16 }} />
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK }}>
                    {images.length}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <OndemandVideoOutlinedIcon sx={{ fontSize: 16 }} />
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK }}>
                    {videos.length}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK }}>
                    {documents.length}
                  </Typography>
                </Stack>
              </Stack>
            </SectionCard>

            <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 0.5 }}>
              <Tooltip title="Delete item">
                <IconButton
                  size="small"
                  color="error"
                  sx={{ border: `1px solid ${LINE}`, borderRadius: "6px", color: "#991B1B" }}
                >
                  <DeleteOutlineOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

function MetaRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
      <Typography sx={{ fontSize: "0.8125rem", color: MUTED, flexShrink: 0 }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: "0.875rem",
          fontWeight: highlight ? 600 : 500,
          color: highlight ? INK : BODY,
          textAlign: "right",
          minWidth: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
