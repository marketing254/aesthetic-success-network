"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import SpotlightSection, { type Spotlight } from "@/components/member/SpotlightSection";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

type CatalogMedia = {
  id: string;
  kind: string | null;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  duration_label: string | null;
};
type CatalogItem = {
  id: string;
  type: "service" | "product" | "course" | string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  price_label: string | null;
  duration_hours: number | null;
  module_count: number | null;
  highlights: string[] | null;
  media: CatalogMedia[];
};
type PartnerProfile = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  calendar_link: string | null;
};

/**
 * /dashboard/partners/[id] — full member-facing partner profile + offers.
 */
export default function PartnerProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/member/partners/${id}`, { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const body = (await res.json()) as { partner?: PartnerProfile; spotlights?: Spotlight[]; catalog?: CatalogItem[] };
        if (!body.partner) {
          setNotFound(true);
          return;
        }
        setPartner(body.partner);
        setCatalog(body.catalog ?? []);
        setSpotlights(body.spotlights ?? []);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Box
        component={Link}
        href="/dashboard/partners"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, textDecoration: "none", color: INK_MUTED, fontSize: "0.85rem", fontWeight: 600, mb: 3, "&:hover": { color: GOLD } }}
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> All partners
      </Box>

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress size={22} sx={{ color: GOLD }} />
        </Stack>
      ) : notFound || !partner ? (
        <Box sx={{ textAlign: "center", py: 8, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK, mb: 0.5 }}>
            We couldn&apos;t find that partner
          </Typography>
          <Typography sx={{ fontSize: "0.9rem", color: INK_MUTED }}>
            <Box component={Link} href="/dashboard/partners" sx={{ color: GOLD, fontWeight: 600 }}>
              Browse all partners
            </Box>
          </Typography>
        </Box>
      ) : (
        <Stack spacing={{ xs: 3.5, md: 4.5 }}>
          {/* Header */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2.5, sm: 3 }} sx={{ alignItems: { sm: "center" } }}>
            <Box
              sx={{
                position: "relative",
                width: { xs: 84, sm: 100 },
                height: { xs: 84, sm: 100 },
                borderRadius: 2,
                overflow: "hidden",
                bgcolor: "#FBF8F1",
                border: `1px solid ${LINE}`,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
              }}
            >
              {partner.logo_url ? (
                <Image src={partner.logo_url} alt={partner.name} fill sizes="100px" unoptimized style={{ objectFit: "contain", padding: 10 }} />
              ) : (
                <StorefrontOutlinedIcon sx={{ color: GOLD, fontSize: 40 }} />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              {partner.category && (
                <Typography sx={{ fontSize: "0.72rem", color: GOLD, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", mb: 0.75 }}>
                  {partner.category}
                </Typography>
              )}
              <Typography
                component="h1"
                sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.9rem", md: "2.3rem" }, fontWeight: 500, color: INK, lineHeight: 1.1, letterSpacing: "-0.02em" }}
              >
                {partner.name}
              </Typography>
            </Box>
          </Stack>

          {/* Actions */}
          {(partner.website || partner.calendar_link) && (
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
              {partner.calendar_link && (
                <Button
                  component="a"
                  href={partner.calendar_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="contained"
                  startIcon={<CalendarMonthRoundedIcon sx={{ fontSize: 17 }} />}
                  sx={{ textTransform: "none", borderRadius: 999, bgcolor: INK, "&:hover": { bgcolor: "#13253c" } }}
                >
                  Book / contact
                </Button>
              )}
              {partner.website && (
                <Button
                  component="a"
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  startIcon={<LanguageRoundedIcon sx={{ fontSize: 17 }} />}
                  sx={{ textTransform: "none", borderRadius: 999, borderColor: LINE, color: INK }}
                >
                  Visit website
                </Button>
              )}
            </Stack>
          )}

          {/* About */}
          {partner.description && (
            <Section title="About">
              <Typography sx={{ color: INK_SOFT, fontSize: "1rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {partner.description}
              </Typography>
            </Section>
          )}

          {/* Catalog — the partner's approved services, products & courses,
              exactly as they submitted them. Filter chips + a show-all
              expander keep big catalogs manageable. */}
          {catalog.length > 0 && (
            <Section title="Services, products & courses">
              <CatalogList items={catalog} />
            </Section>
          )}

          {/* Member offers — everything rotates in the spotlight carousel:
              approved offers are folded in as feature slides by the API,
              alongside news & events. */}
          <Section title="Member offers">
            {spotlights.length === 0 ? (
              <Typography sx={{ color: INK_MUTED, fontSize: "0.92rem" }}>
                No published offers yet. Check back soon.
              </Typography>
            ) : (
              <SpotlightSection spotlights={spotlights} />
            )}
          </Section>
        </Stack>
      )}
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", color: INK_MUTED, textTransform: "uppercase", mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

const CATALOG_PREVIEW_COUNT = 3;

/** The catalog list with type filter chips and a show-all expander —
 *  some partners list a LOT of items. */
function CatalogList({ items }: { items: CatalogItem[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);

  const types = Array.from(new Set(items.map((i) => i.type)));
  const filtered = typeFilter === "all" ? items : items.filter((i) => i.type === typeFilter);
  const visible = showAll ? filtered : filtered.slice(0, CATALOG_PREVIEW_COUNT);
  const hiddenCount = filtered.length - visible.length;

  const chipLabel = (t: string) =>
    t === "service" ? "Services" : t === "product" ? "Products" : t === "course" ? "Courses" : t;

  return (
    <Box>
      {/* Type filter — only shown when the catalog spans multiple types */}
      {types.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 1.75 }}>
          {["all", ...types].map((t) => {
            const active = typeFilter === t;
            const count = t === "all" ? items.length : items.filter((i) => i.type === t).length;
            return (
              <Chip
                key={t}
                label={`${t === "all" ? "All" : chipLabel(t)} (${count})`}
                onClick={() => {
                  setTypeFilter(t);
                  setShowAll(false);
                }}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: "0.74rem",
                  bgcolor: active ? INK : "#FFFFFF",
                  color: active ? "#FFFFFF" : INK,
                  border: `1px solid ${active ? INK : LINE}`,
                  "&:hover": { bgcolor: active ? INK : "#FBF8F1" },
                }}
              />
            );
          })}
        </Stack>
      )}

      <Stack spacing={1.5}>
        {visible.map((c) => (
          <CatalogCard key={c.id} item={c} />
        ))}
      </Stack>

      {(hiddenCount > 0 || (showAll && filtered.length > CATALOG_PREVIEW_COUNT)) && (
        <Box sx={{ textAlign: "center", mt: 1.75 }}>
          <Button
            onClick={() => setShowAll((v) => !v)}
            variant="outlined"
            size="small"
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 999,
              px: 2.5,
              borderColor: GOLD,
              color: "#7A5B17",
              "&:hover": { borderColor: GOLD, bgcolor: "rgba(217,168,75,0.08)" },
            }}
          >
            {showAll
              ? "Show fewer ↑"
              : `Show all ${filtered.length} item${filtered.length === 1 ? "" : "s"} ↓`}
          </Button>
        </Box>
      )}
    </Box>
  );
}

const CATALOG_TYPE_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  service: { bg: "rgba(34,108,78,0.12)", fg: "#1F5C40", label: "Service" },
  product: { bg: "rgba(31,58,92,0.12)", fg: "#1B3A5C", label: "Product" },
  course: { bg: "rgba(110,51,70,0.12)", fg: "#6E3346", label: "Course" },
};

function mediaLabel(m: CatalogMedia): string {
  if (m.caption) return m.caption;
  const kind = (m.kind ?? "").toLowerCase();
  if (kind.includes("pdf") || kind.includes("document") || kind.includes("file")) return "Download PDF";
  if (kind.includes("video")) return m.duration_label ? `Watch video · ${m.duration_label}` : "Watch video";
  if (kind.includes("image")) return "View image";
  return "Open file";
}

function CatalogCard({ item }: { item: CatalogItem }) {
  const [expanded, setExpanded] = useState(false);
  const chip = CATALOG_TYPE_CHIP[item.type] ?? { bg: "rgba(122,133,144,0.14)", fg: INK_MUTED, label: item.type };
  const thumb = item.media.find((m) => m.thumbnail_url || (m.kind ?? "").startsWith("image"));
  // Everything the partner attached — PDFs, videos, images — as openable
  // files. The thumbnail image (if any) still shows in the header.
  const files = item.media;
  const longDescription = (item.description?.length ?? 0) > 260 || (item.highlights?.length ?? 0) > 0;

  return (
    <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 2.5, bgcolor: "#FFFFFF", overflow: "hidden" }}>
      {/* Header */}
      <Stack direction="row" spacing={1.75} sx={{ alignItems: "center", px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1.5 }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 1.5,
            overflow: "hidden",
            border: `1px solid ${LINE}`,
            bgcolor: "#FBF8F1",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb.thumbnail_url ?? thumb.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <LocalOfferOutlinedIcon sx={{ color: GOLD, fontSize: 22 }} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>
            {item.name}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5, mt: 0.4 }}>
            <Chip label={chip.label} size="small" sx={{ height: 20, fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", bgcolor: chip.bg, color: chip.fg }} />
            {item.price_label && (
              <Typography sx={{ fontSize: "0.8rem", color: GOLD, fontWeight: 700 }}>{item.price_label}</Typography>
            )}
            {item.duration_hours != null && (
              <Typography sx={{ fontSize: "0.74rem", color: INK_MUTED, fontWeight: 600 }}>{item.duration_hours}h</Typography>
            )}
            {item.module_count != null && (
              <Typography sx={{ fontSize: "0.74rem", color: INK_MUTED, fontWeight: 600 }}>{item.module_count} modules</Typography>
            )}
          </Stack>
        </Box>
      </Stack>

      {/* Body */}
      <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2 }}>
        {item.tagline && (
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK_SOFT, mb: 0.75 }}>
            {item.tagline}
          </Typography>
        )}
        {item.description && (
          <Typography
            sx={{
              fontSize: "0.85rem",
              color: INK_SOFT,
              lineHeight: 1.6,
              whiteSpace: "pre-line",
              ...(expanded
                ? {}
                : {
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }),
            }}
          >
            {item.description}
          </Typography>
        )}
        {expanded && (item.highlights?.length ?? 0) > 0 && (
          <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
            {item.highlights!.map((h) => (
              <Typography key={h} component="li" sx={{ fontSize: "0.84rem", color: INK_SOFT, lineHeight: 1.6 }}>
                {h}
              </Typography>
            ))}
          </Box>
        )}
        {longDescription && (
          <Box
            component="button"
            type="button"
            onClick={() => setExpanded((v) => !v)}
            sx={{
              all: "unset",
              cursor: "pointer",
              mt: 0.75,
              fontSize: "0.8rem",
              fontWeight: 700,
              color: GOLD,
              "&:hover": { color: INK },
            }}
          >
            {expanded ? "Show less ↑" : "Read more ↓"}
          </Box>
        )}

        {/* Included files — the actual resources the partner uploaded */}
        {files.length > 0 && (
          <Box sx={{ mt: 1.75, pt: 1.5, borderTop: `1px dashed ${LINE}` }}>
            <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.14em", color: INK_MUTED, textTransform: "uppercase", mb: 1 }}>
              Included files
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {files.map((m) => (
                <Box
                  key={m.id}
                  component="a"
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.5,
                    py: 0.8,
                    borderRadius: 999,
                    border: `1.5px solid ${GOLD}`,
                    bgcolor: "rgba(217,168,75,0.08)",
                    color: "#7A5B17",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    transition: "background-color 160ms ease",
                    "&:hover": { bgcolor: "rgba(217,168,75,0.18)" },
                  }}
                >
                  <ArrowForwardRoundedIcon sx={{ fontSize: 14, transform: "rotate(-45deg)" }} />
                  {mediaLabel(m)}
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}

