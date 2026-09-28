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
import { EmptyState, PageHeader } from "@/components/vendor/PortalUI";

const INK = "#111827";
const INK_SOFT = "#374151";
const INK_MUTED = "#6B7280";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";
const NAVY_TINT = "rgba(14,42,61,0.08)";
const NEUTRAL_BG = "#F3F4F6";

type AuthorKind = "member" | "expert" | "partner" | "admin";

type Inquiry = {
  id: string;
  resource_id: string;
  resource_topic_slug: string | null;
  resource_topic_title: string | null;
  resource_title: string | null;
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

type StatusFilter = "all" | "open" | "answered";

export default function ExpertInquiriesPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/expert/inquiries?status=${filter}&limit=100`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as {
        inquiries?: Inquiry[];
        error?: string;
      };
      if (!res.ok || body.error) {
        setError("Couldn't load inquiries right now. Please try again.");
        setRows([]);
        return;
      }
      setRows(body.inquiries ?? []);
      setError(null);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[expert:inquiries] load failed:", err);
      setError("Couldn't load inquiries right now. Please try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime — refresh when an inquiry or reply lands.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("expert-inquiries-inbox")
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
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Inquiries"
        subtitle="Every inquiry a member posts on a resource you authored shows up here. Reply directly: the whole thread is visible to every member viewing that resource, so a good answer compounds."
      />

      <Box sx={{ borderBottom: `1px solid ${LINE}` }}>
        <Tabs value={filter} onChange={(_, v) => setFilter(v as StatusFilter)}>
          <Tab
            value="all"
            label={
              <Stack direction="row" spacing={0.85} sx={{ alignItems: "center" }}>
                <Box>All</Box>
                <CountChip count={counts.all} active={filter === "all"} />
              </Stack>
            }
          />
          <Tab
            value="open"
            label={
              <Stack direction="row" spacing={0.85} sx={{ alignItems: "center" }}>
                <Box>Needs reply</Box>
                <CountChip count={counts.open} active={filter === "open"} />
              </Stack>
            }
          />
          <Tab
            value="answered"
            label={
              <Stack direction="row" spacing={0.85} sx={{ alignItems: "center" }}>
                <Box>Answered</Box>
                <CountChip count={counts.answered} active={filter === "answered"} />
              </Stack>
            }
          />
        </Tabs>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={24} />
        </Stack>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ChatBubbleOutlineRoundedIcon}
          title={`No ${filter === "all" ? "" : filter + " "}inquiries yet`}
          body="When a member asks a question on one of your published resources, it lands here. You'll also get a notification."
        />
      ) : (
        <Box
          sx={{
            borderRadius: "8px",
            border: `1px solid ${LINE}`,
            bgcolor: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
            {rows.map((inq) => (
              <InboxRow
                key={inq.id}
                inquiry={inq}
                expanded={expandedId === inq.id}
                onToggle={() =>
                  setExpandedId((id) => (id === inq.id ? null : inq.id))
                }
                onReplied={() => void load()}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function CountChip({ count, active }: { count: number; active: boolean }) {
  return <Chip label={count} size="small" color={active ? "primary" : "default"} />;
}

function InboxRow({
  inquiry,
  expanded,
  onToggle,
  onReplied,
}: {
  inquiry: Inquiry;
  expanded: boolean;
  onToggle: () => void;
  onReplied: () => void;
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
      if (process.env.NODE_ENV !== "production") console.error("[expert:inquiries] replies load failed:", err);
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
        const safe =
          body.error && res.status >= 400 && res.status < 500
            ? body.error
            : "Couldn't post that reply right now. Please try again.";
        setError(safe);
        return;
      }
      setReplies((prev) => (prev ? [...prev, body.reply!] : [body.reply!]));
      setDraft("");
      onReplied();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[expert:inquiries] reply failed:", err);
      setError("Couldn't post that reply right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ bgcolor: expanded ? "#F9FAFB" : "transparent" }}>
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
          px: 3,
          py: 2,
          cursor: "pointer",
          "&:hover": { bgcolor: "#F9FAFB" },
          "&:focus-visible": {
            outline: `2px solid ${NAVY}`,
            outlineOffset: -2,
          },
        }}
      >
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: NAVY_TINT,
            color: NAVY,
            fontSize: "0.8125rem",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials(inquiry.author_display_name)}
        </Avatar>
        <Box sx={{ minWidth: 0, textAlign: "left" }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.25 }}>
            <Typography
              sx={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: INK,
                lineHeight: 1.3,
              }}
            >
              {inquiry.author_display_name}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: INK_MUTED }}>
              · {formatRelative(inquiry.created_at)}
            </Typography>
            <StatusChip status={inquiry.status} />
          </Stack>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: INK_MUTED,
              lineHeight: 1.4,
              mb: 0.75,
            }}
          >
            {inquiry.resource_topic_title}
            {inquiry.resource_title ? ` · ${inquiry.resource_title}` : ""}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: INK_SOFT,
              lineHeight: 1.6,
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
          <Typography sx={{ fontSize: "0.75rem", color: INK_MUTED, mt: 0.75 }}>
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
            variant="text"
            endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
            sx={{ minWidth: 0 }}
          >
            View
          </Button>
        )}
      </Box>

      {expanded && (
        <Box sx={{ px: 3, pb: 2.5, pt: 0.5 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Box
            sx={{
              borderLeft: `2px solid ${LINE}`,
              pl: { xs: 1.5, md: 2 },
              maxHeight: 380,
              overflowY: "auto",
              mb: 1.5,
            }}
          >
            {loadingReplies ? (
              <Stack sx={{ alignItems: "center", py: 2 }}>
                <CircularProgress size={24} />
              </Stack>
            ) : (replies ?? []).length === 0 ? (
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  color: INK_MUTED,
                  py: 1.5,
                  textAlign: "center",
                }}
              >
                No replies yet. Yours will be the first.
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
              placeholder="Write a reply. Members reading this resource will see your answer."
              multiline
              minRows={3}
              fullWidth
              slotProps={{ inputLabel: { shrink: false } }}
            />
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button
                onClick={submit}
                disabled={submitting || draft.trim().length === 0}
                variant="contained"
                endIcon={
                  submitting ? (
                    <CircularProgress size={14} sx={{ color: "inherit" }} />
                  ) : (
                    <SendRoundedIcon sx={{ fontSize: 16 }} />
                  )
                }
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
  const isMine = reply.author_kind === "expert";
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
      <Avatar
        sx={{
          width: 28,
          height: 28,
          bgcolor: isMine ? NAVY_TINT : NEUTRAL_BG,
          color: isMine ? NAVY : INK_SOFT,
          fontSize: "0.6875rem",
          fontWeight: 600,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {initials(reply.author_display_name)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography
            sx={{ fontSize: "0.8125rem", fontWeight: 600, color: INK, lineHeight: 1.3 }}
          >
            {reply.author_display_name}
          </Typography>
          <Chip label={reply.author_kind === "partner" ? "Company" : reply.author_kind.charAt(0).toUpperCase() + reply.author_kind.slice(1)} size="small" color={isMine ? "primary" : "default"} />
          <Typography sx={{ fontSize: "0.75rem", color: INK_MUTED }}>
            · {formatRelative(reply.created_at)}
          </Typography>
        </Stack>
        <Typography
          sx={{
            mt: 0.5,
            fontSize: "0.875rem",
            color: INK_SOFT,
            lineHeight: 1.6,
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

function StatusChip({ status }: { status: Inquiry["status"] }) {
  const map: Record<Inquiry["status"], { label: string; color: "warning" | "success" | "default" }> = {
    open: { label: "Needs reply", color: "warning" },
    answered: { label: "Answered", color: "success" },
    closed: { label: "Closed", color: "default" },
  };
  const m = map[status];
  return <Chip label={m.label} size="small" color={m.color} />;
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
