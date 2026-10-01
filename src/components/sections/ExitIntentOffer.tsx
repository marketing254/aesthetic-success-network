"use client";

import { useEffect, useState } from "react";
import { Box, Button, Dialog, Grow, IconButton, Stack, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";

/**
 * Exit-intent offer — the approved split design: navy gift panel on the
 * left, cream offer panel with the "1 month free" ticket on the right.
 * DIRECT promo auto-applied through /join/member?promo=DIRECT.
 *
 * Triggers (any one of them, once the page has been open 5 seconds):
 *   1. Leaving — the cursor exits through the top of the viewport
 *      (heading for the tab bar / close button). Desktop only.
 *   2. Switching away — the tab is hidden (another tab, another app,
 *      minimise). The offer is waiting when they come back.
 *   3. Going idle — no scroll, mouse, key or touch for 30 seconds.
 *      This one also gives touch devices a way to see the offer.
 *
 * Guardrails:
 *   - Shown at most once per browser session (sessionStorage), never on
 *     /start (the paid-ads page has its own locked offer rules).
 *   - Every claim in the copy is true: 30-day promo trial, founding $29
 *     locked, 30-day guarantee, cancel anytime.
 */
const SESSION_KEY = "asn_exit_offer_shown";
const ARM_DELAY_MS = 5_000;
/** No scroll / mouse / key / touch for this long counts as "stopped reading". */
const IDLE_MS = 30_000;

const INK = "#0A1A2F";
const GOLD = "#D9A84B";
const GOLD_DEEP = "#A07823";
const CREAM = "#FAF6ED";

/** Feather "gift" outline, gold stroke. */
function GiftIcon({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#C89A3F"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

/** Four-point sparkle, animated twinkle (reduced-motion safe). */
function Sparkle({ size, top, left, right, delay = 0 }: {
  size: number; top: string | number; left?: string | number; right?: string | number; delay?: number;
}) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        top,
        left,
        right,
        width: size,
        height: size,
        bgcolor: "#F0C16E",
        clipPath:
          "polygon(50% 0%, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0% 50%, 38% 38%)",
        filter: "drop-shadow(0 0 4px rgba(240,193,110,0.7))",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: `asnTwinkle 2.6s ease-in-out ${delay}s infinite`,
        },
        "@keyframes asnTwinkle": {
          "0%, 100%": { opacity: 0.35, transform: "scale(0.8)" },
          "50%": { opacity: 1, transform: "scale(1.1)" },
        },
      }}
    />
  );
}

/** CSS gift box with gold ribbon + bow and the limited-time badge. */
function GiftBoxArt() {
  return (
    <Box
      sx={{
        position: "relative",
        width: 200,
        height: 168,
        mx: "auto",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: "asnFloat 5s ease-in-out infinite",
        },
        "@keyframes asnFloat": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
      }}
    >
      {/* pedestal glow */}
      <Box aria-hidden sx={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 190, height: 26, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(217,168,75,0.35), transparent)" }} />
      {/* box body */}
      <Box aria-hidden sx={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", width: 124, height: 82, borderRadius: "8px", background: "linear-gradient(150deg, #24466E 0%, #0E2340 80%)", boxShadow: "0 18px 34px -14px rgba(0,0,0,0.6)" }} />
      {/* lid */}
      <Box aria-hidden sx={{ position: "absolute", bottom: 88, left: "50%", transform: "translateX(-50%)", width: 144, height: 28, borderRadius: "6px", background: "linear-gradient(150deg, #2E5482 0%, #16304F 85%)", boxShadow: "0 6px 14px -6px rgba(0,0,0,0.5)" }} />
      {/* vertical ribbon */}
      <Box aria-hidden sx={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", width: 24, height: 104, background: "linear-gradient(180deg, #E8C87E, #C89A3F)", boxShadow: "inset 0 0 6px rgba(120,86,20,0.35)" }} />
      {/* bow loops */}
      <Box aria-hidden sx={{ position: "absolute", bottom: 112, left: "50%", transform: "translateX(-104%) rotate(-24deg)", width: 38, height: 27, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: "linear-gradient(140deg, #F0D9A2, #C89A3F)", boxShadow: "inset -3px -3px 6px rgba(120,86,20,0.35)" }} />
      <Box aria-hidden sx={{ position: "absolute", bottom: 112, left: "50%", transform: "translateX(4%) rotate(24deg)", width: 38, height: 27, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: "linear-gradient(-140deg, #F0D9A2, #C89A3F)", boxShadow: "inset 3px -3px 6px rgba(120,86,20,0.35)" }} />
      {/* bow knot */}
      <Box aria-hidden sx={{ position: "absolute", bottom: 112, left: "50%", transform: "translateX(-50%)", width: 17, height: 17, borderRadius: "50%", background: "linear-gradient(140deg, #F0D9A2, #A07823)" }} />
      {/* limited-time badge */}
      <Box
        sx={{
          position: "absolute",
          right: -4,
          bottom: 6,
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "radial-gradient(circle at 34% 28%, #F0D9A2, #C89A3F 75%)",
          boxShadow: "0 12px 26px -10px rgba(160,120,35,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "asnBadgePulse 3.2s ease-in-out infinite",
          },
          "@keyframes asnBadgePulse": {
            "0%, 100%": { transform: "scale(1)" },
            "50%": { transform: "scale(1.05)" },
          },
        }}
      >
        <Typography sx={{ fontSize: "0.56rem", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#4A3407", lineHeight: 1.5 }}>
          Limited<br />Time<br />Offer
        </Typography>
      </Box>
    </Box>
  );
}

const PERKS = [
  { icon: ShieldOutlinedIcon, label: <>Full member<br />access</> },
  { icon: LocalOfferOutlinedIcon, label: <>$29/month after,<br />locked while active</> },
  { icon: VerifiedOutlinedIcon, label: <>30-day<br />money-back guarantee</> },
];

export default function ExitIntentOffer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      return; // storage unavailable → never risk a repeat-nag
    }
    let armed = false;
    let shown = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const ACTIVITY_EVENTS = ["scroll", "wheel", "mousemove", "keydown", "pointerdown", "touchstart"] as const;

    // Fire the offer once, from whichever trigger wins, then disarm all.
    const show = () => {
      if (shown || !armed) return;
      shown = true;
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return;
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* still show once for this page view */
      }
      setOpen(true);
      teardown();
    };

    // 1. Cursor leaves through the top (tab bar / close button).
    const onMouseOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0) return;
      show();
    };

    // 2. Tab hidden — another tab, app, or minimised. Opens now so it is
    //    waiting on return.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") show();
    };

    // 3. Idle — no interaction for IDLE_MS. Any activity resets the clock.
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(show, IDLE_MS);
    };

    const teardown = () => {
      if (idleTimer) clearTimeout(idleTimer);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, resetIdle);
    };

    const armTimer = setTimeout(() => {
      armed = true;
      resetIdle(); // idle clock starts once armed
    }, ARM_DELAY_MS);

    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("visibilitychange", onVisibility);
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, resetIdle, { passive: true });

    return () => {
      clearTimeout(armTimer);
      teardown();
    };
  }, []);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="md"
      fullWidth
      slots={{ transition: Grow }}
      transitionDuration={380}
      slotProps={{
        backdrop: { sx: { bgcolor: "rgba(6,14,26,0.74)", backdropFilter: "blur(3px)" } },
        paper: { sx: { bgcolor: "transparent", boxShadow: "none", overflow: "visible", borderRadius: 0 } },
      }}
    >
      {/* ── The card ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 50px 110px -28px rgba(6,14,26,0.8)",
        }}
      >
        {/* Left: navy gift panel (hidden on small screens) */}
        <Box
          sx={{
            flex: "0 0 300px",
            display: { xs: "none", sm: "flex" },
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            px: 4,
            py: 5,
            textAlign: "center",
            background: "linear-gradient(165deg, #17335A 0%, #0A1A2F 75%)",
          }}
        >
          {/* thin gold orbit lines */}
          <Box aria-hidden sx={{ position: "absolute", top: -140, left: -110, width: 340, height: 340, borderRadius: "50%", border: "1px solid rgba(217,168,75,0.28)" }} />
          <Box aria-hidden sx={{ position: "absolute", top: -170, left: -90, width: 380, height: 380, borderRadius: "50%", border: "1px solid rgba(217,168,75,0.14)" }} />
          <Sparkle size={16} top={54} left={116} />
          <Sparkle size={9} top={38} left={168} delay={1.1} />
          <Sparkle size={7} top={78} left={82} delay={0.5} />

          <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, mt: 5, mb: 1.25 }}>
            Before you go
          </Typography>
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "1.72rem",
              fontWeight: 600,
              color: "#F6F1E7",
              lineHeight: 1.18,
              letterSpacing: "-0.01em",
            }}
          >
            Don&apos;t leave
            <Box component="span" sx={{ display: "block", fontStyle: "italic", color: "#F0C16E" }}>
              empty-handed.
            </Box>
          </Typography>
          <Box aria-hidden sx={{ width: 56, height: 2, mx: "auto", my: 1.75, background: "linear-gradient(90deg, transparent, rgba(217,168,75,0.9), transparent)" }} />
          <Typography sx={{ fontSize: "0.86rem", color: "rgba(246,241,231,0.78)", lineHeight: 1.6, mb: 3 }}>
            As a <b style={{ color: "#F6F1E7" }}>thank you</b>, enjoy an exclusive offer made just for you.
          </Typography>
          <GiftBoxArt />
        </Box>

        {/* Right: cream offer panel */}
        <Box sx={{ flex: 1, position: "relative", bgcolor: CREAM, px: { xs: 3, sm: 5 }, pt: 4, pb: 3.5, textAlign: "center" }}>
          <IconButton
            onClick={() => setOpen(false)}
            aria-label="Close"
            size="small"
            sx={{ position: "absolute", top: 12, right: 14, color: "#8A94A0", "&:hover": { color: INK, bgcolor: "rgba(10,26,47,0.06)" } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 22 }} />
          </IconButton>

          {/* gift emblem with side sparkles */}
          <Stack direction="row" spacing={3.5} sx={{ alignItems: "center", justifyContent: "center", mb: 1.5, position: "relative" }}>
            <Sparkle size={12} top={18} left="calc(50% - 92px)" delay={0.6} />
            <Box
              sx={{
                width: 74,
                height: 74,
                borderRadius: "50%",
                border: "1.5px solid rgba(200,154,63,0.55)",
                bgcolor: "#FFFDF8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 24px -14px rgba(160,120,35,0.5)",
              }}
            >
              <GiftIcon />
            </Box>
            <Sparkle size={12} top={18} right="calc(50% - 92px)" delay={1.4} />
          </Stack>

          <Typography sx={{ fontSize: "0.98rem", color: "#3B4A55", mb: 0.25 }}>
            Here&apos;s something special
          </Typography>
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.5rem", sm: "1.8rem" },
              fontWeight: 600,
              color: INK,
              letterSpacing: "-0.015em",
              lineHeight: 1.15,
              mb: 2.25,
            }}
          >
            for staying{" "}
            <Box component="span" sx={{ fontStyle: "italic", color: GOLD_DEEP }}>
              with us.
            </Box>
          </Typography>

          {/* the ticket */}
          <Box sx={{ position: "relative", border: "1.5px solid rgba(200,154,63,0.6)", borderRadius: "8px", px: 3, py: 2.25, mb: 2.5, bgcolor: "rgba(255,253,248,0.6)" }}>
            {/* corner notches */}
            {[
              { top: -8, left: -8 }, { top: -8, right: -8 },
              { bottom: -8, left: -8 }, { bottom: -8, right: -8 },
            ].map((pos, i) => (
              <Box key={i} aria-hidden sx={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", bgcolor: CREAM, ...pos }} />
            ))}
            <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.34em", textTransform: "uppercase", color: GOLD_DEEP, mb: 0.25 }}>
              Enjoy
            </Typography>
            <Typography
              sx={{
                fontFamily: "var(--font-display)",
                fontSize: { xs: "2rem", sm: "2.5rem" },
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.015em",
                background: `linear-gradient(100deg, ${GOLD_DEEP}, #C89A3F 55%, ${GOLD_DEEP})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              1 month free
            </Typography>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "#243244", mt: 0.5 }}>
              Founding membership
            </Typography>
          </Box>

          {/* perk columns */}
          <Stack direction="row" sx={{ mb: 2.75, alignItems: "stretch" }}>
            {PERKS.map(({ icon: Icon, label }, i) => (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  px: 1,
                  borderLeft: i > 0 ? "1px solid rgba(200,154,63,0.3)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.75,
                }}
              >
                <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: "rgba(217,168,75,0.14)", border: "1px solid rgba(217,168,75,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon sx={{ fontSize: 17, color: GOLD_DEEP }} />
                </Box>
                <Typography sx={{ fontSize: "0.74rem", color: "#3B4A55", lineHeight: 1.45 }}>{label}</Typography>
              </Box>
            ))}
          </Stack>

          {/* CTA with shimmer sweep */}
          <Button
            href="/join/member?promo=DIRECT"
            fullWidth
            disableElevation
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 19 }} />}
            sx={{
              "&&": {
                position: "relative",
                overflow: "hidden",
                background: "linear-gradient(120deg, #C89A3F 0%, #E2BC6B 50%, #C89A3F 100%)",
                color: "#241A06",
                fontWeight: 800,
                fontSize: "1rem",
                textTransform: "none",
                py: 1.6,
                borderRadius: "10px",
                boxShadow: "0 16px 34px -14px rgba(160,120,35,0.6)",
                transition: "transform .18s ease, box-shadow .18s ease",
              },
              "&&:hover": { transform: "translateY(-1px)", boxShadow: "0 20px 40px -14px rgba(160,120,35,0.7)" },
              "&&::after": {
                content: '""',
                position: "absolute",
                top: 0,
                bottom: 0,
                left: "-40%",
                width: "36%",
                background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.5), transparent)",
                transform: "skewX(-18deg)",
              },
              "@media (prefers-reduced-motion: no-preference)": {
                "&&::after": { animation: "asnShimmer 3.4s ease-in-out infinite" },
              },
              "@keyframes asnShimmer": {
                "0%": { left: "-40%" },
                "45%, 100%": { left: "125%" },
              },
            }}
          >
            Claim My Free Month
          </Button>
          <Typography sx={{ mt: 1.25, fontSize: "0.76rem", color: "#7A8590" }}>
            Applied automatically at checkout, nothing to type.
          </Typography>
          <Box
            component="button"
            onClick={() => setOpen(false)}
            sx={{
              mt: 1.25,
              border: 0,
              bgcolor: "transparent",
              color: "#8A94A0",
              fontSize: "0.8rem",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              fontFamily: "inherit",
              "&:hover": { color: INK },
            }}
          >
            No thanks, I&apos;ll pass
          </Box>
        </Box>
      </Box>

      {/* caption under the card */}
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: "center", mt: 1.75 }}>
        <LockOutlinedIcon sx={{ fontSize: 14, color: "rgba(246,241,231,0.6)" }} />
        <Typography sx={{ fontSize: "0.8rem", color: "rgba(246,241,231,0.6)" }}>
          100% Secure&nbsp;&nbsp;·&nbsp;&nbsp;Cancel anytime
        </Typography>
      </Stack>
    </Dialog>
  );
}
