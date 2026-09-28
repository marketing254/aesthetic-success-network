"use client";

import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";

/**
 * BookCoachingCard — coaching CTA shown at the bottom of every kit detail
 * page in the member portal.
 *
 * Attributed kits: pass `expert` and the card features the kit's OWN
 * expert — their face, name, company, and their scheduler. Their booking
 * link opens in a new tab (external schedulers often refuse iframes).
 *
 * House kits (no attributed expert): the card only renders when
 * NEXT_PUBLIC_COACHING_BOOKING_URL is set. There is no default scheduler
 * and no default coach; with the env var unset the card is simply absent.
 */
const COACHING_BOOKING_URL = process.env.NEXT_PUBLIC_COACHING_BOOKING_URL ?? "";
const HOUSE_NAME = "the ASN team";

export type KitExpert = {
  name: string;
  headshot_url: string | null;
  booking_link: string | null;
  specialty?: string | null;
  company_name?: string | null;
};

export function BookCoachingCard({ topicTitle, expert }: { topicTitle?: string; expert?: KitExpert | null }) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const featured = expert ?? null;

  // No attributed expert and no configured scheduler: nothing to offer.
  if (!featured && !COACHING_BOOKING_URL) return null;

  const displayName = featured?.name ?? HOUSE_NAME;
  // Short address form for buttons/copy: "Dr. Jane Doe" → "Dr. Doe",
  // "Jane Doe, RN" → "Jane".
  const baseName = (displayName.split(",")[0] ?? displayName).trim();
  const nameParts = baseName.split(/\s+/);
  const firstName = featured
    ? /^dr\.?$/i.test(nameParts[0] ?? "")
      ? `Dr. ${nameParts[nameParts.length - 1]}`
      : (nameParts[0] ?? baseName)
    : HOUSE_NAME;
  const avatarSrc = featured ? (featured.headshot_url ?? undefined) : undefined;
  const initials = featured
    ? displayName
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "ASN";

  return (
    <>
      <Box
        sx={{
          borderRadius: 2,
          border: "1px solid rgba(14,42,61,0.08)",
          bgcolor: "var(--paper, #FBF8F1)",
          overflow: "hidden",
          boxShadow: "0 1px 0 rgba(14,42,61,0.02)",
          backgroundImage:
            "linear-gradient(135deg, rgba(217,168,75,0.06) 0%, transparent 55%)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 2, md: 3 }}
          sx={{
            alignItems: { md: "center" },
            justifyContent: "space-between",
            px: { xs: 2, md: 3 },
            py: { xs: 2.25, md: 2.5 },
          }}
        >
          {/* Left — presenter intro */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1.5, sm: 2 }}
            sx={{ alignItems: { sm: "center" }, flex: 1, minWidth: 0 }}
          >
            <Avatar
              alt={displayName}
              src={avatarSrc}
              sx={{
                width: { xs: 60, md: 68 },
                height: { xs: 60, md: 68 },
                bgcolor: "var(--ink, #0A1A2F)",
                color: "var(--gold, #F0C16E)",
                fontFamily: "var(--font-display)",
                fontSize: featured ? "1.2rem" : "0.95rem",
                fontWeight: 600,
                border: "2px solid rgba(217,168,75,0.45)",
                boxShadow: "0 6px 16px -8px rgba(14,42,61,0.3)",
                flexShrink: 0,
                "& img": {
                  // Subtly favor the face — most headshots have the subject
                  // slightly above center, so anchor the focal point upward.
                  objectPosition: "center 22%",
                },
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.4 }}>
                <Typography
                  sx={{
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    letterSpacing: "0.16em",
                    color: "var(--gold-deep, #A07823)",
                    textTransform: "uppercase",
                  }}
                >
                  {featured ? "Meet your expert" : "1-on-1 strategy call"}
                </Typography>
                <VerifiedRoundedIcon
                  sx={{ fontSize: 13, color: "var(--gold, #F0C16E)" }}
                  aria-hidden
                />
              </Stack>
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.05rem", md: "1.15rem" },
                  fontWeight: 500,
                  color: "var(--ink, #0A1A2F)",
                  lineHeight: 1.25,
                  mb: 0.4,
                }}
              >
                Go deeper with {displayName}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.84rem",
                  color: "var(--ink-soft, #3B4A55)",
                  lineHeight: 1.55,
                  maxWidth: 540,
                }}
              >
                {featured
                  ? topicTitle
                    ? `${firstName} built this kit. Bring your questions about ${topicTitle} straight to ${firstName}${featured.booking_link ? ", or book a session below" : " in the discussion below"}.`
                    : `${firstName} built this kit. Bring your questions straight to the source.`
                  : topicTitle
                    ? `Bring your questions about ${topicTitle}, or anything else about running your practice, to a focused 30-minute strategy call.`
                    : "Bring your hardest practice question to a focused 30-minute strategy call."}
              </Typography>
              {featured ? (
                // Aligned label/value grid — the label column sizes to the
                // widest label so every value starts on the same axis, and
                // a long specialty clamps to two lines instead of sprawling
                // wider than the intro copy above it.
                <Box
                  sx={{
                    mt: 1.25,
                    display: "grid",
                    gridTemplateColumns: "max-content 1fr",
                    columnGap: 1.5,
                    rowGap: 0.6,
                    alignItems: "baseline",
                    maxWidth: 540,
                  }}
                >
                  {featured.specialty && (
                    <>
                      <MetaLabel text="Expertise" />
                      <MetaValue clamp>{featured.specialty}</MetaValue>
                    </>
                  )}
                  {featured.company_name && (
                    <>
                      <MetaLabel text="Company" />
                      <MetaValue>{featured.company_name}</MetaValue>
                    </>
                  )}
                  <MetaLabel text="Status" />
                  <MetaValue>ASN Expert</MetaValue>
                </Box>
              ) : (
                <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: "wrap", rowGap: 0.5 }}>
                  <MiniMeta label="With" value="Aesthetic Success Network" />
                  <MiniMeta label="Format" value="30 min · video call" />
                </Stack>
              )}
            </Box>
          </Stack>

          {/* Right — CTA. Expert schedulers open in a new tab (external
              booking pages often refuse to render inside an iframe). */}
          <Box sx={{ flexShrink: 0, width: { xs: "100%", md: "auto" } }}>
            {featured && !featured.booking_link ? null : (
              <Button
                {...(featured && featured.booking_link
                  ? { component: "a" as const, href: featured.booking_link, target: "_blank", rel: "noopener noreferrer" }
                  : { onClick: () => setOpen(true) })}
                variant="contained"
                size="large"
                disableElevation
                startIcon={<CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />}
                sx={{
                  bgcolor: "var(--ink, #0A1A2F)",
                  color: "#FFFFFF",
                  textTransform: "none",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  borderRadius: 1,
                  px: 2.5,
                  py: 1.25,
                  width: { xs: "100%", md: "auto" },
                  boxShadow: "0 8px 22px -10px rgba(14,42,61,0.4)",
                  "&:hover": {
                    bgcolor: "var(--gold-deep, #A07823)",
                    boxShadow: "0 10px 26px -10px rgba(217,168,75,0.55)",
                  },
                  "&:focus-visible": {
                    outline: "2px solid var(--gold, #F0C16E)",
                    outlineOffset: 3,
                  },
                }}
              >
                {featured ? `Book with ${firstName}` : "Book a strategy call"}
              </Button>
            )}
          </Box>
        </Stack>

        {/* Disclaimer — sits directly below the CTA row, bold and high-contrast
            so members read it before they click. */}
        <Box
          sx={{
            mt: 1.25,
            px: { xs: 2, md: 3 },
            pb: { xs: 1.75, md: 2 },
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: "0.82rem", md: "0.86rem" },
              fontWeight: 700,
              color: "var(--gold-deep, #A07823)",
              lineHeight: 1.5,
              textAlign: { xs: "center", md: "right" },
            }}
          >
            Experts may offer their own services when you reach out. Always your choice.
          </Typography>
        </Box>
      </Box>

      {!featured && COACHING_BOOKING_URL && (
        <BookingDialog
          open={open}
          onClose={() => setOpen(false)}
          fullScreen={fullScreen}
          bookingUrl={COACHING_BOOKING_URL}
        />
      )}
    </>
  );
}

function BookingDialog({
  open,
  onClose,
  fullScreen,
  bookingUrl,
}: {
  open: boolean;
  onClose: () => void;
  fullScreen: boolean;
  bookingUrl: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 2,
            overflow: "hidden",
            bgcolor: "#FFFFFF",
            border: fullScreen ? "none" : "1px solid rgba(14,42,61,0.08)",
            boxShadow: "0 32px 64px -32px rgba(14,42,61,0.4)",
            // Cap height so the calendar stays scrollable inside the modal
            // and the page underneath doesn't jump around.
            height: fullScreen ? "100%" : "min(820px, 92vh)",
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {/* Header strip */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: { xs: 2, md: 2.5 },
          py: 1.5,
          borderBottom: "1px solid rgba(14,42,61,0.08)",
          flexShrink: 0,
          bgcolor: "#FBF8F1",
        }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 0.75,
            bgcolor: "rgba(217,168,75,0.16)",
            color: "var(--gold-deep, #A07823)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <CalendarMonthRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.6rem",
              fontWeight: 800,
              letterSpacing: "0.16em",
              color: "var(--gold-deep, #A07823)",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            Strategy call
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "0.92rem", md: "1rem" },
              fontWeight: 600,
              color: "var(--ink, #0A1A2F)",
              lineHeight: 1.2,
              mt: 0.25,
            }}
          >
            Book a 30-min session with the ASN team
          </Typography>
        </Box>
        <IconButton
          component="a"
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in new tab"
          size="small"
          sx={{
            color: "var(--ink-fade, #7A8590)",
            "&:hover": { color: "var(--ink, #0A1A2F)", bgcolor: "rgba(14,42,61,0.04)" },
          }}
        >
          <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          onClick={onClose}
          aria-label="Close"
          size="small"
          sx={{
            color: "var(--ink-fade, #7A8590)",
            "&:hover": { color: "var(--ink, #0A1A2F)", bgcolor: "rgba(14,42,61,0.04)" },
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* The scheduler opens in a new tab. External booking pages are not
          allowed by the site's frame-src policy and most refuse to render
          inside an iframe anyway. */}
      <Box sx={{ flex: 1, minHeight: 0, bgcolor: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
        <Box sx={{ textAlign: "center", maxWidth: 420 }}>
          <Typography sx={{ fontFamily: "var(--font-display, Fraunces, serif)", fontSize: "1.35rem", color: "var(--ink, #0A1A2F)", mb: 1 }}>
            Pick a time with the ASN team
          </Typography>
          <Typography sx={{ fontSize: "0.95rem", color: "var(--ink-soft, #3B4A55)", mb: 2.5 }}>
            The booking page opens in a new tab. Choose a slot and you will get a calendar invite by email.
          </Typography>
          <Box
            component="a"
            href={bookingUrl}
            target="_blank"
            rel="noreferrer noopener"
            sx={{
              display: "inline-block",
              borderRadius: 999,
              px: 3,
              py: 1.25,
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
              bgcolor: "var(--navy, #0E2A3D)",
              color: "#FFFFFF",
            }}
          >
            Open the booking page
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}

function MetaLabel({ text }: { text: string }) {
  return (
    <Typography
      sx={{
        fontSize: "0.62rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: "var(--ink-fade, #7A8590)",
        textTransform: "uppercase",
        lineHeight: 1.5,
      }}
    >
      {text}
    </Typography>
  );
}

function MetaValue({ children, clamp = false }: { children: React.ReactNode; clamp?: boolean }) {
  return (
    <Typography
      sx={{
        fontSize: "0.78rem",
        fontWeight: 600,
        color: "var(--ink, #0A1A2F)",
        lineHeight: 1.5,
        ...(clamp
          ? {
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }
          : null),
      }}
    >
      {children}
    </Typography>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "baseline" }}>
      <Typography
        sx={{
          fontSize: "0.62rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "var(--ink-fade, #7A8590)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--ink, #0A1A2F)" }}>
        {value}
      </Typography>
    </Stack>
  );
}
