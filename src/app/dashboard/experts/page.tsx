"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { isSupabaseImage } from "@/lib/images";
import {
  Box,
  Pagination,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

type Expert = {
  id: string;
  name: string;
  specialty: string | null;
  headshot_url: string | null;
  bio: string | null;
  kit_count: number;
};

/**
 * /dashboard/experts — Experts directory for members.
 *
 * Lists every active expert as a card with their photo, specialty, kit
 * count, and a "View kits" button that deep-links into the resource
 * library filtered by that expert.
 *
 * Members use this as the entry point when they want to find resources
 * by who taught them rather than by topic.
 */
export default function MemberExpertsPage() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/member/experts", { cache: "no-store" });
        if (!active || !res.ok) return;
        const body = (await res.json()) as { experts?: Expert[] };
        if (active) setExperts(body.experts ?? []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return experts;
    return experts.filter(
      (e) =>
        e.name.toLowerCase().includes(lc) ||
        (e.specialty ?? "").toLowerCase().includes(lc) ||
        (e.bio ?? "").toLowerCase().includes(lc),
    );
  }, [experts, q]);

  // Pagination — the bench will only grow; 12 per page keeps the grid tidy.
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [q]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

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
            Experts
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
            Find resources by expert
          </Typography>
          <Typography sx={{ color: INK_SOFT, fontSize: "0.98rem", maxWidth: 640, lineHeight: 1.55 }}>
            Every expert on the ASN bench. Tap one to see their full profile and kits.
          </Typography>
        </Box>

        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search experts by name, specialty, or topic"
          fullWidth
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: INK_MUTED }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 999,
              fontSize: "0.92rem",
              bgcolor: "#FFFFFF",
            },
          }}
        />

        {loading ? (
          <Stack sx={{ alignItems: "center", py: 6 }}>
            <CircularProgress size={22} sx={{ color: GOLD }} />
          </Stack>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, mb: 0.5 }}>
              No experts match that search
            </Typography>
            <Typography sx={{ fontSize: "0.86rem", color: INK_MUTED }}>
              Try a different keyword.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
              gridAutoRows: "1fr",
              gap: 2.5,
            }}
          >
            {paged.map((e) => (
              <ExpertCard key={e.id} expert={e} />
            ))}
          </Box>
        )}

        {pageCount > 1 && (
          <Stack sx={{ alignItems: "center", pt: 1 }}>
            <Pagination
              count={pageCount}
              page={page}
              onChange={(_, v) => {
                setPage(v);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              sx={{ "& .MuiPaginationItem-root.Mui-selected": { bgcolor: "#0A1A2F", color: "#fff" } }}
            />
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

function ExpertCard({ expert }: { expert: Expert }) {
  return (
    <Box
      component={Link}
      href={`/dashboard/experts/${expert.id}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        height: "100%",
        borderRadius: 3,
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
        p: 2.5,
        pt: 3,
        textAlign: "center",
        transition: "transform 260ms cubic-bezier(0.16,1,0.3,1), border-color 260ms ease, box-shadow 260ms ease",
        "& .expert-ring": { transition: "box-shadow 260ms ease, transform 260ms ease" },
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: GOLD,
          boxShadow: "0 24px 48px -22px rgba(10,26,47,0.3)",
        },
        "&:hover .expert-ring": {
          boxShadow: "0 0 0 4px rgba(217,168,75,0.25)",
          transform: "scale(1.03)",
        },
        "&:focus-visible": { outline: `2px solid ${GOLD}`, outlineOffset: 3 },
      }}
    >
      {/* Circular portrait with a gold ring — classic team-page style */}
      <Box
        className="expert-ring"
        sx={{
          position: "relative",
          width: 104,
          height: 104,
          mx: "auto",
          borderRadius: "50%",
          overflow: "hidden",
          border: "3px solid rgba(217,168,75,0.55)",
          bgcolor: "#FBF8F1",
        }}
      >
        {expert.headshot_url ? (
          <Image
            src={expert.headshot_url}
            alt={expert.name}
            fill
            sizes="104px"
            unoptimized={!isSupabaseImage(expert.headshot_url)}
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #0A1A2F 0%, #12325A 100%)",
              color: GOLD,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.7rem",
            }}
          >
            {initials(expert.name)}
          </Box>
        )}
      </Box>

      <Typography
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: "1.2rem",
          fontWeight: 600,
          color: INK,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          mt: 1.75,
        }}
        noWrap
      >
        {expert.name}
      </Typography>

      {/* Specialty — short title, clamped; the full text lives on the profile */}
      <Typography
        sx={{
          fontSize: "0.68rem",
          color: GOLD,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1.45,
          mt: 0.5,
          minHeight: "calc(2 * 1.45 * 0.68rem)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {expert.specialty ?? ""}
      </Typography>

      {/* Gold rule */}
      <Box sx={{ width: 34, height: 2, bgcolor: GOLD, borderRadius: 2, mx: "auto", my: 1.25, opacity: 0.6 }} />

      {/* Fixed 3-line bio slot so every card matches */}
      <Typography
        sx={{
          fontSize: "0.85rem",
          color: INK_SOFT,
          lineHeight: 1.55,
          textAlign: "left",
          minHeight: "calc(3 * 1.55 * 0.85rem)",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {expert.bio ?? ""}
      </Typography>

      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          mt: "auto",
          pt: 1.5,
          borderTop: `1px solid ${LINE}`,
        }}
      >
        <Box
          sx={{
            px: 1.1,
            py: 0.3,
            borderRadius: 999,
            bgcolor: expert.kit_count > 0 ? "rgba(160,120,35,0.12)" : "rgba(122,133,144,0.1)",
            color: expert.kit_count > 0 ? GOLD : INK_MUTED,
            fontSize: "0.68rem",
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          {expert.kit_count === 0 ? "PROFILE" : `${expert.kit_count} KIT${expert.kit_count === 1 ? "" : "S"}`}
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: GOLD, fontSize: "0.76rem", fontWeight: 700 }}>
          View profile <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />
        </Stack>
      </Stack>
    </Box>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
