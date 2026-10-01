"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { isSupabaseImage } from "@/lib/images";
import { useParams } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import SpotlightSection, { type Spotlight } from "@/components/member/SpotlightSection";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

type Kit = { slug: string; title: string; card_url: string | null; kit_type: string };
type ExpertProfile = {
  id: string;
  name: string;
  specialty: string | null;
  bio: string | null;
  topics: string | null;
  website: string | null;
  booking_link: string | null;
  company_name: string | null;
  headshot_url: string | null;
};

/**
 * /dashboard/experts/[id] — full member-facing expert profile.
 *
 * Members reach this from the Experts directory (card → profile). Shows
 * the expert's photo, specialty, company, bio, topics, and their kits,
 * with actions to view all their kits, book a call, or visit their site.
 */
export default function ExpertProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [expert, setExpert] = useState<ExpertProfile | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/member/experts/${id}`, { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const body = (await res.json()) as { expert?: ExpertProfile; kits?: Kit[]; spotlights?: Spotlight[] };
        if (!body.expert) {
          setNotFound(true);
          return;
        }
        setExpert(body.expert);
        setKits(body.kits ?? []);
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

  const topics = (expert?.topics ?? "")
    .split(/[,\n;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Box
        component={Link}
        href="/dashboard/experts"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          textDecoration: "none",
          color: INK_MUTED,
          fontSize: "0.85rem",
          fontWeight: 600,
          mb: 3,
          "&:hover": { color: GOLD },
        }}
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> All experts
      </Box>

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress size={22} sx={{ color: GOLD }} />
        </Stack>
      ) : notFound || !expert ? (
        <Box sx={{ textAlign: "center", py: 8, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK, mb: 0.5 }}>
            We couldn&apos;t find that expert
          </Typography>
          <Typography sx={{ fontSize: "0.9rem", color: INK_MUTED }}>
            They may have left the bench.{" "}
            <Box component={Link} href="/dashboard/experts" sx={{ color: GOLD, fontWeight: 600 }}>
              Browse all experts
            </Box>
          </Typography>
        </Box>
      ) : (
        <Stack spacing={{ xs: 3.5, md: 4.5 }}>
          {/* Header */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 2.5, sm: 3 }}
            sx={{ alignItems: { sm: "center" } }}
          >
            <Box
              sx={{
                position: "relative",
                width: { xs: 96, sm: 116 },
                height: { xs: 96, sm: 116 },
                borderRadius: "50%",
                overflow: "hidden",
                bgcolor: "#FBF8F1",
                border: `1px solid ${LINE}`,
                flexShrink: 0,
              }}
            >
              {expert.headshot_url ? (
                <Image
                  src={expert.headshot_url}
                  alt={expert.name}
                  fill
                  sizes="116px"
                  unoptimized={!isSupabaseImage(expert.headshot_url)}
                  style={{ objectFit: "cover", objectPosition: "center top" }}
                />
              ) : (
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: GOLD,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "2rem",
                  }}
                >
                  {initials(expert.name)}
                </Box>
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              {expert.specialty && (
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    color: GOLD,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    mb: 0.75,
                  }}
                >
                  {expert.specialty}
                </Typography>
              )}
              <Typography
                component="h1"
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.9rem", md: "2.3rem" },
                  fontWeight: 500,
                  color: INK,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                {expert.name}
              </Typography>
              {expert.company_name && (
                <Typography sx={{ color: INK_MUTED, fontSize: "0.95rem", mt: 0.5 }}>
                  {expert.company_name}
                </Typography>
              )}
            </Box>
          </Stack>

          {/* Actions */}
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <Button
              component={Link}
              href={`/dashboard/resources?expert=${expert.id}`}
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: "none",
                borderRadius: 999,
                bgcolor: INK,
                "&:hover": { bgcolor: "#13253c" },
              }}
            >
              View kits{kits.length ? ` (${kits.length})` : ""}
            </Button>
            {expert.booking_link && (
              <Button
                component="a"
                href={expert.booking_link}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                startIcon={<CalendarMonthRoundedIcon sx={{ fontSize: 17 }} />}
                sx={{ textTransform: "none", borderRadius: 999, borderColor: LINE, color: INK }}
              >
                Book a call
              </Button>
            )}
            {expert.website && (
              <Button
                component="a"
                href={expert.website}
                target="_blank"
                rel="noopener noreferrer"
                variant="text"
                startIcon={<LanguageRoundedIcon sx={{ fontSize: 17 }} />}
                sx={{ textTransform: "none", borderRadius: 999, color: INK_SOFT }}
              >
                Visit website
              </Button>
            )}
          </Stack>

          {/* Member offers — the spotlight carousel (offers, events, news)
              lives here under one heading, mirroring partner profiles,
              instead of being duplicated at the top of the page. */}
          {spotlights.length > 0 && (
            <Section title="Member offers">
              <SpotlightSection spotlights={spotlights} />
            </Section>
          )}

          {/* Bio */}
          {expert.bio && (
            <Section title="About">
              <Typography sx={{ color: INK_SOFT, fontSize: "1rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {expert.bio}
              </Typography>
            </Section>
          )}

          {/* Topics */}
          {topics.length > 0 && (
            <Section title="Teaches on">
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {topics.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    sx={{
                      bgcolor: "#FBF8F1",
                      border: `1px solid ${LINE}`,
                      color: INK_SOFT,
                      fontWeight: 600,
                      fontSize: "0.8rem",
                    }}
                  />
                ))}
              </Stack>
            </Section>
          )}

          {/* Kits */}
          <Section title={kits.length ? `Kits by ${expert.name}` : "Kits"}>
            {kits.length === 0 ? (
              <Typography sx={{ color: INK_MUTED, fontSize: "0.92rem" }}>
                No published kits yet. Check back soon.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                  gap: 2,
                }}
              >
                {kits.map((k) => (
                  <KitCard key={k.slug} kit={k} />
                ))}
              </Box>
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
      <Typography
        sx={{
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: INK_MUTED,
          textTransform: "uppercase",
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function KitCard({ kit }: { kit: Kit }) {
  // 3:4 tile matching the topic-led portal cards; legacy square covers
  // letterbox (contain) instead of being zoom-cropped.
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  return (
    <Box
      component={Link}
      href={`/dashboard/resources/${kit.slug}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        borderRadius: 2,
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
        overflow: "hidden",
        transition: "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: GOLD,
          boxShadow: "0 16px 32px -18px rgba(217,168,75,0.3)",
        },
      }}
    >
      {/* 3:4 tile (topic-led portal cards). Legacy square covers letterbox
          on navy instead of cropping their baked titles. Only the no-image
          fallback shows a separate title below. */}
      <Box sx={{ position: "relative", aspectRatio: "3 / 4", bgcolor: "#0A1A2F" }}>
        {kit.card_url ? (
          <Image
            src={kit.card_url}
            alt={kit.title}
            fill
            sizes="(max-width:600px) 100vw, (max-width:900px) 50vw, 320px"
            unoptimized={!isSupabaseImage(kit.card_url)}
            style={{ objectFit: fit }}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth && el.naturalHeight) {
                const ratio = el.naturalWidth / el.naturalHeight;
                setFit(Math.abs(ratio - 0.75) < 0.08 ? "cover" : "contain");
              }
            }}
          />
        ) : (
          <Box sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: GOLD, fontFamily: "var(--font-display)", fontWeight: 700 }}>
            ASN
          </Box>
        )}
        {kit.kit_type === "book_club" && (
          <Chip
            label="Book Club"
            size="small"
            sx={{ position: "absolute", top: 8, left: 8, height: 20, fontSize: "0.62rem", fontWeight: 700, bgcolor: "rgba(110,51,70,0.9)", color: "#fff", zIndex: 1 }}
          />
        )}
      </Box>
      {!kit.card_url && (
        <Box sx={{ p: 1.75 }}>
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "1rem",
              fontWeight: 600,
              color: INK,
              lineHeight: 1.25,
            }}
          >
            {kit.title}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
