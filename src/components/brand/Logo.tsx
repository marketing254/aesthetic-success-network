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
 * correctly on both light and dark surfaces, so the `dark` prop no longer
 * applies a brightness/invert filter. The prop is kept so every existing
 * caller keeps compiling. `variant` and `showSubline` are accepted for
 * API compatibility and ignored, as in DMN.
 */
export default function Logo({
  dark = false,
  variant = "lockup",
  height = 56,
  href,
  ariaLabel = "Aesthetic Success Network · home",
}: Props) {
  void dark;
  void variant;
  const aspect = 1;
  const width = Math.round(height * aspect);

  const content = (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        position: "relative",
        height,
        width,
      }}
    >
      <Image
        src="/asn-nav-icon.png"
        alt="Aesthetic Success Network"
        fill
        priority
        sizes={`${width}px`}
        style={{
          objectFit: "contain",
          objectPosition: "left center",
        }}
      />
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
