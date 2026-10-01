"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";

type AuditEntry = {
  id: string;
  source: "review" | "auth";
  action: string;
  target: string;
  who: string;
  created_at: string;
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/audit", { cache: "no-store" });
        const body = (await res.json()) as { rows?: AuditEntry[]; error?: string };
        if (!active) return;
        if (!res.ok || body.error) {
          setError(body.error ?? `Failed to load (${res.status})`);
          return;
        }
        setRows(body.rows ?? []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="overline" sx={{ display: "block" }}>
          AUDIT LOG
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Recent activity
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
          Combined feed of admin review actions and authentication events. Use this when investigating who changed what, when.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Stack sx={{ py: 6, alignItems: "center" }}>
          <CircularProgress size={24} sx={{ color: "#A07823" }} />
        </Stack>
      ) : rows.length === 0 ? (
        <Box sx={{ p: 6, textAlign: "center", borderRadius: "18px", border: "1px dashed", borderColor: "divider", bgcolor: "common.white" }}>
          <Typography sx={{ color: "text.secondary" }}>No activity yet.</Typography>
        </Box>
      ) : (
        <Box
          sx={{
            borderRadius: "18px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
            overflow: "hidden",
          }}
        >
          <Stack divider={<Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />}>
            {rows.map((s) => {
              const isAuth = s.source === "auth";
              const tint = isAuth
                ? { bg: "rgba(14,42,61,0.07)", color: "#0E2A3D" }
                : { bg: "rgba(217,168,75,0.16)", color: "#A07823" };
              const Icon = isAuth ? LoginOutlinedIcon : HistoryOutlinedIcon;
              return (
                <Stack key={s.id} direction="row" sx={{ p: 2.25, gap: 2, alignItems: "flex-start" }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: tint.bg, color: tint.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.75, mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }}>
                        {s.action.replace(/_/g, " ")}
                      </Typography>
                      <Chip
                        label={isAuth ? "AUTH" : "REVIEW"}
                        size="small"
                        sx={{ bgcolor: tint.bg, color: tint.color, fontWeight: 700, fontSize: "0.58rem", height: 18, letterSpacing: "0.1em" }}
                      />
                      <Chip
                        label={s.who}
                        size="small"
                        sx={{ bgcolor: "rgba(14,42,61,0.06)", color: "text.secondary", fontWeight: 600, fontSize: "0.6rem", height: 18 }}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "text.primary", wordBreak: "break-word" }}>
                      {s.target || ""}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary", flexShrink: 0, whiteSpace: "nowrap" }}>
                    {formatRelative(s.created_at)}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
