"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FolderZipOutlinedIcon from "@mui/icons-material/FolderZipOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { CP } from "@/components/shared/CommunityPortalShell";
import { EmptyState, PageHeader } from "@/components/vendor/PortalUI";

type AssetFile = { id: string; title: string; kind: string; url: string; downloadUrl: string; sizeBytes: number | null };
type Group = { slug: string; title: string; files: AssetFile[] };

function size(b: number | null): string {
  if (!b) return "";
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

/**
 * Provider-only downloads (social packs, share kits, launch packs, kit
 * overviews). Files sit in a private bucket; links are signed per visit
 * and expire after an hour. Members never see this page or these files.
 */
export default function ProviderDownloads({ endpoint, who }: { endpoint: string; who: "expert" | "company" }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store" })
      .then(async (r) => {
        const b = (await r.json().catch(() => ({}))) as { groups?: Group[]; error?: string };
        if (!active) return;
        if (!r.ok) setError(b.error ?? "Couldn't load your downloads right now.");
        setGroups(b.groups ?? []);
      })
      .catch(() => active && (setError("Couldn't load your downloads right now."), setGroups([])));
    return () => {
      active = false;
    };
  }, [endpoint]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title={who === "expert" ? "Social pack" : "Downloads"}
        subtitle={
          who === "expert"
            ? "Short clips, carousel images and post copy from each of your Protocols, ready to share on your own channels."
            : "Files made for your company: your kit overview and launch materials."
        }
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: CP.muted }}>
        <LockOutlinedIcon sx={{ fontSize: 16 }} />
        <Typography sx={{ fontSize: "0.85rem" }}>Only you can see these. Members never do.</Typography>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {groups === null ? (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress size={26} />
        </Stack>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={FolderZipOutlinedIcon}
          title="Nothing here yet"
          body="When the team finishes your social pack or launch materials, they appear here to download."
        />
      ) : (
        groups.map((g) => (
          <Box key={g.slug} sx={{ borderRadius: "16px", bgcolor: CP.white, border: `1px solid ${CP.border}`, overflow: "hidden" }}>
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${CP.border}` }}>
              <Typography sx={{ fontWeight: 700, color: CP.ink }}>{g.title}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: CP.muted }}>{g.files.length} files</Typography>
            </Box>
            <Box sx={{ p: 2, display: "grid", gap: 1.75, gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: "repeat(5, 1fr)" } }}>
              {g.files.map((f) => (
                <Box key={f.id} sx={{ borderRadius: "12px", border: `1px solid ${CP.border}`, overflow: "hidden", display: "flex", flexDirection: "column", bgcolor: CP.sandSoft }}>
                  <Box sx={{ aspectRatio: f.kind === "video" ? "9 / 16" : "1 / 1", bgcolor: "#0B1422", display: "grid", placeItems: "center", overflow: "hidden" }}>
                    {f.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt={f.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : f.kind === "video" ? (
                      <video src={f.url} controls preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }} />
                    ) : f.kind === "pdf" ? (
                      <PictureAsPdfOutlinedIcon sx={{ fontSize: 42, color: "#F3B2AA" }} />
                    ) : (
                      <InsertDriveFileOutlinedIcon sx={{ fontSize: 42, color: "#C9D1D9" }} />
                    )}
                  </Box>
                  <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 0.75, flex: 1, bgcolor: CP.white }}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: CP.ink, lineHeight: 1.3 }}>{f.title}</Typography>
                    {f.sizeBytes ? <Typography sx={{ fontSize: "0.72rem", color: CP.muted }}>{size(f.sizeBytes)}</Typography> : null}
                    <Button
                      size="small"
                      variant="outlined"
                      component="a"
                      href={f.downloadUrl}
                      startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
                      sx={{ mt: "auto", textTransform: "none", borderRadius: 999 }}
                    >
                      Download
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        ))
      )}
    </Stack>
  );
}
