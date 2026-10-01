"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";

/**
 * ReferralCard: drop-in block for expert/company portal dashboards.
 *
 * Fetches the role's referral code from the provided endpoint, shows the
 * short code + a copyable referral URL, and a small "this month / lifetime"
 * stats row so they can see their impact at a glance.
 *
 * `accent` is kept for API compatibility; the card uses the community
 * palette (white card, sand link field, navy buttons, gold highlight).
 */

const NAVY = "#0A1320";
const INK = "#0A1320";
const BODY = "#3B4451";
const MUTED = "#6B7280";
const LINE = "rgba(10,19,32,0.06)";
const LINE_STRONG = "rgba(10,19,32,0.14)";
const SAND = "#F3EBDD";
const SAND_SOFT = "#F8F4EC";
const GOLD_DEEP = "#B8862F";
const SHADOW = "0 1px 2px rgba(10,19,32,0.04), 0 8px 24px -16px rgba(10,19,32,0.12)";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export default function ReferralCard({
  endpoint,
  accent: _accent,
}: {
  endpoint: string;
  accent?: string;
}) {
  void _accent;
  const [code, setCode] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [signupsLifetime, setSignupsLifetime] = useState(0);
  const [signupsLast30, setSignupsLast30] = useState(0);
  const [conversions, setConversions] = useState(0);
  const [promo, setPromo] = useState<{ code: string; active: boolean; trialDays: number; uses: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [justCopied, setJustCopied] = useState<"code" | "link" | "promo" | null>(null);

  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { code?: string; slug?: string; signupsLifetime?: number; signupsLast30?: number; conversions?: number; promo?: { code: string; active: boolean; trialDays: number; uses: number } | null } | null) => {
        if (!active || !body) return;
        setCode(body.code ?? null);
        setSlug(body.slug ?? null);
        setSignupsLifetime(body.signupsLifetime ?? 0);
        setSignupsLast30(body.signupsLast30 ?? 0);
        setConversions(body.conversions ?? 0);
        setPromo(body.promo ?? null);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint]);

  // Prefer the name-based vanity link (aestheticsuccessnetwork.com/drjane);
  // fall back to the ?ref=CODE form if a handle hasn't been allocated.
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.aestheticsuccessnetwork.com";
  const joinUrl = slug
    ? `${origin}/${slug}`
    : code
      ? `${origin}/join?ref=${code}`
      : "";

  const copy = async (kind: "code" | "link" | "promo", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setJustCopied(kind);
      setTimeout(() => setJustCopied(null), 1800);
    } catch { /* no-op */ }
  };

  return (
    <Box
      sx={{
        borderRadius: "16px",
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
        boxShadow: SHADOW,
        p: 3,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 0.75 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            bgcolor: SAND,
            color: GOLD_DEEP,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <CardGiftcardOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em", color: INK, lineHeight: 1.3 }}>Refer and earn</Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>$50 per referred member, paid after their first payment</Typography>
        </Box>
      </Stack>

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 2 }}>
          <CircularProgress size={18} sx={{ color: NAVY }} />
        </Stack>
      ) : code ? (
        <>
          <Typography sx={{ fontSize: "0.875rem", color: BODY, lineHeight: 1.6, mt: 1.5, mb: 2 }}>
            Share this link with aesthetic practice owners. Anyone who joins through it is attributed to you.
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { sm: "center" }, mb: 2 }}
          >
            <Box
              sx={{
                flex: 1,
                px: 1.75,
                py: 1.25,
                borderRadius: "10px",
                border: `1px solid ${LINE}`,
                bgcolor: SAND_SOFT,
                fontFamily: MONO,
                fontSize: "0.8125rem",
                color: INK,
                wordBreak: "break-all",
              }}
            >
              {joinUrl}
            </Box>
            <Tooltip title={justCopied === "link" ? "Copied" : "Copy link"}>
              <Button
                onClick={() => copy("link", joinUrl)}
                variant="contained"
                disableElevation
                startIcon={justCopied === "link" ? <CheckRoundedIcon sx={{ fontSize: 15 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 15 }} />}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: "10px",
                  minHeight: 40,
                  px: 2,
                  bgcolor: NAVY,
                  color: "#FFFFFF",
                  backgroundImage: "none",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 2px rgba(10,19,32,0.12)",
                  flexShrink: 0,
                  "&:hover": { bgcolor: "#141F30", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 16px -8px rgba(10,19,32,0.45)" },
                }}
              >
                {justCopied === "link" ? "Copied" : "Copy link"}
              </Button>
            </Tooltip>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>Code</Typography>
              <Box
                component="button"
                type="button"
                onClick={() => copy("code", code)}
                sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: "8px",
                  border: `1px solid ${LINE_STRONG}`,
                  bgcolor: "#FFFFFF",
                  color: INK,
                  fontFamily: MONO,
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  "&:hover": { bgcolor: SAND_SOFT },
                }}
              >
                {justCopied === "code" ? "Copied" : code}
              </Box>
            </Stack>
            <Stack direction="row" spacing={3} sx={{ alignItems: "center", ml: { sm: "auto" } }}>
              <MiniStat label="Last 30 days" value={signupsLast30} />
              <MiniStat label="Lifetime" value={signupsLifetime} />
              <MiniStat label="Paid" value={conversions} />
            </Stack>
          </Stack>

          {/* Promotional code: team-activated months-free code. Shown
              read-only: the owner shares it, the ASN team switches it on. */}
          {promo && (
            <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${LINE}` }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flex: 1, minWidth: 0 }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => copy("promo", promo.code)}
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: "8px",
                      border: `1px solid ${LINE}`,
                      bgcolor: promo.active ? "#DCFCE7" : "#F1EFEA",
                      color: promo.active ? "#166534" : MUTED,
                      fontFamily: MONO,
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {justCopied === "promo" ? "Copied" : promo.code}
                  </Box>
                  <Typography sx={{ fontSize: "0.8125rem", color: BODY, lineHeight: 1.45 }}>
                    {promo.active
                      ? `Promo code is live: new members who enter it get ${Math.round(promo.trialDays / 30)} months free.`
                      : "Your promo code is not currently running. The ASN team activates it for campaigns."}
                  </Typography>
                </Stack>
                <MiniStat label="Joined with it" value={promo.uses} />
              </Stack>
            </Box>
          )}
        </>
      ) : (
        <Typography sx={{ fontSize: "0.875rem", color: MUTED, mt: 1.5 }}>
          Couldn&apos;t load your referral code. Refresh to try again.
        </Typography>
      )}
    </Box>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ textAlign: "right" }}>
      <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>{label}</Typography>
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em", color: INK, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
    </Box>
  );
}
