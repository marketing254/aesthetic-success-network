"use client";

import { useEffect, useState } from "react";
import { Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

type InboxItem = {
  id: string;
  question: string;
  status: "pending" | "emailed" | "in_progress" | "resolved" | "closed";
  pdf_url: string | null;
  pdf_sent_at: string | null;
  member_seen_at: string | null;
  created_at: string;
};

const STATUS_META: Record<InboxItem["status"], { label: string; bg: string; fg: string }> = {
  pending: { label: "With the team", bg: "rgba(160,120,35,0.14)", fg: "#7A5B12" },
  emailed: { label: "Pack sent", bg: "rgba(34,108,78,0.14)", fg: "#1F5C40" },
  in_progress: { label: "In progress", bg: "rgba(31,58,92,0.14)", fg: "#1B3A5C" },
  resolved: { label: "Resolved", bg: "rgba(34,108,78,0.14)", fg: "#1F5C40" },
  closed: { label: "Closed", bg: "rgba(122,133,144,0.16)", fg: INK_MUTED },
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default function MemberInboxPage() {
  const [rows, setRows] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/member/inbox", { cache: "no-store" });
        if (!active) return;
        if (res.ok) {
          const body = (await res.json()) as { rows?: InboxItem[] };
          setRows(body.rows ?? []);
        }
      } finally {
        if (active) setLoading(false);
      }
      // Mark everything seen once the inbox is open.
      void fetch("/api/member/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_seen" }),
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Box sx={{ maxWidth: 820, mx: "auto", py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", color: INK_MUTED, textTransform: "uppercase", mb: 1 }}>
        Inbox
      </Typography>
      <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.9rem", md: "2.3rem" }, fontWeight: 500, color: INK, lineHeight: 1.1, mb: 0.75 }}>
        Your requests &amp; packs
      </Typography>
      <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, mb: 3.5, maxWidth: 620 }}>
        When you ask Beacon something the team needs to handle, it lands here, along with the ASN pack we send you.
      </Typography>

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress size={22} sx={{ color: GOLD }} />
        </Stack>
      ) : rows.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, border: `1px dashed ${LINE}`, borderRadius: 3 }}>
          <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "rgba(217,168,75,0.14)", color: GOLD, display: "grid", placeItems: "center", mx: "auto", mb: 1.5 }}>
            <InboxRoundedIcon sx={{ fontSize: 26 }} />
          </Box>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK, mb: 0.5 }}>Nothing here yet</Typography>
          <Typography sx={{ fontSize: "0.9rem", color: INK_MUTED, maxWidth: 420, mx: "auto" }}>
            Ask Beacon (bottom-right) anything. If it needs the team, your request and pack will show up here.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((r) => {
            const st = STATUS_META[r.status];
            const unseen = r.member_seen_at === null;
            return (
              <Box
                key={r.id}
                sx={{
                  position: "relative",
                  border: `1px solid ${unseen ? "rgba(160,120,35,0.4)" : LINE}`,
                  borderRadius: 2,
                  bgcolor: "#FFFFFF",
                  p: { xs: 2, sm: 2.5 },
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap", gap: 0.75 }}>
                  <Chip label={st.label} size="small" sx={{ height: 20, fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", bgcolor: st.bg, color: st.fg }} />
                  <Typography sx={{ fontSize: "0.75rem", color: INK_MUTED }}>{fmt(r.created_at)}</Typography>
                </Stack>
                <Typography sx={{ fontSize: "0.95rem", color: INK, lineHeight: 1.5, mb: r.pdf_url ? 1.5 : 0 }}>
                  {r.question}
                </Typography>
                {r.pdf_url ? (
                  <Button
                    component="a"
                    href={r.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    startIcon={<PictureAsPdfRoundedIcon sx={{ fontSize: 17 }} />}
                    sx={{ textTransform: "none", borderRadius: 999, borderColor: LINE, color: INK, fontWeight: 600 }}
                  >
                    Download your ASN pack
                  </Button>
                ) : r.status === "pending" ? (
                  <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", color: INK_MUTED }}>
                    <MarkEmailReadRoundedIcon sx={{ fontSize: 15 }} />
                    <Typography sx={{ fontSize: "0.82rem" }}>The team will reply within 2 to 3 business days.</Typography>
                  </Stack>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
