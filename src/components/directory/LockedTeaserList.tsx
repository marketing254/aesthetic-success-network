"use client";

import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import { COLORS } from "@/theme";

/**
 * Members-only teaser card for the PUBLIC site (expert/partner profiles).
 * The card body is a stack of blurred DECOY rows with a centered lock +
 * "Unlock" CTA on top.
 *
 * IMPORTANT: never pass real titles/bodies/promo codes into this
 * component. CSS blur is cosmetic — anyone can read the DOM — so the
 * server pages only send { kind, date } and the blurred rows underneath
 * are painted with generic filler. There is nothing real to un-blur or
 * bypass; the actual content never leaves the member portal.
 */

export type LockedTeaserRow = {
  id: string;
  /** e.g. "Event", "News", "Offer" — used only for the count line. */
  kind: string;
  /** Optional date label, e.g. "Sep 12" — used only for the count line. */
  dateLabel?: string | null;
};

// Decoy lines of varying length so the blurred rows look organic.
const DECOY: [string, string][] = [
  ["Members get early access to this one", "Full details, dates and the link are in the member portal"],
  ["An exclusive for ASN members", "Including the promo code you need to claim it"],
  ["A members-only announcement", "Everything you need is waiting inside the portal"],
  ["Fresh from this profile", "Members see the full story, dates and links"],
];

function summarize(rows: LockedTeaserRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  const parts = Array.from(counts.entries()).map(
    ([kind, n]) => `${n} ${kind.toLowerCase()}${n === 1 ? "" : "s"}`,
  );
  const dates = rows.map((r) => r.dateLabel).filter(Boolean) as string[];
  const dateHint = dates.length > 0 ? ` · next: ${dates[0]}` : "";
  return parts.join(" · ") + dateHint;
}

export default function LockedTeaserList({
  label,
  rows,
  footnote,
  ctaLabel = "Unlock with membership",
  ctaHref = "/pricing",
}: {
  label: string;
  rows: LockedTeaserRow[];
  footnote: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, 4);
  const isOffers = rows.every((r) => r.kind.toLowerCase() === "offer");
  const RowIcon = isOffers ? LocalOfferOutlinedIcon : CampaignRoundedIcon;

  return (
    <Box sx={{ borderRadius: 2.5, border: `1px solid ${COLORS.line}`, bgcolor: "#FFFFFF", overflow: "hidden", mb: 4 }}>
      {/* Header — visible teaser facts only (counts + next date). */}
      <Box sx={{ px: { xs: 2.5, md: 3 }, pt: { xs: 2.5, md: 3 }, pb: 1.5 }}>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: COLORS.muted, mb: 0.5 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: "0.85rem", color: COLORS.inkSoft, fontWeight: 600 }}>
          {summarize(rows)}
        </Typography>
      </Box>

      {/* Locked body — blurred decoys + centered lock/CTA overlay. */}
      <Box sx={{ position: "relative", px: { xs: 2.5, md: 3 }, pb: { xs: 2.5, md: 3 } }}>
        <Stack spacing={1.25} aria-hidden sx={{ filter: "blur(7px)", userSelect: "none", pointerEvents: "none" }}>
          {shown.map((r, i) => {
            const [line1, line2] = DECOY[i % DECOY.length]!;
            return (
              <Stack
                key={r.id}
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "flex-start", border: `1px solid ${COLORS.line}`, borderRadius: 2, p: 1.75, bgcolor: "#FDFCF9" }}
              >
                <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: "rgba(217,168,75,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <RowIcon sx={{ fontSize: 17, color: COLORS.accent }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: COLORS.ink, lineHeight: 1.3 }}>{line1}</Typography>
                  <Typography sx={{ fontSize: "0.84rem", color: COLORS.inkSoft, lineHeight: 1.45, mt: 0.25 }}>{line2}</Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>

        {/* Centered lock + CTA */}
        <Stack
          spacing={1.25}
          sx={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            background: "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.72) 100%)",
            px: 2,
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              bgcolor: "#FFFFFF",
              border: `1px solid ${COLORS.line}`,
              boxShadow: "0 10px 24px -12px rgba(14,42,61,0.35)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <LockRoundedIcon sx={{ fontSize: 24, color: COLORS.accent }} />
          </Box>
          <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: COLORS.ink }}>
            Members only
          </Typography>
          <Button
            {...(ctaHref.startsWith("http")
              ? { component: "a" as const, href: ctaHref, target: "_blank", rel: "noopener noreferrer" }
              : { component: Link, href: ctaHref })}
            variant="contained"
            startIcon={<LockRoundedIcon sx={{ fontSize: 15 }} />}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 999,
              px: 2.5,
              bgcolor: COLORS.accent,
              color: "#FFFFFF",
              boxShadow: "0 12px 26px -12px rgba(160,120,35,0.6)",
              "&:hover": { bgcolor: COLORS.accent, filter: "brightness(1.05)" },
            }}
          >
            {ctaLabel}
          </Button>
          <Typography sx={{ fontSize: "0.75rem", color: COLORS.muted, maxWidth: 320 }}>{footnote}</Typography>
        </Stack>
      </Box>
    </Box>
  );
}
