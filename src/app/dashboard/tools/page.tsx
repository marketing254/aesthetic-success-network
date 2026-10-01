"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import SentimentSatisfiedAltOutlinedIcon from "@mui/icons-material/SentimentSatisfiedAltOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import { MEMBER_TOOLS, TOOL_CATEGORIES, type MemberTool } from "@/lib/toolsData";

/* A restrained, professional palette — neutral surfaces, one gold accent. */
const INK = "#1A2230";
const INK_SOFT = "#4A5566";
const INK_MUTED = "#8A929E";
const GOLD = "#A07823";
const LINE = "#E7E3DA";
const HAIR = "#EFEBE2";
const BG = "#FBFAF7";

// Icon per tool category. Keys follow the ASN category names in
// src/lib/toolsData.ts (TOOL_CATEGORIES); unknown categories fall back to
// the calculator icon.
const CAT_ICON: Record<string, SvgIconComponent> = {
  "Pricing & Margins": PaidOutlinedIcon,
  "Practice Management": QueryStatsOutlinedIcon,
  "Practice Transitions": SwapHorizOutlinedIcon,
  "Consult & Conversion": HandshakeOutlinedIcon,
  "Marketing & Growth": CampaignOutlinedIcon,
  "Marketing & SEO": CampaignOutlinedIcon,
  "Patient Experience": SentimentSatisfiedAltOutlinedIcon,
  "Team & Culture": GroupsOutlinedIcon,
  "Operations & Compliance": VerifiedUserOutlinedIcon,
  "Front Desk": SupportAgentOutlinedIcon,
};
const catColor = (n: string) => TOOL_CATEGORIES.find((c) => c.name === n)?.color ?? INK_SOFT;
const catIcon = (n: string) => CAT_ICON[n] ?? CalculateOutlinedIcon;

/**
 * /dashboard/tools — the member Tools section.
 *
 * Two-pane layout: a category rail (left) + a description-led list of tool
 * cards (right). Neutral, professional styling — one gold accent, subtle
 * borders, generous whitespace. Everything runs in the browser.
 */
export default function MemberToolsPage() {
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState("all");

  const bySearch = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return MEMBER_TOOLS;
    return MEMBER_TOOLS.filter(
      (t) =>
        t.title.toLowerCase().includes(lc) ||
        t.blurb.toLowerCase().includes(lc) ||
        t.category.toLowerCase().includes(lc) ||
        (t.expert ?? "").toLowerCase().includes(lc),
    );
  }, [q]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of bySearch) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return m;
  }, [bySearch]);

  const shown = useMemo(() => {
    const list = activeCat === "all" ? bySearch : bySearch.filter((t) => t.category === activeCat);
    const order = TOOL_CATEGORIES.map((c) => c.name);
    return [...list].sort(
      (a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.title.localeCompare(b.title),
    );
  }, [bySearch, activeCat]);

  const cats = TOOL_CATEGORIES.filter((c) => (counts.get(c.name) ?? 0) > 0);

  return (
    <Box sx={{ maxWidth: 1160, mx: "auto", py: { xs: 3, md: 4.5 }, px: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { md: "flex-end" }, mb: 3.5 }}
      >
        <Box>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.2em", color: INK_MUTED, textTransform: "uppercase", mb: 0.75 }}>
            Member tools
          </Typography>
          <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.8rem", md: "2.15rem" }, fontWeight: 500, color: INK, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Calculators &amp; tools
          </Typography>
          <Typography sx={{ color: INK_SOFT, fontSize: "0.95rem", mt: 0.75, maxWidth: 520, lineHeight: 1.5 }}>
            {MEMBER_TOOLS.length === 0
              ? "Calculators for running the numbers are on the way. Everything will run in your browser; nothing you enter is saved or sent."
              : `${MEMBER_TOOLS.length} calculator${MEMBER_TOOLS.length === 1 ? "" : "s"} for running the numbers. Everything runs in your browser; nothing you enter is saved or sent.`}
          </Typography>
        </Box>
        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tools"
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
          sx={{ width: { xs: "100%", md: 260 }, "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.9rem", bgcolor: "#FFFFFF", "& fieldset": { borderColor: LINE } } }}
        />
      </Stack>

      {/* Two-pane: category rail + tool list */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "212px 1fr" }, gap: { xs: 2, md: 4 }, alignItems: "start" }}>
        {/* Rail — vertical list on md+, horizontal scroll on mobile */}
        <Box
          component="nav"
          sx={{
            position: { md: "sticky" },
            top: { md: 16 },
            display: "flex",
            flexDirection: { xs: "row", md: "column" },
            gap: { xs: 1, md: 0.25 },
            overflowX: { xs: "auto", md: "visible" },
            pb: { xs: 0.5, md: 0 },
          }}
        >
          <RailItem label="All tools" count={bySearch.length} active={activeCat === "all"} onClick={() => setActiveCat("all")} />
          {cats.map((c) => (
            <RailItem
              key={c.name}
              label={c.name}
              color={c.color}
              count={counts.get(c.name) ?? 0}
              active={activeCat === c.name}
              onClick={() => setActiveCat(c.name)}
            />
          ))}
        </Box>

        {/* List */}
        {shown.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, border: `1px solid ${LINE}`, borderRadius: 2.5, bgcolor: "#FFFFFF" }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, mb: 0.5 }}>No tools match that</Typography>
            <Typography sx={{ fontSize: "0.86rem", color: INK_MUTED }}>Try a different keyword or category.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.75 }}>
            {shown.map((t) => (
              <ToolCard key={t.id} tool={t} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function RailItem({ label, count, active, color, onClick }: { label: string; count: number; active: boolean; color?: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        flexShrink: 0,
        appearance: "none",
        cursor: "pointer",
        textAlign: "left",
        border: 0,
        borderRadius: 1.5,
        bgcolor: active ? "rgba(160,120,35,0.10)" : "transparent",
        px: 1.25,
        py: 0.85,
        display: "flex",
        alignItems: "center",
        gap: 1,
        width: { md: "100%" },
        whiteSpace: "nowrap",
        transition: "background-color 150ms ease",
        "&:hover": { bgcolor: active ? "rgba(160,120,35,0.12)" : HAIR },
        "&:focus-visible": { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
      }}
    >
      {color ? (
        <Box sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: color, flexShrink: 0 }} />
      ) : (
        <Box sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: active ? GOLD : INK_MUTED, flexShrink: 0 }} />
      )}
      <Typography sx={{ flex: 1, fontSize: "0.83rem", fontWeight: active ? 700 : 600, color: active ? INK : INK_SOFT }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: active ? GOLD : INK_MUTED, fontVariantNumeric: "tabular-nums" }}>
        {count}
      </Typography>
    </Box>
  );
}

function ToolCard({ tool }: { tool: MemberTool }) {
  const color = catColor(tool.category);
  const Icon = catIcon(tool.category);
  return (
    <Box
      component={Link}
      href={`/dashboard/tools/${tool.id}`}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minHeight: 158,
        textDecoration: "none",
        color: "inherit",
        borderRadius: 2.5,
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
        p: 2.25,
        transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
        "&:hover": {
          borderColor: "#D8CFBE",
          boxShadow: "0 10px 30px -18px rgba(26,34,48,0.35)",
          transform: "translateY(-1px)",
        },
        "&:hover .arrow": { opacity: 1, transform: "translate(0,0)" },
        "&:focus-visible": { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
      }}
    >
      <NorthEastRoundedIcon
        className="arrow"
        sx={{ position: "absolute", top: 18, right: 18, fontSize: 17, color: INK_MUTED, opacity: 0, transform: "translate(-2px,2px)", transition: "opacity 160ms ease, transform 160ms ease" }}
      />

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.25 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: BG, border: `1px solid ${HAIR}`, color: INK_SOFT, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon sx={{ fontSize: 21 }} />
        </Box>
        <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600, color: INK, lineHeight: 1.2, pr: 2 }}>
          {tool.title}
        </Typography>
      </Stack>

      <Typography sx={{ fontSize: "0.85rem", color: INK_SOFT, lineHeight: 1.5, mb: 1.5 }}>
        {tool.blurb}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: "auto", pt: 1.25, borderTop: `1px solid ${HAIR}`, flexWrap: "wrap", rowGap: 0.5 }}>
        <Box sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: INK_MUTED }}>
          {tool.category}
        </Typography>
        {tool.expert && (
          <>
            <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: INK_MUTED, opacity: 0.6 }} />
            <Typography sx={{ fontSize: "0.72rem", color: INK_MUTED }}>
              Built with <Box component="span" sx={{ color: GOLD, fontWeight: 600 }}>{tool.expert}</Box>
            </Typography>
          </>
        )}
        {tool.audience === "team" && (
          <Box component="span" sx={{ ml: "auto", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: INK_MUTED, border: `1px solid ${LINE}`, borderRadius: 999, px: 0.75, py: 0.1 }}>
            Team
          </Box>
        )}
      </Stack>
    </Box>
  );
}
