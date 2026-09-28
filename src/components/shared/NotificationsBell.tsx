"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import type { SvgIconComponent } from "@mui/icons-material";

/**
 * Audiences the bell can serve. vendor/admin are the DMN originals; expert
 * and member arrive with migration 0068 (expert_id, member_id,
 * recipient_auth_user_id) and the extended GET/PATCH /api/notifications.
 */
export type NotificationAudience = "vendor" | "admin" | "expert" | "member";

type NotificationRow = {
  id: string;
  audience: NotificationAudience;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
};

const KIND_ICON: Record<string, SvgIconComponent> = {
  vendor_approved: VerifiedUserOutlinedIcon,
  vendor_rejected: StoreOutlinedIcon,
  new_vendor_application: StoreOutlinedIcon,
  offer_submitted: LocalOfferOutlinedIcon,
  catalog_submitted: Inventory2OutlinedIcon,
  expert_approved: VerifiedUserOutlinedIcon,
  resource_published: Inventory2OutlinedIcon,
  inquiry_reply: NotificationsActiveOutlinedIcon,
  new_offer: LocalOfferOutlinedIcon,
};

const EMPTY_COPY: Record<NotificationAudience, string> = {
  vendor: "Updates about your approvals, offers, and redemptions will show up here.",
  admin: "New company applications, offer submissions, and team actions will land here.",
  expert: "Updates about your kits, member inquiries and replies will show up here.",
  member: "New kits, partner offers and replies to your questions will show up here.",
};

const NAVY = "#0E2A3D";
const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

function iconFor(kind: string): SvgIconComponent {
  return KIND_ICON[kind] ?? NotificationsNoneOutlinedIcon;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsBell({
  audience,
  tone = "light",
}: {
  audience: NotificationAudience;
  /** "dark" for navy top bars (admin, member); "light" for white top bars. */
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?audience=${audience}&limit=20`, {
        cache: "no-store",
      });
      const body = (await res.json()) as { rows?: NotificationRow[]; error?: string };
      if (!res.ok) {
        console.warn("[notifications] fetch failed:", body.error);
        setRows([]);
        return;
      }
      setRows(body.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [audience]);

  // Initial load + soft refresh every 60s while open.
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [open, load]);

  const unread = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  const markRead = async (id: string) => {
    setBusyId(id);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "mark_read" }),
      });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read_at: new Date().toISOString() } : r)));
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audience, action: "mark_all_read" }),
    });
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => (r.read_at ? r : { ...r, read_at: now })));
  };

  const onItemClick = async (n: NotificationRow) => {
    if (!n.read_at) await markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const iconColor = tone === "dark" ? "rgba(255,255,255,0.85)" : MUTED;

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          ref={anchorRef}
          size="small"
          onClick={() => setOpen((v) => !v)}
          sx={{ color: iconColor, borderRadius: "6px" }}
          aria-label="Notifications"
        >
          <Badge
            badgeContent={unread > 0 ? unread : 0}
            invisible={unread === 0}
            overlap="circular"
            sx={{
              "& .MuiBadge-badge": {
                fontWeight: 600,
                fontSize: "0.65rem",
                minWidth: 16,
                height: 16,
                bgcolor: "#B91C1C",
                color: "#FFFFFF",
              },
            }}
          >
            {unread > 0 ? (
              <NotificationsActiveOutlinedIcon sx={{ fontSize: 20 }} />
            ) : (
              <NotificationsNoneOutlinedIcon sx={{ fontSize: 20 }} />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: { xs: "92vw", sm: 380 },
              maxHeight: 480,
              borderRadius: "8px",
              border: `1px solid ${LINE}`,
              boxShadow: "0 4px 16px -4px rgba(17,24,39,0.12)",
              backgroundImage: "none",
              overflow: "hidden",
            },
          },
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", px: 2, py: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }}>Notifications</Typography>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </Typography>
          </Box>
          <Button
            size="small"
            disabled={unread === 0}
            onClick={markAll}
            startIcon={<DoneAllOutlinedIcon sx={{ fontSize: 14 }} />}
            sx={{
              textTransform: "none",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: NAVY,
              borderRadius: "6px",
              "&:hover": { bgcolor: "#F3F4F6", transform: "none" },
              "&.Mui-disabled": { color: "#9CA3AF" },
            }}
          >
            Mark all read
          </Button>
        </Stack>
        <Divider sx={{ borderColor: LINE }} />

        <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
          {loading ? (
            <Stack sx={{ py: 4, alignItems: "center" }}>
              <CircularProgress size={20} sx={{ color: NAVY }} />
            </Stack>
          ) : rows.length === 0 ? (
            <Stack sx={{ py: 5, px: 3, alignItems: "center", textAlign: "center" }}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK, mb: 0.5 }}>
                No notifications yet
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: MUTED, maxWidth: 260 }}>{EMPTY_COPY[audience]}</Typography>
            </Stack>
          ) : (
            rows.map((n) => {
              const Icon = iconFor(n.kind);
              const isUnread = !n.read_at;
              return (
                <Box
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onItemClick(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onItemClick(n);
                  }}
                  sx={{
                    px: 2,
                    py: 1.5,
                    display: "flex",
                    gap: 1.5,
                    borderBottom: `1px solid ${LINE}`,
                    bgcolor: isUnread ? "#F9FAFB" : "transparent",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "#F3F4F6" },
                    "&:last-of-type": { borderBottom: 0 },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "6px",
                      bgcolor: isUnread ? "rgba(14,42,61,0.08)" : "#F3F4F6",
                      color: isUnread ? NAVY : MUTED,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 16 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" sx={{ alignItems: "baseline", gap: 1 }}>
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: isUnread ? 600 : 500,
                          color: INK,
                          flex: 1,
                          minWidth: 0,
                        }}
                        noWrap
                      >
                        {n.title}
                      </Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: MUTED, flexShrink: 0 }}>
                        {formatRelative(n.created_at)}
                      </Typography>
                    </Stack>
                    {n.body && (
                      <Typography
                        sx={{
                          fontSize: "0.8125rem",
                          color: MUTED,
                          mt: 0.25,
                          lineHeight: 1.45,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {n.body}
                      </Typography>
                    )}
                  </Box>
                  {isUnread && (
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: NAVY, flexShrink: 0, mt: 1.25 }} />
                  )}
                  {busyId === n.id && <CircularProgress size={12} sx={{ color: NAVY, mt: 1.25 }} />}
                </Box>
              );
            })
          )}
        </Box>
      </Popover>
    </>
  );
}
