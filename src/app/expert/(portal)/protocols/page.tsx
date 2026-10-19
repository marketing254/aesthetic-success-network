"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { CP } from "@/components/shared/CommunityPortalShell";
import { EP } from "@/components/shared/TopNavPortalShell";
import { EmptyState, PageHeader, TagPill, portalText } from "@/components/vendor/PortalUI";
import ProtocolStatusBadge from "@/components/expert/ProtocolStatusBadge";

type Protocol = {
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  cover: string | null;
  status: "live" | "pending";
  fileCount: number;
  videoCount: number;
  pdfCount: number;
};

/**
 * "My Protocols" (Lester's guide, 19 Oct 2026): every Protocol built from
 * this expert's sessions, approved or not, so they can check them. Members
 * see a Protocol only after the expert approves it.
 */
export default function ExpertProtocolsPage() {
  const [items, setItems] = useState<Protocol[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/expert/protocols", { cache: "no-store" })
      .then(async (r) => {
        const b = (await r.json().catch(() => ({}))) as { protocols?: Protocol[]; error?: string };
        if (!active) return;
        if (!r.ok) setError(b.error ?? "Couldn't load your Protocols right now.");
        setItems(b.protocols ?? []);
      })
      .catch(() => active && (setError("Couldn't load your Protocols right now."), setItems([])));
    return () => {
      active = false;
    };
  }, []);

  const live = items?.filter((p) => p.status === "live").length ?? 0;
  const pending = items?.filter((p) => p.status === "pending").length ?? 0;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="My Protocols"
        subtitle="The Protocols built from your sessions. Open each one to check every file. Members see a Protocol only after you approve it."
      />

      {items && items.length > 0 && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Stat value={items.length} label="Protocols" />
          <Stat value={live} label="Live for members" tone="green" />
          <Stat value={pending} label="Waiting for your approval" tone="gold" />
        </Stack>
      )}

      {pending > 0 && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          To approve a Protocol or ask for a change, email{" "}
          <Box component="a" href="mailto:experts@aestheticsuccessnetwork.com" sx={{ color: "inherit", fontWeight: 700 }}>
            experts@aestheticsuccessnetwork.com
          </Box>
          . Until then it stays hidden from members.
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {items === null ? (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress size={26} />
        </Stack>
      ) : items.length === 0 ? (
        <EmptyState
          icon={LibraryBooksOutlinedIcon}
          title="No Protocols yet"
          body="When the team finishes a Protocol from your session, it appears here first so you can review it before members see it."
        />
      ) : (
        <Box sx={{ borderRadius: "14px", bgcolor: CP.white, border: `1px solid ${CP.border}`, overflow: "hidden" }}>
          {items.map((p, i) => (
            <Box
              key={p.slug}
              component={Link}
              href={`/expert/protocols/${p.slug}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: { xs: 1.5, sm: 2.25 },
                px: { xs: 1.5, sm: 2.25 },
                py: 1.5,
                textDecoration: "none",
                borderTop: i ? `1px solid ${CP.border}` : "none",
                transition: "background 140ms ease",
                "&:hover": { bgcolor: CP.sandSoft },
              }}
            >
              <Box sx={{ width: { xs: 56, sm: 72 }, flex: "none", aspectRatio: "3 / 4", borderRadius: "8px", overflow: "hidden", bgcolor: "#0B1422", boxShadow: "0 6px 16px -8px rgba(10,19,32,0.45)" }}>
                {p.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                )}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  {p.category && (
                    <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: EP.bronze }}>
                      {p.category}
                    </Typography>
                  )}
                  <Box sx={{ display: { xs: "inline-flex", sm: "none" } }}>
                    <ProtocolStatusBadge status={p.status} />
                  </Box>
                </Stack>
                <Typography sx={{ mt: 0.25, fontSize: "1rem", fontWeight: 700, color: CP.ink, lineHeight: 1.3 }}>{p.title}</Typography>
                {p.description && (
                  <Typography sx={{ ...(portalText.body as object), fontSize: "0.86rem", mt: 0.25, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {p.description}
                  </Typography>
                )}
                <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5, mt: 0.75, color: CP.muted, fontSize: "0.78rem" }}>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <PlayCircleOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    <span>{p.videoCount} videos</span>
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <DescriptionOutlinedIcon sx={{ fontSize: 15 }} />
                    <span>{p.pdfCount} guides</span>
                  </Stack>
                  <span>{p.fileCount} files</span>
                  <Stack direction="row" sx={{ gap: 0.5, display: { xs: "none", md: "flex" } }}>
                    {p.tags.slice(0, 3).map((t) => (
                      <TagPill key={t} label={t} size="sm" />
                    ))}
                  </Stack>
                </Stack>
              </Box>
              <Box sx={{ display: { xs: "none", sm: "inline-flex" }, flex: "none" }}>
                <ProtocolStatusBadge status={p.status} />
              </Box>
              <ChevronRightRoundedIcon sx={{ fontSize: 20, color: CP.faint, flex: "none", display: { xs: "none", sm: "block" } }} />
            </Box>
          ))}
        </Box>
      )}
    </Stack>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "green" | "gold" }) {
  return (
    <Box sx={{ flex: 1, px: 2.25, py: 1.75, borderRadius: "14px", bgcolor: CP.white, border: `1px solid ${CP.border}` }}>
      <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1, color: tone === "green" ? "#1F5C40" : tone === "gold" ? "#A07823" : CP.ink }}>
        {value}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: "0.82rem", color: CP.muted }}>{label}</Typography>
    </Box>
  );
}
