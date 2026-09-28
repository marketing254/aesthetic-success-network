"use client";

import Link from "next/link";
import { Box, Stack, Typography } from "@mui/material";
import type { BlogBlock } from "@/lib/blog";

/**
 * Shared article-body renderer for ASN blog content. Used by BOTH the
 * public /blog/[slug] template and the member-portal /dashboard/blog
 * pages, so the two surfaces can never drift apart in how they render
 * the approved copy.
 */

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const GOLD = "#A07823";
const GOLD_BRIGHT = "#D9A84B";
const LINE = "#E6DDCF";

/**
 * Tiny inline-markdown renderer: **bold**, *italic* and [text](href)
 * links. Links are the approved internal-link placements from the SEO
 * briefs (e.g. related-reading sentences); internal hrefs use next/link.
 */
export function inline(text: string): React.ReactNode {
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const href = m[2]!;
      const linkSx = { color: GOLD, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px" } as const;
      nodes.push(
        href.startsWith("/") ? (
          <Box key={k++} component={Link} href={href} sx={linkSx}>{m[1]}</Box>
        ) : (
          <Box key={k++} component="a" href={href} target="_blank" rel="noopener noreferrer" sx={linkSx}>{m[1]}</Box>
        ),
      );
    } else if (m[3] !== undefined) nodes.push(<strong key={k++}>{inline(m[3])}</strong>);
    else nodes.push(<em key={k++}>{inline(m[4])}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length === 1 ? nodes[0] : nodes;
}

export const bodyText = {
  fontSize: "1.02rem",
  lineHeight: 1.75,
  color: INK_SOFT,
} as const;

export function Block({ block }: { block: BlogBlock }) {
  switch (block.kind) {
    case "p":
      return (
        <Typography
          sx={{
            ...bodyText,
            mb: 2.25,
            ...(block.lead ? { fontSize: "1.14rem", color: INK, lineHeight: 1.7 } : null),
          }}
        >
          {inline(block.text)}
        </Typography>
      );
    case "h2":
      return (
        <Typography
          component="h2"
          id={block.id}
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "1.45rem", md: "1.7rem" },
            fontWeight: 600,
            color: INK,
            lineHeight: 1.22,
            letterSpacing: "-0.015em",
            mt: 5,
            mb: 2,
            scrollMarginTop: "110px",
          }}
        >
          {block.text}
        </Typography>
      );
    case "h3":
      return (
        <Typography
          component="h3"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: "1.15rem",
            fontWeight: 600,
            color: INK,
            mt: 3.25,
            mb: 1.25,
          }}
        >
          {block.text}
        </Typography>
      );
    case "ul":
      return (
        <Box component="ul" sx={{ pl: 0, my: 2.5, listStyle: "none" }}>
          {block.items.map((item, i) => (
            <Box
              component="li"
              key={i}
              sx={{
                ...bodyText,
                display: "flex",
                gap: 1.5,
                mb: 1.25,
                "&::before": {
                  content: '""',
                  flexShrink: 0,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: GOLD_BRIGHT,
                  mt: "0.6em",
                },
              }}
            >
              <span>{inline(item)}</span>
            </Box>
          ))}
        </Box>
      );
    case "ol":
      return (
        <Box component="ol" sx={{ pl: 0, my: 2.5, listStyle: "none", counterReset: "blog-ol" }}>
          {block.items.map((item, i) => (
            <Box
              component="li"
              key={i}
              sx={{
                ...bodyText,
                display: "flex",
                gap: 1.5,
                mb: 1.25,
                counterIncrement: "blog-ol",
                "&::before": {
                  content: "counter(blog-ol)",
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  bgcolor: "rgba(217,168,75,0.14)",
                  color: GOLD,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  display: "grid",
                  placeItems: "center",
                  mt: "0.2em",
                },
              }}
            >
              <span>
                {item.strong ? <strong>{item.strong} </strong> : null}
                {inline(item.text)}
              </span>
            </Box>
          ))}
        </Box>
      );
    case "quote":
      return (
        <Box
          component="blockquote"
          sx={{
            m: 0,
            my: 3.5,
            pl: 3,
            py: 0.5,
            borderLeft: `3px solid ${GOLD_BRIGHT}`,
          }}
        >
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.15rem", md: "1.3rem" },
              fontStyle: "italic",
              color: INK,
              lineHeight: 1.5,
              mb: 1,
            }}
          >
            {block.text}
          </Typography>
          {block.cite && (
            <Typography
              component="cite"
              sx={{
                fontStyle: "normal",
                fontSize: "0.78rem",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: GOLD,
              }}
            >
              {block.cite}
            </Typography>
          )}
        </Box>
      );
    case "formula":
      return (
        <Box
          sx={{
            my: 3,
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            bgcolor: "#FFFFFF",
            border: `1px solid ${LINE}`,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            columnGap: 1.5,
            rowGap: 0.75,
            textAlign: "center",
          }}
        >
          {block.parts.map((part, i) =>
            /^[÷×=]/.test(part) ? (
              <Typography
                key={i}
                component="strong"
                sx={{ color: GOLD, fontWeight: 800, fontSize: "1rem", whiteSpace: "nowrap" }}
              >
                {part}
              </Typography>
            ) : (
              <Typography key={i} sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>
                {part}
              </Typography>
            ),
          )}
        </Box>
      );
  }
}

export function TocLinks({
  toc,
  onNavigate,
}: {
  toc: { id: string; label: string }[];
  onNavigate?: () => void;
}) {
  return (
    <Stack component="nav" aria-label="Table of contents" spacing={0}>
      {toc.map((item) => (
        <Box
          key={item.id}
          component="a"
          href={`#${item.id}`}
          onClick={onNavigate}
          sx={{
            display: "block",
            py: 1,
            px: 1.5,
            fontSize: "0.86rem",
            fontWeight: 600,
            color: INK_SOFT,
            textDecoration: "none",
            borderLeft: `2px solid ${LINE}`,
            transition: "color 180ms ease, border-color 180ms ease, background-color 180ms ease",
            "&:hover": { color: INK, borderLeftColor: GOLD_BRIGHT, bgcolor: "rgba(217,168,75,0.07)" },
          }}
        >
          {item.label}
        </Box>
      ))}
    </Stack>
  );
}
