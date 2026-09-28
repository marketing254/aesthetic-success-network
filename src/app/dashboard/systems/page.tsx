"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { isSupabaseImage } from "@/lib/images";
import { Box, Chip, Stack, Typography } from "@mui/material";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { SOPS, type Sop } from "@/lib/sops";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

/**
 * /dashboard/systems — the Systems tab: expert-approved SOPs and
 * templates members can print and run with their team immediately.
 *
 * Each card is the SOP's approved duotone portal card (title + hook are
 * part of the artwork, same treatment as kit cards); clicking it opens
 * the in-portal reader at /dashboard/systems/[slug]. The expert's name
 * links to their portal profile.
 */
export default function MemberSystemsPage() {
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(SOPS.map((s) => s.category))], []);
  const shown = category ? SOPS.filter((s) => s.category === category) : SOPS;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Stack spacing={3.5}>
        <Box>
          <Typography
            sx={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: INK_MUTED,
              textTransform: "uppercase",
              mb: 1,
            }}
          >
            Systems
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.9rem", md: "2.4rem" },
              fontWeight: 500,
              color: INK,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              mb: 1,
            }}
          >
            SOPs and templates you can run on Monday morning.
          </Typography>
          <Typography sx={{ color: INK_SOFT, fontSize: "0.98rem", maxWidth: 640, lineHeight: 1.55 }}>
            Written from each expert&apos;s own session and approved by them. Open one, print it,
            and put it in front of your team.
          </Typography>
        </Box>

        {categories.length > 1 && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            {[null, ...categories].map((cat) => {
              const active = category === cat;
              return (
                <Chip
                  key={cat ?? "all"}
                  label={cat ?? "All systems"}
                  clickable
                  onClick={() => setCategory(cat)}
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    borderRadius: 999,
                    bgcolor: active ? INK : "#FFFFFF",
                    color: active ? "#F6F1E7" : INK_SOFT,
                    border: `1px solid ${active ? INK : LINE}`,
                    "&:hover": { bgcolor: active ? INK : "rgba(217,168,75,0.1)" },
                  }}
                />
              );
            })}
          </Stack>
        )}

        {shown.length === 0 ? (
          <Box
            sx={{
              py: 8,
              textAlign: "center",
              borderTop: `1px solid ${LINE}`,
              borderBottom: `1px solid ${LINE}`,
            }}
          >
            <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: INK, mb: 0.5 }}>
              No systems published yet
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", color: INK_MUTED }}>
              Expert-approved SOPs and templates will appear here as soon as the ASN content team adds them.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: 2.5,
            }}
          >
            {shown.map((sop) => (
              <SopCard key={sop.slug} sop={sop} />
            ))}
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function SopCard({ sop }: { sop: Sop }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        overflow: "hidden",
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
        transition:
          "transform 260ms cubic-bezier(0.16,1,0.3,1), border-color 260ms ease, box-shadow 260ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: "#D9A84B",
          boxShadow: "0 24px 48px -22px rgba(10,26,47,0.3)",
        },
        "&:focus-within": { outline: `2px solid ${GOLD}`, outlineOffset: 3 },
      }}
    >
      {/* The approved duotone card IS the artwork — 3:4, same treatment
          as kit cards. Clicking it opens the in-portal reader. */}
      <Box
        component={Link}
        href={`/dashboard/systems/${sop.slug}`}
        aria-label={`Open SOP: ${sop.title} by ${sop.expert.name}`}
        sx={{ position: "relative", display: "block", aspectRatio: "3 / 4" }}
      >
        <Image
          src={sop.cardUrl}
          alt={`${sop.title}, SOP by ${sop.expert.name}`}
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 25vw"
          unoptimized={!isSupabaseImage(sop.cardUrl)}
          style={{ objectFit: "cover" }}
        />
      </Box>

      <Box sx={{ p: 1.75 }}>
        <Typography
          sx={{
            fontSize: "0.64rem",
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: GOLD,
            mb: 0.5,
          }}
        >
          {sop.category}
        </Typography>
        <Typography
          component={Link}
          href={`/dashboard/experts/${sop.expert.id}`}
          sx={{
            display: "inline-block",
            fontSize: "0.82rem",
            fontWeight: 700,
            color: INK,
            textDecoration: "none",
            borderBottom: "1px solid rgba(217,168,75,0.5)",
            "&:hover": { color: GOLD },
          }}
        >
          {sop.expert.name}
        </Typography>

        <Stack
          direction="row"
          sx={{
            mt: 1.25,
            pt: 1.25,
            borderTop: `1px solid ${LINE}`,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", color: INK_MUTED }}>
            <PictureAsPdfOutlinedIcon sx={{ fontSize: 15 }} />
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>PDF</Typography>
          </Stack>
          <Box
            component={Link}
            href={`/dashboard/systems/${sop.slug}`}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: "0.78rem",
              fontWeight: 700,
              color: GOLD,
              textDecoration: "none",
              "&:hover": { color: "#7A5B12" },
            }}
          >
            Open SOP <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
