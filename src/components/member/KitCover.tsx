"use client";

import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { visualForTopic } from "@/components/member/topicVisuals";

/**
 * KitCover — thumbnail for a resource kit.
 *
 * Two modes:
 *
 * 1. coverUrl present (real cover image with title baked in):
 *    - Image fills the card. No title overlay, no stripe pattern, no light wash,
 *      no bottom text. Just the photo + functional UI.
 *    - Top-left: status badges (small, clear of any image content)
 *    - Bottom-right: small play button when the kit has video
 *    - Bottom: progress bar when viewed
 *
 * 2. coverUrl absent (painted gradient fallback):
 *    - Magazine-style composition with diagonal stripes, the title set in
 *      display font, count line, centered play button.
 *
 * Sizes: pass `size="md"` (default) or `size="sm"` for sidebar mini-tiles.
 */
export function KitCover({
  slug,
  title,
  videoCount,
  resourceCount,
  isFree,
  completed,
  inProgress,
  progressPct = 0,
  size = "md",
  portalCardUrl,
}: {
  slug: string;
  title: string;
  videoCount: number;
  resourceCount: number;
  isFree?: boolean;
  completed?: boolean;
  inProgress?: boolean;
  progressPct?: number;
  size?: "sm" | "md";
  /**
   * Square portal-card image (from Supabase Storage / kit-thumbnails).
   * When provided, the cover is treated as authoritative — we don't paint our
   * own title or text on top of it (the title is already baked into the
   * artwork). Falls back to the painted gradient when null/undefined.
   */
  portalCardUrl?: string | null;
}) {
  const visual = visualForTopic(slug);
  const Icon = visual.icon;
  const hasVideo = videoCount > 0;
  const showProgress = progressPct > 0;
  const hasCover = !!portalCardUrl;

  // The library is mid-migration from square (2160×2160 social) covers to
  // the 3:4 topic-led portal cards. The tile is 3:4; portrait cards fill
  // it edge-to-edge, while legacy square covers letterbox on the navy
  // backdrop instead of being zoom-cropped (which cut their baked titles).
  const [coverFit, setCoverFit] = useState<"cover" | "contain">("cover");
  useEffect(() => {
    if (!portalCardUrl) return;
    let alive = true;
    const img = new window.Image();
    img.onload = () => {
      if (!alive) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      setCoverFit(Math.abs(ratio - 0.75) < 0.08 ? "cover" : "contain");
    };
    img.src = portalCardUrl;
    return () => {
      alive = false;
    };
  }, [portalCardUrl]);

  // Typography for the painted-gradient fallback
  const titleFontSize = size === "sm"
    ? { xs: "0.92rem" }
    : { xs: "1.05rem", md: "1.2rem" };

  return (
    <Box
      sx={{
        position: "relative",
        // 3:4 portrait — matches the topic-led portal cards (1600×2134).
        // Legacy square covers render `contain` on the navy backdrop (see
        // coverFit above) so their baked-in titles never get cropped.
        aspectRatio: "3 / 4",
        backgroundImage: hasCover ? `url("${portalCardUrl}")` : visual.gradient,
        backgroundSize: hasCover ? coverFit : "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        bgcolor: "var(--ink, #0A1A2F)",
        overflow: "hidden",
        borderRadius: 1,
        display: "flex",
        flexDirection: "column",
        color: "#FFFFFF",
        isolation: "isolate",
      }}
    >
      {/* Decorative overlays — only on painted fallback. With a real cover
          image we let the artwork speak for itself. */}
      {!hasCover && (
        <>
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.08,
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 14px)",
              pointerEvents: "none",
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 35%, rgba(0,0,0,0.18) 100%)",
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Status badges — always at top-left, kept small so they don't crowd
          a baked-in image title. On narrow tiles (sm) we only show the
          higher-signal badge (progress > done > free) so two pills never
          stack on top of each other. */}
      {(isFree || completed || inProgress) && (
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
            zIndex: 2,
            maxWidth: "calc(100% - 20px)",
          }}
        >
          {completed ? (
            <CoverBadge label="Done" tone="paper" />
          ) : inProgress ? (
            <CoverBadge label="In progress" tone="gold" />
          ) : isFree ? (
            <CoverBadge label="Free" tone="leaf" />
          ) : null}
        </Box>
      )}

      {/* Play button.
          - With a real cover: tucked into the bottom-right, small, so it never
            covers the title baked into the artwork.
          - Without a cover: centered, larger, the focal action. */}
      {hasVideo && hasCover && (
        <Box
          sx={{
            position: "absolute",
            bottom: 10,
            right: 10,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <Box
            sx={{
              width: size === "sm" ? 30 : 36,
              height: size === "sm" ? 30 : 36,
              borderRadius: "50%",
              bgcolor: "rgba(255,255,255,0.94)",
              color: "var(--ink, #0A1A2F)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 6px 16px -6px rgba(0,0,0,0.45)",
            }}
          >
            <PlayArrowRoundedIcon sx={{ fontSize: size === "sm" ? 16 : 20 }} />
          </Box>
        </Box>
      )}
      {hasVideo && !hasCover && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              width: size === "sm" ? 36 : 48,
              height: size === "sm" ? 36 : 48,
              borderRadius: "50%",
              bgcolor: "rgba(255,255,255,0.94)",
              color: "var(--ink, #0A1A2F)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 22px -8px rgba(0,0,0,0.5)",
            }}
          >
            <PlayArrowRoundedIcon sx={{ fontSize: size === "sm" ? 20 : 26 }} />
          </Box>
        </Box>
      )}

      {/* Title + count row — ONLY on painted fallback. With a real cover the
          image already has its own title; we don't double it up. */}
      {!hasCover && (
        <Box
          sx={{
            position: "relative",
            mt: "auto",
            px: { xs: 1.5, md: 2 },
            pb: { xs: 1.5, md: 1.75 },
            pt: 2,
            zIndex: 2,
            backgroundImage:
              "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.28) 100%)",
          }}
        >
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: titleFontSize,
              lineHeight: 1.18,
              letterSpacing: "-0.01em",
              fontWeight: 600,
              color: "#FFFFFF",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 1px 2px rgba(0,0,0,0.18)",
            }}
          >
            {title}
          </Typography>

          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              mt: 1,
              alignItems: "center",
              justifyContent: "space-between",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
              <Icon sx={{ fontSize: size === "sm" ? 13 : 15 }} />
              <Typography
                sx={{
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                {`${resourceCount} ${resourceCount === 1 ? "resource" : "resources"}`}
              </Typography>
            </Stack>
            {!hasVideo && resourceCount > 0 && (
              <Typography
                sx={{
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  opacity: 0.7,
                }}
              >
                Kit
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {/* Progress bar at very bottom — both modes */}
      {showProgress && (
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            bgcolor: "rgba(0,0,0,0.25)",
            zIndex: 3,
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${progressPct}%`,
              bgcolor: visual.accent,
              boxShadow: `0 0 8px ${visual.accent}`,
              transition: "width var(--dur-base, 200ms) var(--ease-out, ease-out)",
            }}
          />
        </Box>
      )}
    </Box>
  );
}

function CoverBadge({
  label,
  tone,
}: {
  label: string;
  tone: "leaf" | "gold" | "paper";
}) {
  const palette =
    tone === "leaf"
      ? { bg: "rgba(255,255,255,0.94)", fg: "#1F5C40" }
      : tone === "gold"
        ? { bg: "rgba(255,255,255,0.94)", fg: "#7A5B17" }
        : { bg: "rgba(255,255,255,0.94)", fg: "#0A1A2F" };
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        height: 18,
        px: 0.75,
        borderRadius: 0.5,
        bgcolor: palette.bg,
        color: palette.fg,
        fontSize: "0.6rem",
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        // Keep the pill on one line — without this, narrow tiles wrap
        // "In progress" vertically inside the fixed 18 px height.
        whiteSpace: "nowrap",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {label}
    </Box>
  );
}
