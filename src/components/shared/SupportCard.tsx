"use client";

import { Box, Stack, Typography } from "@mui/material";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";

/**
 * SupportCard — compact help block shown on every portal (member, expert,
 * partner) so signed-in users always have a one-click way to reach the
 * team. Two channels:
 *
 *   - Hotline (clickable tel: link on mobile, plain number on desktop)
 *   - Email (mailto: link)
 *
 * Layout: single horizontal row on md+, stacked column on mobile. Plays
 * nicely inside both the sidebar drawer and standalone "Need help?"
 * placements on dashboard pages.
 *
 * `accent` / `accentTint` are kept for API compatibility; the card is
 * neutral (gray icons, navy links).
 */

const NAVY = "#0E2A3D";
const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

export type SupportCardProps = {
  /** Phone number to display + dial. Falsy = hide the hotline row. */
  phone?: string | null;
  /** Email to display + open via mailto (defaults to the ASN support inbox). */
  email?: string;
  /** Optional label above the rows (defaults to "Support"). */
  eyebrow?: string;
  /** Kept for API compatibility. */
  accent?: string;
  /** Kept for API compatibility. */
  accentTint?: string;
  /** Variant — `compact` collapses everything to a single icon row. */
  variant?: "default" | "compact";
};

export default function SupportCard({
  phone = "(855) 567-5323",
  email = "support@aestheticsuccessnetwork.com",
  eyebrow = "Support",
  accent: _accent,
  accentTint: _accentTint,
  variant = "default",
}: SupportCardProps) {
  void _accent;
  void _accentTint;
  const compact = variant === "compact";
  return (
    <Box
      sx={{
        borderRadius: "8px",
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
        p: compact ? 1.5 : 2,
      }}
    >
      {!compact && (
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK, mb: 1 }}>{eyebrow}</Typography>
      )}
      <Stack
        direction={compact ? "row" : { xs: "column", md: "row" }}
        spacing={compact ? 1 : 1.5}
        sx={{ alignItems: { md: "stretch" } }}
      >
        {phone && (
          <Box
            component="a"
            href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flex: 1,
              minWidth: 0,
              borderRadius: "6px",
              px: 1,
              py: 0.75,
              textDecoration: "none",
              color: INK,
              "&:hover": { bgcolor: "#F3F4F6" },
            }}
          >
            <PhoneRoundedIcon sx={{ fontSize: 16, color: MUTED, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>Hotline</Typography>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: INK, lineHeight: 1.2 }}>{phone}</Typography>
            </Box>
          </Box>
        )}
        <Box
          component="a"
          href={`mailto:${email}`}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flex: 1,
            minWidth: 0,
            borderRadius: "6px",
            px: 1,
            py: 0.75,
            textDecoration: "none",
            color: INK,
            "&:hover": { bgcolor: "#F3F4F6" },
          }}
        >
          <EmailOutlinedIcon sx={{ fontSize: 16, color: MUTED, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>Email</Typography>
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: NAVY,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {email}
            </Typography>
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}
