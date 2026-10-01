"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Box, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { toolById, TOOL_CATEGORIES } from "@/lib/toolsData";

const INK = "#0A1A2F";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

/**
 * /dashboard/tools/[id] — runs one member tool inside the portal.
 *
 * The tool HTML is served by the member-gated /api/member/tools/[id]
 * route (the iframe carries the session cookies), so the full versions
 * never exist at a public URL. Option A from the Tools dev spec.
 */
export default function MemberToolPage() {
  const params = useParams<{ id: string }>();
  const tool = params?.id ? toolById(params.id) : undefined;

  if (!tool) {
    return (
      <Box sx={{ maxWidth: 900, mx: "auto", py: 6, px: 2, textAlign: "center" }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK, mb: 0.5 }}>
          We couldn&apos;t find that tool
        </Typography>
        <Typography sx={{ fontSize: "0.9rem", color: INK_MUTED }}>
          <Box component={Link} href="/dashboard/tools" sx={{ color: GOLD, fontWeight: 600 }}>
            Browse all tools
          </Box>
        </Typography>
      </Box>
    );
  }

  const catColor = TOOL_CATEGORIES.find((c) => c.name === tool.category)?.color ?? INK;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", py: { xs: 2.5, md: 3.5 }, px: { xs: 1.5, md: 0 } }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Box
            component={Link}
            href="/dashboard/tools"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              textDecoration: "none",
              color: INK_MUTED,
              fontSize: "0.85rem",
              fontWeight: 600,
              "&:hover": { color: GOLD },
            }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> All tools
          </Box>
          <Typography sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.4rem", md: "1.7rem" }, fontWeight: 500, color: INK, lineHeight: 1.15, mt: 0.5 }}>
            {tool.title}
          </Typography>
          <Typography sx={{ fontSize: "0.76rem", color: catColor, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", mt: 0.25 }}>
            {tool.category}
            {tool.expert ? ` · Built with ${tool.expert}` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", color: INK_MUTED }}>
          <LockRoundedIcon sx={{ fontSize: 13 }} />
          <Typography sx={{ fontSize: "0.74rem" }}>
            Runs in your browser. Nothing you type is saved or sent.
          </Typography>
        </Stack>
      </Stack>

      <Box
        component="iframe"
        src={`/api/member/tools/${tool.id}`}
        title={tool.title}
        sx={{
          width: "100%",
          // Generous height per the dev spec; tools scroll internally past this.
          height: { xs: "calc(100vh - 150px)", md: "calc(100vh - 170px)" },
          minHeight: 760,
          border: `1px solid ${LINE}`,
          borderRadius: 2,
          bgcolor: "#FFFFFF",
          display: "block",
        }}
      />
    </Box>
  );
}
