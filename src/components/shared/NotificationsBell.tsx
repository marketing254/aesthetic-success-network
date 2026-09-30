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
  member: "New kits, company offers and replies to your questions will show up here.",
};

// Community palette (warm off-white, navy ink, gold highlight).
const NAVY = "#0A1320";
const INK = "#0A1320";
const MUTED = "#6B7280";
const LINE = "rgba(10,19,32,0.06)";
const LINE_STRONG = "rgba(10,19,32,0.14)";
const SAND = "#F3EBDD";
const SAND_SOFT = "#F8F4EC";
const GOLD = "#D9A84B";
const GOLD_TINT = "#FBF3E1";
const GOLD_TEXT = "#7A5B17";

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
  /**
   * "dark" for navy top bars (admin, member); "light" for white top bars;
   * "community" for the transparent community-portal top bar (36px white
   * circle with a 1px border).
   */
  tone?: "light" | "dark" | "community";
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

  const buttonSx =
    tone === "community"
      ? {
          width: 36,
          height: 36,
          borderRadius: "50%",
          bgcolor: "#FFFFFF",
          border: `1px solid ${open ? NAVY : LINE_STRONG}`,
          color: NAVY,
          boxShadow: "0 1px 2px rgba(10,19,32,0.04)",
          "&:hover": { bgcolor: SAND_SOFT, color: NAVY, borderColor: NAVY },
          "&:focus-visible": { outline: `2px solid ${NAVY}`, outlineOffset: 2 },
        }
      : {
          color: tone === "dark" ? "rgba(255,255,255,0.85)" : MUTED,
          borderRadius: "8px",
        };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          ref={anchorRef}
          size="small"
          onClick={() => setOpen((v) => !v)}
          sx={buttonSx}
          aria-label="Notifications"
        >
          <Badge
            badgeContent={unread > 0 ? unread : 0}
            invisible={unread === 0}
            overlap="circular"
            sx={{
              "& .MuiBadge-badge": {
                fontWeight: 700,
                fontSize: "0.625rem",
                minWidth: 16,
                height: 16,
                bgcolor: GOLD,
                color: INK,
                border: "2px solid #FFFFFF",
                top: -2,
                right: -2,
              },
            }}
          >
            {unread > 0 ? (
              <NotificationsActiveOutlinedIcon sx={{ fontSize: 19 }} />
            ) : (
              <NotificationsNoneOutlinedIcon sx={{ fontSize: 19 }} />
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
              width: { xs: "92vw", sm: 384 },
              maxHeight: 500,
              borderRadius: "16px",
              border: `1px solid ${LINE}`,
              boxShadow: "0 4px 12px rgba(10,19,32,0.06), 0 24px 48px -24px rgba(10,19,32,0.24)",
              backgroundImage: "none",
              overflow: "hidden",
            },
          },
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", px: 2.5, py: 1.75 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, letterSpacing: "-0.01em", color: INK }}>Notifications</Typography>
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
              fontWeight: 600,
              color: NAVY,
              borderRadius: "8px",
              minHeight: 32,
              "&:hover": { bgcolor: SAND, transform: "none" },
              "&.Mui-disabled": { color: "#9AA3AF" },
            }}
          >
            Mark all read
          </Button>
        </Stack>
        <Divider sx={{ borderColor: LINE }} />

        <Box sx={{ maxHeight: 410, overflowY: "auto" }}>
          {loading ? (
            <Stack sx={{ py: 4, alignItems: "center" }}>
              <CircularProgress size={20} sx={{ color: NAVY }} />
            </Stack>
          ) : rows.length === 0 ? (
            <Stack sx={{ py: 5, px: 3, alignItems: "center", textAlign: "center" }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  bgcolor: SAND,
                  color: "#B8862F",
                  display: "grid",
                  placeItems: "center",
                  mb: 1.5,
                }}
              >
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: INK, mb: 0.5 }}>
                No notifications yet
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: MUTED, maxWidth: 260, lineHeight: 1.55 }}>{EMPTY_COPY[audience]}</Typography>
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
                    px: 2.5,
                    py: 1.5,
                    display: "flex",
                    gap: 1.5,
                    borderBottom: `1px solid ${LINE}`,
                    bgcolor: isUnread ? SAND_SOFT : "transparent",
                    cursor: "pointer",
                    transition: "background-color 120ms ease",
                    "&:hover": { bgcolor: SAND },
                    "&:last-of-type": { borderBottom: 0 },
                    "&:focus-visible": { outline: `2px solid ${NAVY}`, outlineOffset: -2 },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      bgcolor: isUnread ? GOLD_TINT : "#F1EFEA",
                      color: isUnread ? GOLD_TEXT : MUTED,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 17 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" sx={{ alignItems: "baseline", gap: 1 }}>
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: isUnread ? 700 : 500,
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
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: GOLD, flexShrink: 0, mt: 1.5 }} />
                  )}
                  {busyId === n.id && <CircularProgress size={12} sx={{ color: NAVY, mt: 1.5 }} />}
                </Box>
              );
            })
          )}
        </Box>
      </Popover>
    </>
  );
}
