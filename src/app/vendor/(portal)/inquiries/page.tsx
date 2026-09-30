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
  TextField,
  Typography,
} from "@mui/material";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { EmptyState, ListDivider, PageHeader, SectionCard, SegmentedFilter } from "@/components/vendor/PortalUI";
import { CP } from "@/components/shared/CommunityPortalShell";

const INK = CP.ink;
const BODY = CP.body;
const MUTED = CP.muted;
const LINE = CP.border;
const ROW_HOVER = CP.sandSoft;
const NAVY = CP.navy;

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

export default function VendorInquiriesPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/vendor/inquiries?status=${filter}&limit=100`,
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
      if (process.env.NODE_ENV !== "production")
        console.error("[vendor:inquiries] load failed:", err);
      setError("Couldn't load inquiries right now. Please try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refresh when an inquiry or reply lands.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("vendor-inquiries-inbox")
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
        subtitle="Every inquiry a member posts on a resource you published shows up here. Reply directly: the whole thread is visible to every member viewing that resource, so a good answer builds your reputation in the network."
      />

      <Box>
        <SegmentedFilter
          ariaLabel="Filter inquiries"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "All", count: counts.all },
            { key: "open", label: "Needs reply", count: counts.open },
            { key: "answered", label: "Answered", count: counts.answered },
          ]}
        />
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <SectionCard padding="none">
          <Stack sx={{ alignItems: "center", py: 6 }}>
            <CircularProgress size={24} />
          </Stack>
        </SectionCard>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ChatBubbleOutlineRoundedIcon}
          title={`No ${filter === "all" ? "" : filter + " "}inquiries yet`}
          body="When a member asks a question on one of the resources you published, it lands here. You'll also get a notification."
        />
      ) : (
        <SectionCard padding="none">
          <Stack divider={<ListDivider />}>
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
        </SectionCard>
      )}
    </Stack>
  );
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
      if (process.env.NODE_ENV !== "production")
        console.error("[vendor:inquiries] replies load failed:", err);
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
      if (process.env.NODE_ENV !== "production")
        console.error("[vendor:inquiries] reply failed:", err);
      setError("Couldn't post that reply right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ bgcolor: expanded ? ROW_HOVER : "transparent", transition: "background-color 120ms ease" }}>
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        sx={{
          all: "unset",
          boxSizing: "border-box",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 1.75,
          alignItems: "flex-start",
          px: 3,
          py: 2.25,
          cursor: "pointer",
          "&:hover": { bgcolor: ROW_HOVER },
          "&:focus-visible": {
            outline: `2px solid ${NAVY}`,
            outlineOffset: -2,
          },
        }}
      >
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: NAVY,
            color: CP.gold,
            fontSize: "0.75rem",
            fontWeight: 700,
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
                fontWeight: 700,
                color: INK,
                lineHeight: 1.3,
              }}
            >
              {inquiry.author_display_name}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>
              · {formatRelative(inquiry.created_at)}
            </Typography>
            <StatusChip status={inquiry.status} />
          </Stack>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: MUTED,
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
              color: BODY,
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
          <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 0.75 }}>
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
            variant="text"
            size="small"
            endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
            sx={{ minWidth: 0 }}
          >
            View
          </Button>
        )}
      </Box>

      {expanded && (
        <Box sx={{ px: 3, pb: 3, pt: 0.5 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Box
            sx={{
              borderLeft: `2px solid ${CP.gold}`,
              pl: 2.25,
              ml: 2.25,
              maxHeight: 380,
              overflowY: "auto",
              mb: 2,
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
                  color: MUTED,
                  py: 1.5,
                }}
              >
                No replies yet. Yours will be the first.
              </Typography>
            ) : (
              <Stack spacing={1.75}>
                {(replies ?? []).map((r) => (
                  <ReplyView key={r.id} reply={r} />
                ))}
              </Stack>
            )}
          </Box>
          <Stack spacing={1.25} sx={{ bgcolor: CP.white, border: `1px solid ${LINE}`, borderRadius: "12px", p: 1.5 }}>
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
                {submitting ? "Posting..." : "Post reply"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function ReplyView({ reply }: { reply: Reply }) {
  const isMine = reply.author_kind === "partner";
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
      <Avatar
        sx={{
          width: 30,
          height: 30,
          bgcolor: isMine ? NAVY : CP.neutralBg,
          color: isMine ? CP.gold : BODY,
          fontSize: "0.6875rem",
          fontWeight: 700,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {initials(reply.author_display_name)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography
            sx={{ fontSize: "0.8125rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}
          >
            {reply.author_display_name}
          </Typography>
          <Chip
            label={reply.author_kind === "partner" ? "Company" : capitalize(reply.author_kind)}
            size="small"
            color={isMine ? "secondary" : "default"}
          />
          <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>
            · {formatRelative(reply.created_at)}
          </Typography>
        </Stack>
        <Typography
          sx={{
            mt: 0.5,
            fontSize: "0.875rem",
            color: BODY,
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

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
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
