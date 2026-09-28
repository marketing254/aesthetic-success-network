"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type AuthorKind = "member" | "expert" | "partner" | "admin";

type Inquiry = {
  id: string;
  resource_id: string;
  resource_topic_slug: string | null;
  resource_topic_title: string | null;
  resource_title: string | null;
  originating_expert_name: string | null;
  author_auth_user_id: string;
  author_display_name: string;
  author_subtitle: string | null;
  body: string;
  reply_count: number;
  status: "open" | "answered" | "closed";
  created_at: string;
  updated_at: string;
};

type Reply = {
  id: string;
  inquiry_id: string;
  author_kind: AuthorKind;
  author_display_name: string;
  author_subtitle: string | null;
  body: string;
  created_at: string;
};

type StatusFilter = "all" | "open" | "answered" | "closed";

export default function AdminInquiriesPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/inquiries?status=${filter}&limit=200`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as {
        inquiries?: Inquiry[];
        error?: string;
      };
      if (!res.ok || body.error) {
        setError("Couldn't load inquiries. Please try again.");
        setRows([]);
        return;
      }
      setRows(body.inquiries ?? []);
      setError(null);
    } catch (err) {
      if (process.env.NODE_ENV !== "production")
        console.error("[admin:inquiries] load failed:", err);
      setError("Couldn't load inquiries. Please try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime — refresh when an inquiry or reply lands anywhere.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("admin-inquiries-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resource_inquiries" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resource_inquiry_replies" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const counts = {
    all: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    answered: rows.filter((r) => r.status === "answered").length,
    closed: rows.filter((r) => r.status === "closed").length,
  };

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="overline" sx={{ display: "block" }}>
          INQUIRIES
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          All member inquiries
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 720 }}>
          Every question a member posts under a resource shows up here.
          The originating expert is notified directly, but this view gives
          the team oversight across every thread. Reply inline to step in
          when an expert is unavailable.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={filter}
          onChange={(_, v) => setFilter(v as StatusFilter)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.95rem" },
            "& .Mui-selected": { color: "primary.main" },
            "& .MuiTabs-indicator": {
              backgroundColor: "secondary.main",
              height: 3,
              borderRadius: 999,
            },
          }}
        >
          {(["all", "open", "answered", "closed"] as StatusFilter[]).map((k) => (
            <Tab
              key={k}
              value={k}
              label={
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Box sx={{ textTransform: "capitalize" }}>
                    {k === "all" ? "All" : k}
                  </Box>
                  <Chip
                    size="small"
                    label={counts[k]}
                    sx={{
                      height: 20,
                      fontSize: "0.7rem",
                      bgcolor: filter === k ? "rgba(217,168,75,0.18)" : "grey.100",
                      color: filter === k ? "#A07823" : "text.secondary",
                      fontWeight: 700,
                    }}
                  />
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Box>

      <Box
        sx={{
          borderRadius: "18px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <Box sx={{ p: 6, display: "grid", placeItems: "center" }}>
            <CircularProgress size={24} sx={{ color: "#A07823" }} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: "rgba(217,168,75,0.16)",
                color: "#A07823",
                display: "grid",
                placeItems: "center",
                mx: "auto",
                mb: 2,
              }}
            >
              <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Typography sx={{ color: "text.secondary" }}>
              {filter === "all"
                ? "No inquiries yet."
                : `No ${filter} inquiries.`}
            </Typography>
          </Box>
        ) : (
          rows.map((inq, i) => (
            <InboxRow
              key={inq.id}
              inquiry={inq}
              expanded={expandedId === inq.id}
              onToggle={() =>
                setExpandedId((id) => (id === inq.id ? null : inq.id))
              }
              onReplied={() => void load()}
              divider={i < rows.length - 1}
            />
          ))
        )}
      </Box>
    </Stack>
  );
}

function InboxRow({
  inquiry,
  expanded,
  onToggle,
  onReplied,
  divider,
}: {
  inquiry: Inquiry;
  expanded: boolean;
  onToggle: () => void;
  onReplied: () => void;
  divider: boolean;
}) {
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const res = await fetch(
        `/api/resources/${inquiry.resource_id}/inquiries/${inquiry.id}/replies`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as { replies?: Reply[]; error?: string };
      if (!res.ok || body.error) {
        setError("Couldn't load the thread. Please try again.");
        return;
      }
      setReplies(body.replies ?? []);
      setError(null);
    } catch (err) {
      if (process.env.NODE_ENV !== "production")
        console.error("[admin:inquiries] replies load failed:", err);
      setError("Couldn't load the thread. Please try again.");
    } finally {
      setLoadingReplies(false);
    }
  }, [inquiry.resource_id, inquiry.id]);

  useEffect(() => {
    if (expanded && replies === null) void loadReplies();
  }, [expanded, replies, loadReplies]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/resources/${inquiry.resource_id}/inquiries/${inquiry.id}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        },
      );
      const body = (await res.json()) as {
        ok?: boolean;
        reply?: Reply;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.reply) {
        setError(
          body.error && res.status >= 400 && res.status < 500
            ? body.error
            : "Couldn't post that reply right now. Please try again.",
        );
        return;
      }
      setReplies((prev) => (prev ? [...prev, body.reply!] : [body.reply!]));
      setDraft("");
      onReplied();
    } catch (err) {
      if (process.env.NODE_ENV !== "production")
        console.error("[admin:inquiries] reply failed:", err);
      setError("Couldn't post that reply right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: expanded ? "grey.50" : "transparent",
        borderBottom: divider ? "1px solid" : "none",
        borderColor: "divider",
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          all: "unset",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 1.5,
          alignItems: "flex-start",
          px: { xs: 2, md: 3 },
          py: 2.5,
          cursor: "pointer",
          "&:hover": { bgcolor: "grey.50" },
          "&:focus-visible": {
            outline: "2px solid #A07823",
            outlineOffset: -2,
          },
        }}
      >
        <Avatar
          sx={{
            width: 38,
            height: 38,
            bgcolor: "rgba(217,168,75,0.16)",
            color: "#A07823",
            fontSize: "0.82rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials(inquiry.author_display_name)}
        </Avatar>
        <Box sx={{ minWidth: 0, textAlign: "left" }}>
          <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.25 }}>
            <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "text.primary", lineHeight: 1.2 }}>
              {inquiry.author_display_name}
            </Typography>
            <Typography sx={{ fontSize: "0.74rem", color: "text.secondary" }}>
              · {formatRelative(inquiry.created_at)}
            </Typography>
            <StatusChip status={inquiry.status} />
            {inquiry.originating_expert_name && (
              <Chip
                size="small"
                label={`Expert: ${inquiry.originating_expert_name}`}
                sx={{
                  height: 18,
                  fontSize: "0.62rem",
                  bgcolor: "rgba(34,108,78,0.10)",
                  color: "#1F5238",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  "& .MuiChip-label": { px: 0.75 },
                }}
              />
            )}
          </Stack>
          <Typography
            sx={{
              fontSize: "0.74rem",
              color: "text.secondary",
              lineHeight: 1.4,
              mb: 0.85,
            }}
          >
            {inquiry.resource_topic_title}
            {inquiry.resource_title ? ` · ${inquiry.resource_title}` : ""}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.92rem",
              color: "text.primary",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              ...(expanded
                ? {}
                : {
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }),
            }}
          >
            {inquiry.body}
          </Typography>
          <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", mt: 0.75 }}>
            {inquiry.reply_count === 0
              ? "No replies yet"
              : `${inquiry.reply_count} repl${inquiry.reply_count === 1 ? "y" : "ies"}`}
          </Typography>
        </Box>
        {inquiry.resource_topic_slug && (
          <Button
            component="a"
            href={`/dashboard/resources/${inquiry.resource_topic_slug}`}
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            size="small"
            endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.74rem",
              color: "text.secondary",
              minWidth: 0,
              "&:hover": { bgcolor: "rgba(14,42,61,0.04)" },
            }}
          >
            Open
          </Button>
        )}
      </Box>

      {expanded && (
        <Box sx={{ px: { xs: 2, md: 3 }, pb: 2.5, pt: 0.5 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Box
            sx={{
              borderLeft: "2px solid",
              borderColor: "divider",
              pl: { xs: 1.5, md: 2 },
              maxHeight: 380,
              overflowY: "auto",
              mb: 1.5,
            }}
          >
            {loadingReplies ? (
              <Stack sx={{ alignItems: "center", py: 2 }}>
                <CircularProgress size={18} sx={{ color: "#A07823" }} />
              </Stack>
            ) : (replies ?? []).length === 0 ? (
              <Typography
                sx={{
                  fontSize: "0.82rem",
                  color: "text.secondary",
                  py: 1.5,
                  textAlign: "center",
                }}
              >
                No replies yet. Yours can be the first.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {(replies ?? []).map((r) => (
                  <ReplyView key={r.id} reply={r} />
                ))}
              </Stack>
            )}
          </Box>
          <Stack spacing={1}>
            <TextField
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a reply. It lands with the Team chip and members see it on the resource page."
              multiline
              minRows={3}
              fullWidth
              slotProps={{ inputLabel: { shrink: false } }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: "0.92rem",
                  bgcolor: "common.white",
                },
              }}
            />
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button
                onClick={submit}
                disabled={submitting || draft.trim().length === 0}
                variant="contained"
                endIcon={
                  submitting ? (
                    <CircularProgress size={14} sx={{ color: "#FFFFFF" }} />
                  ) : (
                    <SendRoundedIcon sx={{ fontSize: 16 }} />
                  )
                }
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 999,
                  px: 2.5,
                  bgcolor: "#0E2A3D",
                  "&:hover": { bgcolor: "#1B4258" },
                }}
              >
                {submitting ? "Posting…" : "Post reply"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function ReplyView({ reply }: { reply: Reply }) {
  const tint = TINT_BY_KIND[reply.author_kind];
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
      <Avatar
        sx={{
          width: 30,
          height: 30,
          bgcolor: tint.bg,
          color: tint.color,
          fontSize: "0.7rem",
          fontWeight: 700,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {initials(reply.author_display_name)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography
            sx={{ fontSize: "0.82rem", fontWeight: 700, color: "text.primary", lineHeight: 1.2 }}
          >
            {reply.author_display_name}
          </Typography>
          <Chip
            label={tint.label}
            size="small"
            sx={{
              height: 16,
              bgcolor: tint.bg,
              color: tint.color,
              fontSize: "0.58rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              "& .MuiChip-label": { px: 0.7 },
            }}
          />
          <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
            · {formatRelative(reply.created_at)}
          </Typography>
        </Stack>
        <Typography
          sx={{
            mt: 0.5,
            fontSize: "0.88rem",
            color: "text.primary",
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {reply.body}
        </Typography>
      </Box>
    </Stack>
  );
}

const TINT_BY_KIND: Record<
  AuthorKind,
  { label: string; bg: string; color: string }
> = {
  member: { label: "Member", bg: "rgba(217,168,75,0.16)", color: "#A07823" },
  expert: { label: "Expert", bg: "rgba(34,108,78,0.14)", color: "#1F5238" },
  partner: { label: "Company", bg: "rgba(110,51,70,0.12)", color: "#6E3346" },
  admin: { label: "Team", bg: "rgba(14,42,61,0.10)", color: "#0A1320" },
};

function StatusChip({ status }: { status: Inquiry["status"] }) {
  const map: Record<Inquiry["status"], { label: string; bg: string; color: string }> = {
    open: { label: "Needs reply", bg: "rgba(217,168,75,0.16)", color: "#A07823" },
    answered: { label: "Answered", bg: "rgba(34,108,78,0.12)", color: "#1F5238" },
    closed: { label: "Closed", bg: "rgba(14,42,61,0.06)", color: "#7A8590" },
  };
  const m = map[status];
  return (
    <Chip
      label={m.label}
      size="small"
      sx={{
        bgcolor: m.bg,
        color: m.color,
        height: 18,
        fontSize: "0.62rem",
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        "& .MuiChip-label": { px: 0.75 },
      }}
    />
  );
}

function initials(name: string): string {
  const t = (name ?? "").trim();
  if (!t) return "··";
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
