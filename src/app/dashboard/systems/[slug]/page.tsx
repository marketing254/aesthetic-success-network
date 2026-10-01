"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { SOPS } from "@/lib/sops";
import PdfPagesViewer from "@/components/member/PdfPagesViewer";

const INK = "#0A1A2F";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

/**
 * /dashboard/systems/[slug] — a focused, full-height SOP reader.
 *
 * Standard document-reader layout: one compact toolbar row (back link,
 * title + attribution, download) and the document below it, rendered by
 * our in-house pdf.js viewer as white page-sheets on the portal's cream
 * ground — no browser PDF chrome, no black frame.
 */
export default function SopDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const sop = SOPS.find((s) => s.slug === slug);
  if (!sop) notFound();

  return (
    <Box
      sx={{
        maxWidth: 1240,
        mx: "auto",
        px: { xs: 1.5, md: 3 },
        py: { xs: 2, md: 2.5 },
        display: "flex",
        flexDirection: "column",
        // Fill the viewport under the portal's top bar so the reader —
        // not the chrome — owns the page.
        minHeight: "calc(100vh - 96px)",
      }}
    >
      {/* Compact toolbar — everything about the SOP in one row */}
      <Stack
        direction="row"
        spacing={2}
        sx={{
          alignItems: "center",
          pb: 1.75,
          mb: 1.75,
          borderBottom: `1px solid ${LINE}`,
          flexWrap: { xs: "wrap", md: "nowrap" },
          rowGap: 1,
        }}
      >
        <Box
          component={Link}
          href="/dashboard/systems"
          aria-label="Back to all systems"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.6,
            fontSize: "0.8rem",
            fontWeight: 700,
            color: INK_MUTED,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
            "&:hover": { color: GOLD },
          }}
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 17 }} /> Systems
        </Box>

        <Box sx={{ width: "1px", height: 26, bgcolor: LINE, flexShrink: 0, display: { xs: "none", sm: "block" } }} />

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h1"
            noWrap
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.05rem", md: "1.25rem" },
              fontWeight: 600,
              color: INK,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            {sop.title}
          </Typography>
          <Typography noWrap sx={{ fontSize: "0.74rem", color: INK_MUTED }}>
            <Box component="span" sx={{ color: GOLD, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.66rem" }}>
              {sop.category} · SOP
            </Box>
            {"  ·  "}by{" "}
            <Box
              component={Link}
              href={`/dashboard/experts/${sop.expert.id}`}
              sx={{ color: INK, fontWeight: 700, textDecoration: "none", "&:hover": { color: GOLD } }}
            >
              {sop.expert.name}
            </Box>
            {", approved by them"}
          </Typography>
        </Box>

        <Button
          component="a"
          href={sop.pdfUrl}
          target="_blank"
          rel="noopener"
          startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 17 }} />}
          sx={{
            "&&": {
              bgcolor: INK,
              color: "#F6F1E7",
              fontWeight: 700,
              fontSize: "0.78rem",
              textTransform: "none",
              px: 2.25,
              py: 0.9,
              borderRadius: 999,
              whiteSpace: "nowrap",
              flexShrink: 0,
            },
            "&&:hover": { bgcolor: "#12325A" },
          }}
        >
          Download
        </Button>
      </Stack>

      {/* In-house reader: each PDF page rendered as a white sheet on the
          portal's cream ground, no browser PDF chrome, no black frame. */}
      <Box sx={{ flex: 1, pt: 0.5 }}>
        <PdfPagesViewer url={sop.pdfUrl} title={sop.title} />
      </Box>
    </Box>
  );
}
