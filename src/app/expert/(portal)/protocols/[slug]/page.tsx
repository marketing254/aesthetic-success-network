"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import HeadphonesRoundedIcon from "@mui/icons-material/HeadphonesRounded";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { CP } from "@/components/shared/CommunityPortalShell";
import { EP } from "@/components/shared/TopNavPortalShell";
import { TagPill, portalText } from "@/components/vendor/PortalUI";
import ProtocolStatusBadge from "@/components/expert/ProtocolStatusBadge";

type ProtocolFile = { id: string; title: string; kind: string; type: "video" | "audio" | "pdf" | "image" | "other"; url: string; sizeBytes: number | null };
type Protocol = {
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  cover: string | null;
  status: "live" | "pending";
  fileCount: number;
};

function size(b: number | null): string {
  if (!b) return "";
  return b >= 1048576 ? `${(b / 1048576).toFixed(b >= 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

const ICON = { video: PlayArrowRoundedIcon, audio: HeadphonesRoundedIcon, pdf: PictureAsPdfOutlinedIcon, image: InsertDriveFileOutlinedIcon, other: InsertDriveFileOutlinedIcon };
const TYPE_LABEL = { video: "Video", audio: "Audio", pdf: "PDF", image: "Image", other: "File" };

/** One Protocol, exactly as members will get it: every file in order, playable and openable. */
export default function ExpertProtocolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<{ protocol: Protocol; files: ProtocolFile[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<ProtocolFile | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/expert/protocols/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (r) => {
        const b = (await r.json().catch(() => ({}))) as { protocol?: Protocol; files?: ProtocolFile[]; error?: string };
        if (!active) return;
        if (!r.ok || !b.protocol) return setError(r.status === 404 ? "This Protocol isn't in your portal." : b.error ?? "Couldn't load this Protocol.");
        setData({ protocol: b.protocol, files: b.files ?? [] });
        setPlaying((b.files ?? [])[0] ?? null);
      })
      .catch(() => active && setError("Couldn't load this Protocol."));
    return () => {
      active = false;
    };
  }, [slug]);

  if (error)
    return (
      <Stack spacing={2}>
        <BackLink />
        <Alert severity="error">{error}</Alert>
      </Stack>
    );
  if (!data)
    return (
      <Stack sx={{ alignItems: "center", py: 10 }}>
        <CircularProgress size={26} />
      </Stack>
    );

  const { protocol: p, files } = data;

  return (
    <Stack spacing={3}>
      <BackLink />

      {/* Header */}
      <Box sx={{ borderRadius: "14px", bgcolor: CP.white, border: `1px solid ${CP.border}`, p: { xs: 2, md: 2.5 }, display: "flex", gap: { xs: 2, md: 3 }, alignItems: "flex-start" }}>
        <Box sx={{ width: { xs: 84, md: 120 }, flex: "none", aspectRatio: "3 / 4", borderRadius: "10px", overflow: "hidden", bgcolor: "#0B1422", boxShadow: "0 10px 24px -12px rgba(10,19,32,0.5)" }}>
          {p.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.cover} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            {p.category && (
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: EP.bronze }}>
                Expert Signature Series &middot; {p.category}
              </Typography>
            )}
            <ProtocolStatusBadge status={p.status} />
          </Stack>
          <Typography component="h1" sx={{ mt: 0.75, fontSize: { xs: "1.3rem", md: "1.55rem" }, fontWeight: 700, lineHeight: 1.2, color: CP.ink, letterSpacing: "-0.015em" }}>
            {p.title}
          </Typography>
          {p.description && <Typography sx={{ ...(portalText.body as object), mt: 0.75, fontSize: "0.92rem", maxWidth: 720 }}>{p.description}</Typography>}
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1.25 }}>
            {p.tags.map((t) => (
              <TagPill key={t} label={t} size="sm" />
            ))}
          </Stack>
        </Box>
      </Box>

      <Alert severity={p.status === "live" ? "success" : "info"} sx={{ borderRadius: 2 }}>
        {p.status === "live"
          ? "Members can see this Protocol in the library."
          : "Hidden from members. Check every file below, then email experts@aestheticsuccessnetwork.com to approve it or ask for a change."}
      </Alert>

      {/* Player + files, side by side on desktop */}
      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 7fr) minmax(0, 5fr)" }, alignItems: "start" }}>
        {playing && (
          <Box sx={{ borderRadius: "14px", overflow: "hidden", bgcolor: playing.type === "video" ? "#000" : CP.white, border: `1px solid ${CP.border}`, position: { lg: "sticky" }, top: { lg: 88 } }}>
            {playing.type === "video" ? (
              <video key={playing.id} src={playing.url} controls preload="metadata" style={{ width: "100%", aspectRatio: "16 / 9", display: "block", background: "#000" }} />
            ) : playing.type === "audio" ? (
              <Box sx={{ p: 3, bgcolor: CP.navy }}>
                <Typography sx={{ color: "#fff", fontWeight: 600, mb: 1.5 }}>{playing.title}</Typography>
                <audio key={playing.id} src={playing.url} controls style={{ width: "100%" }} />
              </Box>
            ) : playing.type === "pdf" ? (
              <Box component="iframe" key={playing.id} src={`${playing.url}#toolbar=1&navpanes=0&view=FitH`} title={playing.title} sx={{ width: "100%", height: { xs: "70vh", lg: "calc(100vh - 200px)" }, minHeight: 480, border: 0, display: "block", bgcolor: "#525659" }} />
            ) : playing.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={playing.id} src={playing.url} alt={playing.title} style={{ width: "100%", display: "block" }} />
            ) : (
              <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography sx={{ color: CP.muted, fontSize: "0.9rem" }}>This file type can&apos;t be previewed here.</Typography>
              </Box>
            )}
            <Stack direction="row" sx={{ px: 2, py: 1.1, bgcolor: CP.white, borderTop: `1px solid ${CP.border}`, alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: "0.82rem", color: CP.muted, flex: 1, minWidth: 0 }} noWrap>
                {playing.type === "video" || playing.type === "audio" ? "Now playing " : "Viewing "}
                <Box component="span" sx={{ fontWeight: 600, color: CP.ink }}>{playing.title}</Box>
              </Typography>
              <Button size="small" component="a" href={playing.url} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />} sx={{ textTransform: "none", fontSize: "0.76rem", color: CP.muted, py: 0, minWidth: 0 }}>
                Open in new tab
              </Button>
            </Stack>
          </Box>
        )}

        <Box sx={{ borderRadius: "14px", bgcolor: CP.white, border: `1px solid ${CP.border}`, overflow: "hidden" }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${CP.border}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: CP.ink }}>What members get</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: CP.muted }}>{files.length} files, in the order members see them</Typography>
          </Box>
          {files.map((f, i) => {
            const Icon = ICON[f.type];
            const playable = f.type === "video" || f.type === "audio";
            const active = playing?.id === f.id;
            return (
              <Stack
                key={f.id}
                direction="row"
                sx={{
                  alignItems: "center",
                  gap: 1.25,
                  px: 2,
                  py: 1,
                  borderTop: i ? `1px solid ${CP.border}` : "none",
                  bgcolor: active ? EP.bronzeTint : "transparent",
                  cursor: "pointer",
                  "&:hover": { bgcolor: active ? EP.bronzeTint : CP.sandSoft },
                }}
                onClick={() => { setPlaying(f); if (window.innerWidth < 1200) window.scrollTo({ top: 0, behavior: "smooth" }); }}
              >
                <Typography sx={{ width: 20, fontSize: "0.74rem", color: CP.faint, fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</Typography>
                <Box sx={{ width: 30, height: 30, flex: "none", borderRadius: "8px", display: "grid", placeItems: "center", bgcolor: f.type === "pdf" ? "#FBEDEC" : f.type === "video" ? "#EAF0FB" : f.type === "audio" ? "#EFEAFB" : CP.sandSoft, color: f.type === "pdf" ? "#A33A2E" : f.type === "video" ? "#2F5DA8" : f.type === "audio" ? "#5B3FA6" : CP.muted }}>
                  <Icon sx={{ fontSize: 17 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography noWrap sx={{ fontSize: "0.88rem", fontWeight: 600, color: CP.ink }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: CP.muted }}>
                    {TYPE_LABEL[f.type]}
                    {f.sizeBytes ? ` · ${size(f.sizeBytes)}` : ""}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant={active ? "contained" : "outlined"}
                  onClick={() => { setPlaying(f); if (window.innerWidth < 1200) window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  sx={{ textTransform: "none", borderRadius: 999, minWidth: 74, py: 0.25, fontSize: "0.78rem" }}
                >
                  {playable ? (active ? "Playing" : "Play") : active ? "Viewing" : "View"}
                </Button>
              </Stack>
            );
          })}
        </Box>
      </Box>

      <Typography sx={{ ...(portalText.meta as object) }}>
        Your short clips, carousel images and post copy for this Protocol are under{" "}
        <Box component={Link} href="/expert/downloads" sx={{ color: EP.bronze, fontWeight: 600 }}>
          Social pack
        </Box>
        . Only you can see it.
      </Typography>
    </Stack>
  );
}

function BackLink() {
  return (
    <Box component={Link} href="/expert/protocols" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: CP.muted, fontSize: "0.88rem", fontWeight: 600, textDecoration: "none", "&:hover": { color: CP.ink } }}>
      <ArrowBackRoundedIcon sx={{ fontSize: 17 }} /> My Protocols
    </Box>
  );
}
