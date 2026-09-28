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

/**
 * ReferralCard — drop-in block for expert/partner portal dashboards.
 *
 * Fetches the role's referral code from the provided endpoint, shows the
 * short code + a copyable referral URL, and a small "this month / lifetime"
 * stats row so they can see their impact at a glance.
 *
 * `accent` is kept for API compatibility; the card is neutral with navy
 * links and buttons.
 */

const NAVY = "#0E2A3D";
const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const MONO = "var(--font-mono, ui-monospace, Menlo, monospace)";

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
        borderRadius: "8px",
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
        p: 3,
      }}
    >
      <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, mb: 0.5 }}>Your referral link</Typography>

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 2 }}>
          <CircularProgress size={18} sx={{ color: NAVY }} />
        </Stack>
      ) : code ? (
        <>
          <Typography sx={{ fontSize: "0.875rem", color: BODY, lineHeight: 1.55, mb: 2 }}>
            Share this link with aesthetic practice owners. Anyone who joins through it gets attributed to you, and you earn $50 per referred member, paid after their first payment.
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { sm: "center" }, mb: 2 }}
          >
            <Box
              sx={{
                flex: 1,
                px: 1.5,
                py: 1,
                borderRadius: "6px",
                border: `1px solid ${LINE}`,
                bgcolor: "#F9FAFB",
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
                variant="outlined"
                size="small"
                startIcon={justCopied === "link" ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />}
                sx={{
                  textTransform: "none",
                  fontWeight: 500,
                  borderRadius: "6px",
                  minHeight: 36,
                  borderColor: "#D1D5DB",
                  color: INK,
                  bgcolor: "#FFFFFF",
                  flexShrink: 0,
                  "&:hover": { borderColor: "#D1D5DB", bgcolor: "#F9FAFB", transform: "none" },
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
                  borderRadius: "6px",
                  border: `1px solid ${LINE}`,
                  bgcolor: "#F9FAFB",
                  color: INK,
                  fontFamily: MONO,
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "#F3F4F6" },
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

          {/* Promotional code — team-activated 3-months-free code. Shown
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
                      borderRadius: "6px",
                      border: `1px solid ${LINE}`,
                      bgcolor: promo.active ? "#DCFCE7" : "#F3F4F6",
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
        <Typography sx={{ fontSize: "0.875rem", color: MUTED }}>
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
      <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: INK, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
    </Box>
  );
}
