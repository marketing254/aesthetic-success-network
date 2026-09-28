"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Box, Container, Typography } from "@mui/material";
import { isSupabaseImage } from "@/lib/images";

// Both URLs come from the environment so the placeholder cut and its poster
// can be swapped without a code change. With no video URL the section
// renders nothing at all (no empty player, no broken image).
const VIDEO_URL = process.env.NEXT_PUBLIC_TOUR_VIDEO_URL ?? "";
const POSTER_URL = process.env.NEXT_PUBLIC_TOUR_POSTER_URL ?? "";

/**
 * "See inside the member area." The 2-minute portal tour.
 *
 * Click-to-play ONLY, on every viewport: the video element isn't even
 * mounted until the poster is clicked, so nothing preloads and nothing
 * autoplays. Playback starts from the click handler's state change (no
 * `autoPlay` attribute anywhere). The file is a placeholder cut; the
 * founding team supplies a story-led replacement of the same length later.
 * Same player, same slot, just change NEXT_PUBLIC_TOUR_VIDEO_URL.
 */
export default function TourVideo() {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Start playback once the user-initiated mount has happened. This is the
  // continuation of the click, not an autoplay: the element does not exist
  // until `playing` is true.
  useEffect(() => {
    if (!playing) return;
    const el = videoRef.current;
    if (!el) return;
    el.play().catch(() => {
      /* the browser may still require a second tap; controls are visible */
    });
  }, [playing]);

  if (!VIDEO_URL) return null;

  return (
    <Box id="tour" component="section" sx={{ bgcolor: "#FFFFFF", py: { xs: 6, md: 8 } }}>
      <Container maxWidth="md" sx={{ textAlign: "center" }}>
        <Typography
          sx={{
            color: "#A07823",
            fontSize: "0.78rem",
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Two minutes, narrated
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "1.7rem", md: "2.25rem" },
            color: "#0A1A2F",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            my: 0.75,
          }}
        >
          See inside the member area.
        </Typography>
        <Typography sx={{ color: "#5C6770", fontSize: "1rem", lineHeight: 1.6, mb: 3.5 }}>
          The resource library, the Hotline, the partner deals and the experts,
          exactly as a member sees them.
        </Typography>

        <Box
          sx={{
            position: "relative",
            borderRadius: { xs: 0, sm: 3 },
            overflow: "hidden",
            aspectRatio: "16 / 9",
            bgcolor: "#0A1A2F",
            boxShadow: "0 24px 60px -18px rgba(14,42,61,0.45)",
            // Full-bleed on phones: the container padding is cancelled so
            // the player uses the whole width.
            mx: { xs: -2, sm: 0 },
          }}
        >
          {playing ? (
            <Box
              component="video"
              ref={videoRef}
              src={VIDEO_URL}
              poster={POSTER_URL || undefined}
              controls
              playsInline
              preload="metadata"
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
          ) : (
            <Box
              component="button"
              type="button"
              aria-label="Play the 2-minute member portal tour"
              onClick={() => setPlaying(true)}
              sx={{
                all: "unset",
                cursor: "pointer",
                position: "absolute",
                inset: 0,
                display: "block",
                "&:focus-visible": { outline: "3px solid #D9A84B", outlineOffset: -3 },
                "&:hover .tour-play": { transform: "scale(1.06)" },
              }}
            >
              {POSTER_URL ? (
                <Image
                  src={POSTER_URL}
                  alt="Preview frame of the member portal tour"
                  fill
                  unoptimized={!isSupabaseImage(POSTER_URL)}
                  sizes="(max-width: 900px) 100vw, 900px"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                // No poster configured: a quiet navy panel with the brand
                // glow, so the slot never shows a broken image.
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage:
                      "radial-gradient(60% 80% at 50% 100%, rgba(217,168,75,0.22) 0%, transparent 70%)",
                  }}
                />
              )}
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(180deg, transparent 55%, rgba(6,16,30,0.45) 100%)",
                }}
              >
                <Box
                  className="tour-play"
                  sx={{
                    width: { xs: 68, md: 92 },
                    height: { xs: 68, md: 92 },
                    borderRadius: "50%",
                    bgcolor: "rgba(217,168,75,0.95)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                    transition: "transform 200ms ease",
                  }}
                >
                  <Box
                    sx={{
                      width: 0,
                      height: 0,
                      borderLeft: { xs: "22px solid #0A1A2F", md: "30px solid #0A1A2F" },
                      borderTop: { xs: "13px solid transparent", md: "18px solid transparent" },
                      borderBottom: { xs: "13px solid transparent", md: "18px solid transparent" },
                      ml: 1,
                    }}
                  />
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
}
