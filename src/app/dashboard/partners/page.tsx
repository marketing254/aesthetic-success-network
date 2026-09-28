"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Box,
  CircularProgress,
  InputAdornment,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

type Partner = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  offer_count: number;
};

/**
 * /dashboard/partners — Partner directory for members.
 *
 * Lists every live partner company as a card with its logo, category, and
 * member-offer count. Tapping one opens the partner's profile with their
 * full details and offers.
 */
export default function MemberPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/member/partners", { cache: "no-store" });
        if (!active || !res.ok) return;
        const body = (await res.json()) as { partners?: Partner[] };
        if (active) setPartners(body.partners ?? []);
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
    if (!lc) return partners;
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(lc) ||
        (p.category ?? "").toLowerCase().includes(lc) ||
        (p.description ?? "").toLowerCase().includes(lc),
    );
  }, [partners, q]);

  // Pagination — 12 per page keeps the directory tidy as partners grow.
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
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", color: INK_MUTED, textTransform: "uppercase", mb: 1 }}>
            Partners
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
            Member partners &amp; offers
          </Typography>
          <Typography sx={{ color: INK_SOFT, fontSize: "0.98rem", maxWidth: 640, lineHeight: 1.55 }}>
            Vetted companies with exclusive discounts and benefits for ASN members. Tap one to
            see their offers.
          </Typography>
        </Box>

        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search partners by name, category, or what they do"
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
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 999, fontSize: "0.92rem", bgcolor: "#FFFFFF" } }}
        />

        {loading ? (
          <Stack sx={{ alignItems: "center", py: 6 }}>
            <CircularProgress size={22} sx={{ color: GOLD }} />
          </Stack>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, mb: 0.5 }}>
              {partners.length === 0 ? "No partners yet" : "No partners match that search"}
            </Typography>
            <Typography sx={{ fontSize: "0.86rem", color: INK_MUTED }}>
              {partners.length === 0 ? "Check back soon. Partners are being added." : "Try a different keyword."}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gridAutoRows: "1fr", gap: 2.5 }}>
            {paged.map((p) => (
              <PartnerCard key={p.id} partner={p} />
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

function PartnerCard({ partner }: { partner: Partner }) {
  return (
    <Box
      component={Link}
      href={`/dashboard/partners/${partner.id}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        height: "100%",
        borderRadius: 3,
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
        overflow: "hidden",
        transition: "transform 260ms cubic-bezier(0.16,1,0.3,1), border-color 260ms ease, box-shadow 260ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: GOLD,
          boxShadow: "0 24px 48px -20px rgba(10,26,47,0.3)",
        },
        "&:focus-visible": { outline: `2px solid ${GOLD}`, outlineOffset: 3 },
      }}
    >
      {/* Logo stage — cream band with the mark centered, storefront-style */}
      <Box
        sx={{
          position: "relative",
          height: 116,
          bgcolor: "#FBF8F1",
          borderBottom: `1px solid ${LINE}`,
          display: "grid",
          placeItems: "center",
        }}
      >
        {partner.logo_url ? (
          <Box sx={{ position: "relative", width: "58%", height: "64%" }}>
            <Image
              src={partner.logo_url}
              alt={partner.name}
              fill
              sizes="220px"
              unoptimized
              style={{ objectFit: "contain" }}
            />
          </Box>
        ) : (
          <StorefrontOutlinedIcon sx={{ color: GOLD, fontSize: 40 }} />
        )}
        {partner.offer_count > 0 && (
          <Box
            sx={{
              position: "absolute",
              top: 10,
              right: 10,
              px: 1.1,
              py: 0.3,
              borderRadius: 999,
              bgcolor: "#0A1A2F",
              color: "#E9C77B",
              fontSize: "0.66rem",
              fontWeight: 800,
              letterSpacing: "0.05em",
            }}
          >
            {partner.offer_count} OFFER{partner.offer_count === 1 ? "" : "S"}
          </Box>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ display: "flex", flexDirection: "column", flex: 1, p: 2, pt: 1.75 }}>
        {partner.category && (
          <Typography
            sx={{
              fontSize: "0.66rem",
              color: GOLD,
              fontWeight: 800,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              mb: 0.4,
            }}
            noWrap
          >
            {partner.category}
          </Typography>
        )}
        <Typography
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: "1.2rem",
            fontWeight: 600,
            color: INK,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            mb: 0.75,
          }}
          noWrap
        >
          {partner.name}
        </Typography>
        <Typography
          sx={{
            fontSize: "0.85rem",
            color: INK_SOFT,
            lineHeight: 1.55,
            minHeight: "calc(3 * 1.55 * 0.85rem)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {partner.description ?? ""}
        </Typography>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", mt: "auto", pt: 1.5 }}
        >
          <Typography sx={{ fontSize: "0.74rem", color: INK_MUTED, fontWeight: 600 }}>
            {partner.offer_count === 0 ? "Profile" : `${partner.offer_count} member offer${partner.offer_count === 1 ? "" : "s"}`}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: GOLD, fontSize: "0.76rem", fontWeight: 700 }}>
            View partner <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
