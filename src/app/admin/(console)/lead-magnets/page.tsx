"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Checkbox,
  CircularProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

type Lead = {
  id: string;
  magnet_slug: string;
  email: string;
  full_name: string | null;
  source: string | null;
  contacted_at: string | null;
  created_at: string;
};

type Summary = { magnet_slug: string; count: number; contacted: number };

const INK = "#0A1320";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const LINE = "#E0DACE";
const GOLD = "#A07823";

// ASN has no lead magnet yet; add "slug": "Human label" entries here as
// they ship. Unknown slugs render as the raw slug.
const MAGNET_LABEL: Record<string, string> = {};

export default function AdminLeadMagnetsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/admin/lead-magnets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { leads?: Lead[]; summary?: Summary[] } | null) => {
        if (!b) return;
        setLeads(b.leads ?? []);
        setSummary(b.summary ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = async (id: string, next: boolean) => {
    // Optimistic
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, contacted_at: next ? new Date().toISOString() : null } : l,
      ),
    );
    try {
      await fetch("/api/admin/lead-magnets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, contacted: next }),
      });
    } catch {
      // ignore — refresh on next page load
    }
  };

  return (
    <Stack spacing={3.5} sx={{ maxWidth: 1100, mx: "auto" }}>
      <Box>
        <Typography
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: GOLD,
            textTransform: "uppercase",
            mb: 1,
          }}
        >
          Lead magnets
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
          Free-kit downloads
        </Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, lineHeight: 1.55, maxWidth: 640 }}>
          Every email captured by a homepage free-kit form. Tick the box once your team has reached out.
        </Typography>
      </Box>

      {!loading && summary.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fit, minmax(220px, 1fr))" },
            gap: 2,
          }}
        >
          {summary.map((s) => (
            <Box
              key={s.magnet_slug}
              sx={{ borderRadius: 2, border: `1px solid ${LINE}`, bgcolor: "#FFFFFF", p: 2 }}
            >
              <Typography
                sx={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  color: INK_MUTED,
                  textTransform: "uppercase",
                  mb: 0.5,
                }}
              >
                {MAGNET_LABEL[s.magnet_slug] ?? s.magnet_slug}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.7rem",
                  fontWeight: 600,
                  color: INK,
                  lineHeight: 1,
                }}
              >
                {s.count}
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", color: INK_MUTED, mt: 0.5 }}>
                {s.contacted} contacted · {s.count - s.contacted} pending
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ borderRadius: 3, border: `1px solid ${LINE}`, bgcolor: "#FFFFFF", overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>
            Latest leads
          </Typography>
        </Box>
        {loading ? (
          <Stack sx={{ alignItems: "center", py: 5 }}>
            <CircularProgress size={20} sx={{ color: GOLD }} />
          </Stack>
        ) : leads.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.92rem", color: INK_MUTED }}>
              No leads yet. They&apos;ll appear here as people fill the homepage free-kit form.
            </Typography>
          </Box>
        ) : (
          <Stack divider={<Box sx={{ borderTop: "1px solid #F1EBDF" }} />}>
            {leads.map((l) => (
              <Stack
                key={l.id}
                direction="row"
                sx={{ px: 2.5, py: 1.5, alignItems: "center", gap: 2 }}
              >
                <Tooltip title={l.contacted_at ? "Mark as not contacted" : "Mark as contacted"}>
                  <Checkbox
                    checked={!!l.contacted_at}
                    onChange={(e) => toggle(l.id, e.target.checked)}
                    size="small"
                    sx={{
                      color: INK_MUTED,
                      "&.Mui-checked": { color: "#1F5C40" },
                      p: 0.5,
                    }}
                  />
                </Tooltip>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: INK }} noWrap>
                    {l.full_name || l.email}
                  </Typography>
                  {l.full_name && (
                    <Typography sx={{ fontSize: "0.78rem", color: INK_MUTED }} noWrap>
                      {l.email}
                    </Typography>
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    color: INK_MUTED,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    display: { xs: "none", sm: "block" },
                  }}
                >
                  {MAGNET_LABEL[l.magnet_slug] ?? l.magnet_slug}
                </Typography>
                <Typography sx={{ fontSize: "0.74rem", color: INK_MUTED, minWidth: 96, textAlign: "right" }}>
                  {new Date(l.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Typography>
                <Box
                  component="a"
                  href={`mailto:${l.email}`}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.3,
                    color: GOLD,
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Email <OpenInNewRoundedIcon sx={{ fontSize: 12 }} />
                </Box>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
