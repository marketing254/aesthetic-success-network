"use client";

import Link from "next/link";
import { Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import type { SvgIconComponent } from "@mui/icons-material";

/**
 * FoundingCard — the member pricing card, built to the 18 Aug 2026 spec
 * ("Pricing card: full build spec"). TWO STATES, never mixed:
 *
 *   State 1 (no code):    anchor price struck, $49/mo or $441/yr, lock
 *                         chip, "No trial — 30-day money-back guarantee"
 *                         fine print, CTA "Claim your founding rate".
 *   State 2 (code applied): gold applied chip at the TOP of the price
 *                         block, "$0 due today / then $49/mo from <date>"
 *                         with the REAL first-charge date, trial fine
 *                         print, CTA "Start my 3 months free", reminder
 *                         disclosure under the button.
 *
 * Seat counter stays hidden until fewer than 60 of 100 founding seats
 * remain. Annual is $441 (9 months buys 12 — permanent rate, not intro).
 * No video-tour link anywhere on this card.
 */

const CARD_BG = "#171A1F";
const HEADER_BG = "#12325A";
const CARD_LINE = "rgba(255,255,255,0.09)";
const TXT = "#F4F1EA";
const TXT_SOFT = "rgba(244,241,234,0.72)";
const TXT_MUTED = "rgba(244,241,234,0.5)";
const GOLD = "#D9A84B";
const GOLD_DEEP = "#C8922E";

const WHATS_INSIDE: { icon: SvgIconComponent; title: string; body: string }[] = [
  {
    icon: PeopleAltOutlinedIcon,
    title: "The expert directory",
    body: "Every expert in the network, what they do and how to reach them. Curated by the team behind Business of Aesthetics, not an algorithm.",
  },
  {
    icon: StorefrontOutlinedIcon,
    title: "The company directory",
    body: "Vetted companies with member-only offers on the software, supplies and services you already pay for.",
  },
  {
    icon: LibraryBooksOutlinedIcon,
    title: "Kits and courses",
    body: "A growing library of kits, each with an action guide, checklist, worksheet and video. Plus full courses from the experts themselves.",
  },
  {
    icon: SupportAgentOutlinedIcon,
    title: "The expert hotline",
    body: "Leave a voicemail with any practice problem. You get a written action plan by text and email within 2 to 3 business days, AI-assisted.",
  },
  {
    icon: CalculateOutlinedIcon,
    title: "Calculators and tools",
    body: "Built for aesthetic practice owners, ready in the portal.",
  },
];

export type PromoModule = {
  state: "idle" | "open";
  input: string;
  busy: boolean;
  error: string | null;
  applied: { code: string; ownerName: string | null; trialDays: number } | null;
  onOpen: () => void;
  onInput: (v: string) => void;
  onApply: () => void;
  onRemove: () => void;
};

type TierKey = "founding" | "early" | "standard";

const TIER_HEAD: Record<TierKey, { title: string; sub: string }> = {
  founding: { title: "Founding", sub: "Founding rate · first 100 members" },
  // The $99 early tier does not exist at ASN (EARLY_MEMBER_CAP = 0). The
  // key stays so the plan plumbing compiles; if it ever renders it reads
  // exactly like Standard.
  early: { title: "Standard", sub: "Full membership" },
  standard: { title: "Standard", sub: "Full membership" },
};

// FINAL pricing decision (18 Aug 2026): standard annual is $490; when a
// 3-month code is applied the annual becomes $441 after the free months.
// The $441 Stripe Price lives in STRIPE_PRICE_FOUNDING_ANNUAL_PROMO and
// is used ONLY for promo-annual checkouts.
const PRICES: Record<TierKey, { mo: string; yr: string }> = {
  founding: { mo: "$49", yr: "$490" },
  early: { mo: "$199", yr: "$1,990" },
  standard: { mo: "$199", yr: "$1,990" },
};
const FOUNDING_PROMO_ANNUAL = "$441";

function firstChargeDate(trialDays: number): string {
  const d = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(d);
}

export default function FoundingCard({
  tier,
  interval,
  remaining,
  ctaLabel,
  ctaBusy,
  onCta,
  ctaHref,
  promo,
  note,
}: {
  tier: TierKey;
  interval: "monthly" | "annual";
  remaining?: number | null;
  ctaLabel: string;
  ctaBusy?: boolean;
  onCta?: () => void;
  ctaHref?: string;
  promo?: PromoModule;
  note?: string | null;
}) {
  const head = TIER_HEAD[tier];
  const price = PRICES[tier];
  const applied = promo?.applied ?? null;
  const chargeDate = applied ? firstChargeDate(applied.trialDays) : null;
  // Free-period wording follows the code's actual trial length (30-day
  // welcome codes vs 90-day partner/expert codes).
  const freeMonths = applied ? Math.max(1, Math.round(applied.trialDays / 30)) : 0;
  const freeLabel = `${freeMonths} month${freeMonths === 1 ? "" : "s"} free`;
  // The $441 promo-annual price is a 3-month-code deal only.
  const promoAnnual = !!applied && applied.trialDays >= 90;
  const finalCta = applied ? (freeMonths === 1 ? "Start my free month" : `Start my ${freeMonths} months free`) : ctaLabel;
  // Scarcity counter only once it means something: under 60 seats left.
  const showCounter = tier === "founding" && typeof remaining === "number" && remaining < 60;

  return (
    <Box
      sx={{
        borderRadius: "16px",
        border: `1.5px solid ${GOLD}`,
        bgcolor: CARD_BG,
        color: TXT,
        overflow: "hidden",
        boxShadow: "0 30px 70px -30px rgba(10,26,47,0.65)",
      }}
    >
      {/* Header band */}
      <Box sx={{ bgcolor: HEADER_BG, px: 3, py: 2 }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Box>
            <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.45rem", fontWeight: 600, color: "#FFFFFF", lineHeight: 1.15 }}>
              {head.title}
            </Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.72)", mt: 0.25 }}>
              {head.sub}
            </Typography>
          </Box>
          {showCounter && (
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.08em", color: GOLD, whiteSpace: "nowrap", textTransform: "uppercase" }}>
              {remaining} of 100 left
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Price block */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2.25, textAlign: "center", borderBottom: `1px solid ${CARD_LINE}` }}>
        {applied ? (
          <>
            {/* Applied-code chip — gold, top of the price block. Company
                name, never just the raw code. */}
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.75,
                py: 0.8,
                mb: 2,
                borderRadius: 999,
                bgcolor: "rgba(217,168,75,0.16)",
                border: `1px solid ${GOLD}`,
                color: GOLD,
                fontSize: "0.84rem",
                fontWeight: 700,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <CheckRoundedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
              <Box component="span">
                {applied.code} applied: {freeLabel}, courtesy of {applied.ownerName ?? "the ASN team"}
              </Box>
              <Box
                component="button"
                type="button"
                onClick={promo?.onRemove}
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "rgba(217,168,75,0.75)",
                  textDecoration: "underline",
                  ml: 0.5,
                  "&:hover": { color: GOLD },
                }}
              >
                Remove
              </Box>
            </Box>

            <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", fontWeight: 600, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.02em" }}>
              $0 due today
            </Typography>
            <Typography sx={{ fontSize: "0.95rem", color: TXT_SOFT, mt: 1 }}>
              {interval === "monthly" ? (
                <>then {price.mo}/mo from {chargeDate}</>
              ) : tier === "founding" && promoAnnual ? (
                <>
                  <Box component="span" sx={{ textDecoration: "line-through", color: TXT_MUTED, mr: 0.75 }}>
                    $490
                  </Box>
                  then {FOUNDING_PROMO_ANNUAL}/yr from {chargeDate}
                </>
              ) : (
                <>then {price.yr}/yr from {chargeDate}</>
              )}
            </Typography>
            <Typography sx={{ fontSize: "0.76rem", color: TXT_MUTED, mt: 1.5, lineHeight: 1.6 }}>
              {freeLabel} with {applied.code} · cancel any time before {chargeDate} and you pay
              nothing · 30-day money-back guarantee after that
            </Typography>
          </>
        ) : (
          <>
            {tier === "founding" && interval === "monthly" && (
              <Typography sx={{ fontSize: "1rem", color: TXT_MUTED, textDecoration: "line-through", textDecorationColor: "rgba(244,241,234,0.45)", mb: 0.25 }}>
                $199 /mo
              </Typography>
            )}
            <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center", alignItems: "baseline" }}>
              <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "3rem", fontWeight: 600, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.02em" }}>
                {interval === "monthly" ? price.mo : price.yr}
              </Typography>
              <Typography sx={{ fontSize: "1.05rem", color: TXT_SOFT, fontWeight: 500 }}>
                /{interval === "monthly" ? "mo" : "yr"}
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: "0.9rem", color: TXT_SOFT, mt: 0.75 }}>
              {interval === "monthly" ? `or ${price.yr} a year` : `or ${price.mo} a month`}
            </Typography>
            {tier === "founding" && (
              <Box
                sx={{
                  display: "inline-block",
                  mt: 1.5,
                  px: 2,
                  py: 0.7,
                  borderRadius: 999,
                  bgcolor: "rgba(217,168,75,0.16)",
                  border: `1px solid ${GOLD}`,
                  color: GOLD,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {interval === "monthly"
                  ? "Locked for life at $49, even when it goes to $199"
                  : "Locked for life at $490, even when it goes to $199/mo equivalent"}
              </Box>
            )}
            <Typography sx={{ fontSize: "0.76rem", color: TXT_MUTED, mt: 1.5 }}>
              No trial · 30-day money-back guarantee · Cancel anytime
            </Typography>
          </>
        )}
      </Box>

      {/* What's inside */}
      <Box sx={{ px: 3, pt: 2.5 }}>
        <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.18em", color: TXT_MUTED, textTransform: "uppercase", mb: 1.75 }}>
          What&apos;s inside
        </Typography>
        <Stack spacing={1.9}>
          {WHATS_INSIDE.map(({ icon: Icon, title, body }) => (
            <Stack key={title} direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
              <Icon sx={{ fontSize: 19, color: GOLD, mt: 0.3, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: TXT, lineHeight: 1.35 }}>
                  {title}
                </Typography>
                <Typography sx={{ fontSize: "0.85rem", color: TXT_SOFT, lineHeight: 1.55, mt: 0.2 }}>
                  {body}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* Tier extras */}
      {tier === "founding" && (
        <Box sx={{ px: 3, pt: 2.75 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.18em", color: TXT_MUTED, textTransform: "uppercase", mb: 1.5 }}>
            Founding members also get
          </Typography>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
              <StarRoundedIcon sx={{ fontSize: 18, color: GOLD, mt: 0.25, flexShrink: 0 }} />
              <Typography sx={{ fontSize: "0.88rem", color: TXT_SOFT, lineHeight: 1.5 }}>
                <Box component="strong" sx={{ color: TXT, fontWeight: 700 }}>Your rate locked for life</Box>, even when it rises for everyone else
              </Typography>
            </Stack>
            {tier === "founding" && (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                <StarRoundedIcon sx={{ fontSize: 18, color: GOLD, mt: 0.25, flexShrink: 0 }} />
                <Typography sx={{ fontSize: "0.88rem", color: TXT_SOFT, lineHeight: 1.5 }}>
                  <Box component="strong" sx={{ color: TXT, fontWeight: 700 }}>A say in what we build next.</Box> We ask, and we act on it
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      )}

      {/* Rate-lock promise band */}
      {note && !applied && (
        <Box
          sx={{
            mx: 3,
            mt: 2.75,
            px: 2,
            py: 1.25,
            borderRadius: "10px",
            bgcolor: "rgba(217,168,75,0.12)",
            border: "1px solid rgba(217,168,75,0.4)",
            display: "flex",
            gap: 1.25,
            alignItems: "flex-start",
          }}
        >
          <StarRoundedIcon sx={{ fontSize: 17, color: GOLD, mt: 0.2, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.88rem", color: TXT, lineHeight: 1.55, fontWeight: 600 }}>
            {note}
          </Typography>
        </Box>
      )}

      {/* CTA */}
      <Box sx={{ px: 3, pt: note && !applied ? 2 : 3, pb: 2.5 }}>
        <Button
          fullWidth
          disableElevation
          disabled={ctaBusy}
          {...(ctaHref ? { component: Link, href: ctaHref } : { onClick: onCta })}
          startIcon={ctaBusy ? <CircularProgress size={15} sx={{ color: "#0A1A2F" }} /> : null}
          sx={{
            bgcolor: GOLD_DEEP,
            "&&": { color: "#14181F" },
            fontSize: "1.02rem",
            fontWeight: 800,
            textTransform: "none",
            borderRadius: "10px",
            py: 1.4,
            transition: "background-color 200ms ease, transform 200ms ease",
            "&&:hover": { bgcolor: GOLD, transform: "translateY(-1px)" },
            "&.Mui-disabled": { bgcolor: "rgba(217,168,75,0.45)", color: "#14181F" },
            "&:focus-visible": { outline: `2px solid ${TXT}`, outlineOffset: 2 },
          }}
        >
          {finalCta}
        </Button>

        {/* Under the button: guarantee/reminder line, then the quiet
            invitation-code link. Nothing else. */}
        <Typography sx={{ mt: 1.25, fontSize: "0.76rem", color: TXT_MUTED, textAlign: "center", lineHeight: 1.6 }}>
          {applied
            ? `We will remind you by email 7 days before your first payment on ${chargeDate}. Cancel any time in one click.`
            : "Secure checkout via Stripe"}
        </Typography>

        {promo && !applied && (
          <Box sx={{ mt: 1.5 }}>
            {promo.state === "open" ? (
              <>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    autoFocus
                    fullWidth
                    placeholder="Invitation code"
                    value={promo.input}
                    onChange={(e) => promo.onInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        promo.onApply();
                      }
                    }}
                    slotProps={{
                      input: {
                        sx: {
                          color: TXT,
                          fontSize: "0.94rem",
                          letterSpacing: "0.08em",
                          bgcolor: "rgba(255,255,255,0.05)",
                          "& fieldset": { borderColor: CARD_LINE },
                          "&:hover fieldset": { borderColor: "rgba(255,255,255,0.25)" },
                          "&.Mui-focused fieldset": { borderColor: GOLD },
                        },
                      },
                    }}
                  />
                  <Button
                    disableElevation
                    disabled={promo.busy || !promo.input.trim()}
                    onClick={promo.onApply}
                    sx={{
                      border: `1px solid ${CARD_LINE}`,
                      "&&": { color: TXT },
                      textTransform: "none",
                      fontWeight: 700,
                      borderRadius: "8px",
                      px: 2.5,
                      flexShrink: 0,
                      "&:hover": { borderColor: GOLD, bgcolor: "rgba(217,168,75,0.1)" },
                      "&.Mui-disabled": { color: TXT_MUTED, borderColor: CARD_LINE },
                    }}
                  >
                    {promo.busy ? "Checking…" : "Apply"}
                  </Button>
                </Stack>
                {promo.error && (
                  <Typography sx={{ mt: 0.75, fontSize: "0.8rem", color: "#E5A9A9", textAlign: "center" }}>
                    {promo.error}
                  </Typography>
                )}
              </>
            ) : (
              <Box sx={{ textAlign: "center" }}>
                <Box
                  component="button"
                  type="button"
                  onClick={promo.onOpen}
                  sx={{
                    all: "unset",
                    cursor: "pointer",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    color: GOLD,
                    "&:hover": { color: "#E5BA63" },
                    "&:focus-visible": { outline: `2px solid ${GOLD}`, outlineOffset: 3 },
                  }}
                >
                  Have an invitation code?
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
