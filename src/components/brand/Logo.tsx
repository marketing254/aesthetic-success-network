"use client";
import Link from "next/link";
import Image from "next/image";
import { Box } from "@mui/material";

type Props = {
  /** True when rendering on a dark background (used by the footer). */
  dark?: boolean;
  /** Display mode. Lockup = full wordmark. Sigil = compact stacked. */
  variant?: "lockup" | "sigil";
  /** Show the brand subline. Default true for lockup. */
  showSubline?: boolean;
  /** Total visual height in pixels. The logo scales to this. */
  height?: number;
  /** Wrap in next/link with this href. Omit for no link. */
  href?: string;
  /** Aria label on the link wrapper. */
  ariaLabel?: string;
};

/**
 * Brand mark used by the header, drawer, footer, logins and portal shells.
 *
 * Asset: /asn-nav-icon.png, the 128px navy rounded-tile monogram from the
 * ASN logo pack (see public/README.md). It is square (1:1) and reads
 * correctly on both light and dark surfaces; `dark` only switches the
 * text colour of the name. `variant="lockup"` (default) = icon + name
 * (+ subline unless showSubline is false); `variant="sigil"` = icon only.
 */
export default function Logo({
  dark = false,
  variant = "lockup",
  showSubline = true,
  height = 56,
  href,
  ariaLabel = "Aesthetic Success Network · home",
}: Props) {
  // Icon is square; the lockup adds the network name (and subline) beside
  // it so every surface matches the public site nav. "sigil" = icon only.
  const icon = Math.min(height, 64);
  const nameSize = Math.max(14, Math.min(22, Math.round(icon * 0.42)));
  const ink = dark ? "#F6F1E7" : "#0A1320";
  const sub = dark ? "rgba(246,241,231,0.7)" : "#8A6528";

  const content = (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: `${Math.round(icon * 0.27)}px`, minWidth: 0 }}>
      <Box sx={{ position: "relative", height: icon, width: icon, flex: "none" }}>
        <Image
          src="/asn-nav-icon.png"
          alt="Aesthetic Success Network"
          fill
          priority
          sizes={`${icon}px`}
          style={{ objectFit: "contain", objectPosition: "left center", borderRadius: Math.round(icon * 0.22) }}
        />
      </Box>
      {variant !== "sigil" && (
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.15 }}>
          <Box
            component="span"
            sx={{
              fontFamily: 'var(--font-display), "Fraunces", Georgia, serif',
              fontSize: nameSize,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: ink,
              whiteSpace: "nowrap",
            }}
          >
            Aesthetic Success Network
          </Box>
          {showSubline && (
            <Box
              component="span"
              sx={{
                fontSize: Math.max(8, Math.round(nameSize * 0.56)),
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: sub,
                mt: "3px",
                whiteSpace: "nowrap",
                display: { xs: "none", sm: "inline" },
              }}
            >
              Powered by Business of Aesthetics
            </Box>
          )}
        </Box>
      )}
    </Box>
  );

  if (href) {
    return (
      <Box
        component={Link}
        href={href}
        aria-label={ariaLabel}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          textDecoration: "none",
          "&:focus-visible": {
            outline: "2px solid currentColor",
            outlineOffset: 4,
            borderRadius: 4,
          },
        }}
      >
        {content}
      </Box>
    );
  }

  return content;
}

// Re-export variant constant so existing callers using "sigil" prop don't break.
export type { Props as LogoProps };
