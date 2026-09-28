"use client";

import Link from "next/link";
import { Box, Stack, Typography } from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { TOOL_CATEGORIES, isPublicTool, toolPreviewSrc, type MemberTool } from "@/lib/toolsData";
import { COLORS } from "@/theme";

const GOLD_DEEP = "#A07823";
const SIGNUP_HREF = "/join/member";

/** Public directory card — opens the tool's preview page. */
export default function ToolCard({ tool }: { tool: MemberTool }) {
  const color = TOOL_CATEGORIES.find((c) => c.name === tool.category)?.color ?? COLORS.ink;
  const preview = toolPreviewSrc(tool.id);
  return (
    <Box
      component={Link}
      // A locked tool goes straight to member signup; the preview page
      // stays reachable by URL (and in the sitemap) for search traffic.
      href={isPublicTool(tool.id) ? `/tools/${tool.id}` : SIGNUP_HREF}
      sx={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        borderRadius: 3.5,
        border: `1px solid ${COLORS.line}`,
        bgcolor: "#fff",
        overflow: "hidden",
        transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "&:hover": { transform: "translateY(-3px)", borderColor: COLORS.accent, boxShadow: "0 18px 36px -18px rgba(10,19,32,0.28)" },
      }}
    >
      <Box sx={{ position: "relative", aspectRatio: "16 / 10", bgcolor: COLORS.surfaceAlt, borderBottom: `1px solid ${COLORS.line}`, overflow: "hidden" }}>
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
          />
        ) : (
          /* No screenshot previews ship with ASN: a CSS placeholder card in
             the category colour carries the title instead (never a broken <img>). */
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              px: 3,
              textAlign: "center",
              background: `linear-gradient(135deg, ${color} 0%, ${COLORS.ink} 100%)`,
            }}
          >
            <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 500, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.01em", opacity: 0.92 }}>
              {tool.title}
            </Typography>
          </Box>
        )}
        <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,19,32,0) 45%, rgba(10,19,32,0.55) 100%)" }} />
        <Box sx={{ position: "absolute", left: 10, top: 10, bgcolor: "rgba(255,255,255,0.94)", color, fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", px: 1, py: 0.5, borderRadius: 1 }}>
          {tool.category}
        </Box>
        {isPublicTool(tool.id) ? (
          <Stack direction="row" spacing={0.6} sx={{ position: "absolute", right: 10, bottom: 10, alignItems: "center", bgcolor: "#1B6B4A", color: "#fff", px: 1, py: 0.55, borderRadius: 1 }}>
            <PlayArrowRoundedIcon sx={{ fontSize: 13 }} />
            <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "inherit" }}>Free to try</Typography>
          </Stack>
        ) : (
          <Stack direction="row" spacing={0.6} sx={{ position: "absolute", right: 10, bottom: 10, alignItems: "center", bgcolor: "rgba(255,255,255,0.94)", color: GOLD_DEEP, px: 1, py: 0.55, borderRadius: 1 }}>
            <LockRoundedIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "inherit" }}>Members only</Typography>
          </Stack>
        )}
      </Box>
      <Box sx={{ p: 2.25, display: "grid", gap: 0.6 }}>
        <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.12rem", fontWeight: 600, color: COLORS.ink, lineHeight: 1.25 }}>
          {tool.title}
        </Typography>
        <Typography sx={{ fontSize: "0.86rem", color: COLORS.muted, lineHeight: 1.5 }}>{tool.blurb}</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: COLORS.muted, mt: 0.5 }}>
          {tool.expert ? (
            <>Built with <Box component="span" sx={{ color: GOLD_DEEP, fontWeight: 700 }}>{tool.expert}</Box></>
          ) : (
            <>Built by <Box component="span" sx={{ color: GOLD_DEEP, fontWeight: 700 }}>ASN</Box></>
          )}
        </Typography>
      </Box>
    </Box>
  );
}
