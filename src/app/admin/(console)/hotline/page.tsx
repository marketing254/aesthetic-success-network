"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Snackbar, Stack, Typography,
} from "@mui/material";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";

const INK = "#0A1320";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E0DACE";

type Status = "pending" | "emailed" | "in_progress" | "resolved" | "closed";
type Inquiry = {
  id: string;
  member_name: string;
  email: string;
  question: string;
  status: Status;
  pdf_url: string | null;
  admin_note: string | null;
  created_at: string;
};

const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  pending: { label: "New", bg: "rgba(160,120,35,0.16)", fg: "#7A5B12" },
  emailed: { label: "Pack sent", bg: "rgba(34,108,78,0.14)", fg: "#1F5C40" },
  in_progress: { label: "In progress", bg: "rgba(31,58,92,0.14)", fg: "#1B3A5C" },
  resolved: { label: "Resolved", bg: "rgba(34,108,78,0.14)", fg: "#1F5C40" },
  closed: { label: "Closed", bg: "rgba(122,133,144,0.16)", fg: INK_MUTED },
};
const OPEN_STATES: Status[] = ["pending", "emailed", "in_progress"];

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

export default function AdminHotlinePage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "all">("open");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/hotline", { cache: "no-store" });
      if (res.ok) {
        const b = (await res.json()) as { inquiries?: Inquiry[] };
        setRows(b.inquiries ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: string, toastMsg: string) => {
    const res = await fetch("/api/admin/hotline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) { setToast(toastMsg); await load(); }
  };

  const visible = tab === "open" ? rows.filter((r) => OPEN_STATES.includes(r.status)) : rows;
  const openCount = rows.filter((r) => OPEN_STATES.includes(r.status)).length;

  return (
    <Stack spacing={3.5}>
      <Box>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", color: GOLD, textTransform: "uppercase", mb: 1 }}>
          Hotline triage
        </Typography>
        <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.9rem", md: "2.4rem" }, fontWeight: 500, color: INK, lineHeight: 1.1, mb: 1 }}>
          Beacon inquiries
        </Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, maxWidth: 640 }}>
          Questions members handed to the team through Beacon. Each member already got the ASN pack by email. Reply from
          support@aestheticsuccessnetwork.com within the 2 to 3 business-day SLA, then mark it resolved.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1}>
        <Button onClick={() => setTab("open")} variant={tab === "open" ? "contained" : "outlined"}
          sx={{ textTransform: "none", borderRadius: 999, bgcolor: tab === "open" ? INK : undefined, borderColor: LINE, color: tab === "open" ? "#fff" : INK }}>
          Open{openCount ? ` (${openCount})` : ""}
        </Button>
        <Button onClick={() => setTab("all")} variant={tab === "all" ? "contained" : "outlined"}
          sx={{ textTransform: "none", borderRadius: 999, bgcolor: tab === "all" ? INK : undefined, borderColor: LINE, color: tab === "all" ? "#fff" : INK }}>
          All
        </Button>
      </Stack>

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}><CircularProgress size={22} sx={{ color: GOLD }} /></Stack>
      ) : visible.length === 0 ? (
        <Box sx={{ p: { xs: 4, md: 6 }, borderRadius: 3, border: `1px dashed ${LINE}`, bgcolor: "#fff", textAlign: "center" }}>
          <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "rgba(217,168,75,0.14)", color: GOLD, display: "grid", placeItems: "center", mx: "auto", mb: 1.5 }}>
            <SupportAgentOutlinedIcon sx={{ fontSize: 26 }} />
          </Box>
          <Typography sx={{ fontSize: "1.1rem", fontWeight: 600, color: INK, mb: 0.5 }}>
            {tab === "open" ? "No open inquiries" : "No inquiries yet"}
          </Typography>
          <Typography sx={{ fontSize: "0.9rem", color: INK_MUTED, maxWidth: 460, mx: "auto" }}>
            When Beacon hands a question to the team, it lands here with the member&apos;s details.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {visible.map((r) => {
            const st = STATUS_META[r.status];
            return (
              <Box key={r.id} sx={{ border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#fff", p: { xs: 2, md: 2.5 } }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", mb: 0.6, flexWrap: "wrap", gap: 0.5 }}>
                      <Chip label={st.label} size="small" sx={{ height: 20, fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", bgcolor: st.bg, color: st.fg }} />
                      <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{r.member_name}</Typography>
                      <Box component="a" href={`mailto:${r.email}`} sx={{ fontSize: "0.82rem", color: GOLD, textDecoration: "none", fontWeight: 600 }}>{r.email}</Box>
                      <Typography sx={{ fontSize: "0.75rem", color: INK_MUTED }}>· {fmt(r.created_at)}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, lineHeight: 1.55 }}>{r.question}</Typography>
                    {r.pdf_url && (
                      <Box component="a" href={r.pdf_url} target="_blank" rel="noopener noreferrer"
                        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 1, fontSize: "0.78rem", color: INK_MUTED, textDecoration: "none", "&:hover": { color: GOLD } }}>
                        <PictureAsPdfRoundedIcon sx={{ fontSize: 15 }} /> Pack sent to member
                      </Box>
                    )}
                  </Box>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start", flexWrap: "wrap", gap: 0.75 }}>
                    {r.status !== "in_progress" && r.status !== "resolved" && r.status !== "closed" && (
                      <Button size="small" variant="outlined" onClick={() => act(r.id, "start", "Marked in progress")}
                        sx={{ textTransform: "none", borderRadius: 999, borderColor: LINE, color: INK }}>Start</Button>
                    )}
                    {r.status !== "resolved" && r.status !== "closed" && (
                      <Button size="small" variant="contained" onClick={() => act(r.id, "resolve", "Resolved")}
                        sx={{ textTransform: "none", borderRadius: 999, bgcolor: "#1F5C40", "&:hover": { bgcolor: "#184a33" } }}>Resolve</Button>
                    )}
                    {(r.status === "resolved" || r.status === "closed") && (
                      <Button size="small" variant="text" onClick={() => act(r.id, "reopen", "Reopened")}
                        sx={{ textTransform: "none", color: INK_SOFT }}>Reopen</Button>
                    )}
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast(null)} message={toast ?? ""} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Stack>
  );
}
