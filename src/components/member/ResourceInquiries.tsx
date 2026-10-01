"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Parse a JSON response defensively. If the body isn't JSON — e.g. the dev
 * server hands back an HTML 404/500 page — this returns null instead of
 * throwing the cryptic `Unexpected token '<'` SyntaxError, so callers can
 * fall through to their friendly error state.
 */
async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Brand palette — sticks with the resource-page editorial system.
const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const LINE = "#E6DDCF";
const LINE_SOFT = "#EFEAE0";
const GOLD = "#A07823";
const GOLD_SOFT = "rgba(217,168,75,0.16)";
const SURFACE = "#FFFFFF";
const SURFACE_SUNKEN = "#FBF8F1";
const EXPERT_GREEN = "#2C7A52";
const EXPERT_GREEN_TINT = "#E8F2EC";
const PARTNER_WINE = "#6E3346";
const PARTNER_WINE_TINT = "rgba(110,51,70,0.12)";

type AuthorKind = "member" | "expert" | "partner" | "admin";

type Inquiry = {
  id: string;
  resource_id: string;
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
  author_auth_user_id: string;
  author_display_name: string;
  author_subtitle: string | null;
  body: string;
  created_at: string;
};

type Viewer = { authUserId: string; kind: AuthorKind };

type Props = {
  resourceId: string;
  /** Optional readable title used in the empty-state copy. */
  resourceTitle?: string;
};

const PAGE_SIZE = 8;

export default function ResourceInquiries({ resourceId, resourceTitle }: Props) {
  // Open by default — the inquiry composer is the whole reason this
  // component exists. Hiding it behind a collapsed bar made it
  // unreachable for members who didn't notice the toggle. The thread
  // load happens lazily on first open (which fires immediately now via
  // the load effect below), so this doesn't cost us a flash of empty
  // state on a fresh page.
  const [open, setOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalKnown, setTotalKnown] = useState<number | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (opts?: { append?: boolean; before?: string | null }) => {
      if (opts?.append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (opts?.before) params.set("before", opts.before);
        const res = await fetch(
          `/api/resources/${resourceId}/inquiries?${params.toString()}`,
          { cache: "no-store" },
        );
        const body = await readJson<{
          inquiries?: Inquiry[];
          cursor?: string | null;
          viewer?: Viewer;
          error?: string;
        }>(res);
        if (!res.ok || !body || body.error) {
          setError("Couldn't load the thread right now. Please try again.");
          return;
        }
        if (body.viewer) setViewer(body.viewer);
        const fetched = body.inquiries ?? [];
        setInquiries((prev) =>
          opts?.append ? [...prev, ...fetched] : fetched,
        );
        setCursor(body.cursor ?? null);
        setError(null);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error("[inquiries] load failed:", err);
        setError("Couldn't load the thread right now. Please try again.");
      } finally {
        if (opts?.append) setLoadingMore(false);
        else {
          setLoading(false);
          setLoaded(true);
        }
      }
    },
    [resourceId],
  );

  // Lazy-fetch the inquiry list on first open. We default `open=true`,
  // so this effectively runs on mount.
  useEffect(() => {
    if (open && !loaded && !loading) void load();
  }, [open, loaded, loading, load]);

  // Header chevron toggle — collapse the thread but never close it
  // permanently. Composer stays mounted independently below.
  const onToggleOpen = () => {
    setOpen((v) => !v);
  };

  // Realtime — keep the inquiry list fresh while the panel is open.
  // Debounced via a tiny timer so a flurry of replies collapses to one
  // refresh of the visible list.
  const refreshTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`resource-inquiries:${resourceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resource_inquiries",
          filter: `resource_id=eq.${resourceId}`,
        },
        () => {
          if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
          refreshTimer.current = window.setTimeout(() => {
            refreshTimer.current = null;
            void load();
          }, 400);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resource_inquiry_replies",
        },
        () => {
          if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
          refreshTimer.current = window.setTimeout(() => {
            refreshTimer.current = null;
            void load();
          }, 400);
        },
      )
      .subscribe();
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [open, resourceId, load]);

  const onPostInquiry = async () => {
    const text = draft.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/resources/${resourceId}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const body = await readJson<{
        ok?: boolean;
        inquiry?: Inquiry;
        error?: string;
      }>(res);
      if (!res.ok || !body || !body.ok || !body.inquiry) {
        // Validation messages from the server (4xx) are user-friendly;
        // anything else collapses to the generic message.
        setError(
          body?.error && res.status >= 400 && res.status < 500
            ? body.error
            : "Couldn't post that right now. Please try again.",
        );
        return;
      }
      setInquiries((prev) => [body.inquiry!, ...prev]);
      setDraft("");
      setComposeOpen(false);
      setTotalKnown((t) => (typeof t === "number" ? t + 1 : null));
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[inquiries] post failed:", err);
      setError("Couldn't post that right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onInquiryDeleted = (inquiryId: string) => {
    setInquiries((prev) => prev.filter((i) => i.id !== inquiryId));
  };

  const onReplyAdded = (inquiryId: string) => {
    setInquiries((prev) =>
      prev.map((i) =>
        i.id === inquiryId
          ? { ...i, reply_count: i.reply_count + 1, status: i.status }
          : i,
      ),
    );
  };

  // Every signed-in viewer can ask a question — server-side identity
  // resolution stamps the right author_kind on the row so other readers
  // see who asked. (Used to be gated to members only; that made the
  // composer invisible to anyone testing as expert/partner/admin.)
  const inquiryCount = totalKnown ?? inquiries.length;
  void resourceTitle; // available if we want to embed it in copy later
  void viewer;        // surfaced for future per-kind affordances

  return (
    <Box
      sx={{
        mt: { xs: 4, lg: 5 },
        borderRadius: 3,
        border: `1px solid ${LINE}`,
        bgcolor: SURFACE,
        overflow: "hidden",
      }}
    >
      {/* Collapsed header / toggle */}
      <Box
        component="button"
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        sx={{
          all: "unset",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 1.5,
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 2.25 },
          cursor: "pointer",
          transition: "background-color 180ms ease",
          "&:hover": { bgcolor: SURFACE_SUNKEN },
          "&:focus-visible": {
            outline: `2px solid ${GOLD}`,
            outlineOffset: -2,
          },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            bgcolor: GOLD_SOFT,
            color: GOLD,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ textAlign: "left", minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.05rem", md: "1.15rem" },
              fontWeight: 600,
              color: INK,
              lineHeight: 1.25,
              letterSpacing: "-0.005em",
            }}
          >
            Ask a question about this kit
          </Typography>
          <Typography
            sx={{
              fontSize: "0.85rem",
              color: INK_MUTED,
              lineHeight: 1.45,
              mt: 0.25,
            }}
          >
            {inquiryCount > 0
              ? `${inquiryCount} inquir${inquiryCount === 1 ? "y" : "ies"} in this thread. The originating expert is notified the moment you post.`
              : "The originating expert is notified the moment you post."}
          </Typography>
        </Box>
        <IconButton
          size="small"
          component="span"
          sx={{ color: INK_MUTED, pointerEvents: "none" }}
        >
          {open ? <KeyboardArrowUpRoundedIcon /> : <KeyboardArrowDownRoundedIcon />}
        </IconButton>
      </Box>

      {/* Expanded body */}
      {open && (
        <Box sx={{ borderTop: `1px solid ${LINE_SOFT}` }}>
          {/* Composer — visible to every signed-in network participant.
              Server-side identity (resolveNetworkAuthor) decides the
              author_kind chip on the resulting row; clients can't spoof
              who they are. */}
          <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
            {!composeOpen ? (
              <Box
                component="button"
                type="button"
                onClick={() => setComposeOpen(true)}
                sx={{
                  all: "unset",
                  width: "100%",
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${LINE}`,
                  bgcolor: SURFACE_SUNKEN,
                  color: INK_MUTED,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  transition: "border-color 150ms ease, background-color 150ms ease",
                  "&:hover": {
                    borderColor: GOLD,
                    bgcolor: "rgba(217,168,75,0.06)",
                  },
                }}
              >
                Ask a question about this kit...
              </Box>
            ) : (
              <Stack spacing={1.5}>
                <TextField
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="What would you like to ask? Be specific: the originating expert is notified."
                  multiline
                  minRows={3}
                  fullWidth
                  autoFocus
                  slotProps={{ inputLabel: { shrink: false } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      fontSize: "0.92rem",
                      bgcolor: SURFACE,
                    },
                  }}
                />
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Button
                    onClick={() => {
                      setComposeOpen(false);
                      setDraft("");
                    }}
                    disabled={submitting}
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      color: INK_MUTED,
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onPostInquiry}
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
                      bgcolor: INK,
                      "&:hover": { bgcolor: "#1A3A4F" },
                    }}
                  >
                    {submitting ? "Posting…" : "Post inquiry"}
                  </Button>
                </Stack>
              </Stack>
            )}
          </Box>

          {error && (
            <Box sx={{ px: { xs: 2, md: 3 }, pt: 1.5 }}>
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            </Box>
          )}

          {/* Scrollable thread list — capped height so very long threads
              don't push the rest of the kit page out of view; users scroll
              within the panel. */}
          <Box
            sx={{
              maxHeight: { xs: 480, md: 560 },
              overflowY: "auto",
              borderTop: `1px solid ${LINE_SOFT}`,
            }}
          >
            {loading && inquiries.length === 0 ? (
              <Stack sx={{ alignItems: "center", py: 6 }}>
                <CircularProgress size={20} sx={{ color: GOLD }} />
              </Stack>
            ) : inquiries.length === 0 ? (
              <Box sx={{ p: { xs: 4, md: 5 }, textAlign: "center" }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    bgcolor: GOLD_SOFT,
                    color: GOLD,
                    display: "grid",
                    placeItems: "center",
                    mx: "auto",
                    mb: 1.5,
                  }}
                >
                  <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 22 }} />
                </Box>
                <Typography
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.05rem",
                    fontWeight: 500,
                    color: INK,
                    mb: 0.5,
                  }}
                >
                  No inquiries yet
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.88rem",
                    color: INK_MUTED,
                    maxWidth: 380,
                    mx: "auto",
                  }}
                >
                  Be the first to ask. The originating expert is notified the
                  moment you post.
                </Typography>
              </Box>
            ) : (
              <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE_SOFT}` }} />}>
                {inquiries.map((inq) => (
                  <InquiryRow
                    key={inq.id}
                    inquiry={inq}
                    resourceId={resourceId}
                    viewer={viewer}
                    onDeleted={() => onInquiryDeleted(inq.id)}
                    onReplyAdded={() => onReplyAdded(inq.id)}
                  />
                ))}
                {cursor && (
                  <Box sx={{ p: 2.5, textAlign: "center" }}>
                    <Button
                      onClick={() => load({ append: true, before: cursor })}
                      disabled={loadingMore}
                      variant="text"
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        color: INK_SOFT,
                        fontSize: "0.85rem",
                      }}
                    >
                      {loadingMore ? "Loading…" : "Show older inquiries"}
                    </Button>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────
// InquiryRow — one inquiry with its expandable reply thread.
// ──────────────────────────────────────────────────────────────────────

function InquiryRow({
  inquiry,
  resourceId,
  viewer,
  onDeleted,
  onReplyAdded,
}: {
  inquiry: Inquiry;
  resourceId: string;
  viewer: Viewer | null;
  onDeleted: () => void;
  onReplyAdded: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [composeReply, setComposeReply] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const res = await fetch(
        `/api/resources/${resourceId}/inquiries/${inquiry.id}/replies`,
        { cache: "no-store" },
      );
      const body = await readJson<{ replies?: Reply[]; error?: string }>(res);
      if (!res.ok || !body || body.error) {
        setError(body?.error ?? `Failed to load (${res.status})`);
        return;
      }
      setReplies(body.replies ?? []);
      setError(null);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[inquiries] replies load failed:", err);
      setError("Couldn't load replies. Please try again.");
    } finally {
      setLoadingReplies(false);
    }
  }, [resourceId, inquiry.id]);

  const onToggleExpanded = () => {
    setExpanded((v) => {
      const next = !v;
      if (next && replies === null) void loadReplies();
      return next;
    });
  };

  const postReply = async () => {
    const text = draft.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/resources/${resourceId}/inquiries/${inquiry.id}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        },
      );
      const body = await readJson<{
        ok?: boolean;
        reply?: Reply;
        error?: string;
      }>(res);
      if (!res.ok || !body || !body.ok || !body.reply) {
        // Validation messages from the server (4xx) are user-friendly;
        // anything else collapses to the generic message.
        setError(
          body?.error && res.status >= 400 && res.status < 500
            ? body.error
            : "Couldn't post that right now. Please try again.",
        );
        return;
      }
      setReplies((prev) => (prev ? [...prev, body.reply!] : [body.reply!]));
      setDraft("");
      setComposeReply(false);
      onReplyAdded();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[inquiries] post failed:", err);
      setError("Couldn't post that right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteInquiry = async () => {
    if (!confirm("Delete this inquiry? All replies are removed with it.")) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/resources/${resourceId}/inquiries?inquiry_id=${inquiry.id}`,
        { method: "DELETE" },
      );
      if (res.ok) onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  const isOwn = viewer?.authUserId === inquiry.author_auth_user_id;

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: GOLD_SOFT,
            color: GOLD,
            fontSize: "0.78rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials(inquiry.author_display_name)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={0.85}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography
              sx={{
                fontSize: "0.86rem",
                fontWeight: 700,
                color: INK,
                lineHeight: 1.2,
              }}
            >
              {inquiry.author_display_name}
            </Typography>
            <KindChip kind="member" />
            <Typography
              sx={{ fontSize: "0.72rem", color: INK_MUTED, lineHeight: 1.2 }}
            >
              · {formatRelative(inquiry.created_at)}
            </Typography>
            {inquiry.status === "answered" && (
              <Chip
                size="small"
                icon={<VerifiedOutlinedIcon sx={{ fontSize: 12 }} />}
                label="Expert answered"
                sx={{
                  height: 20,
                  bgcolor: EXPERT_GREEN_TINT,
                  color: EXPERT_GREEN,
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  "& .MuiChip-icon": { color: EXPERT_GREEN, ml: 0.5 },
                  "& .MuiChip-label": { px: 0.75 },
                }}
              />
            )}
          </Stack>
          {inquiry.author_subtitle && (
            <Typography
              sx={{
                fontSize: "0.72rem",
                color: INK_MUTED,
                lineHeight: 1.3,
                mt: 0.15,
              }}
            >
              {inquiry.author_subtitle}
            </Typography>
          )}
          <Typography
            sx={{
              mt: 0.85,
              fontSize: "0.92rem",
              color: INK_SOFT,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {inquiry.body}
          </Typography>

          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mt: 1.25, alignItems: "center", flexWrap: "wrap" }}
          >
            <Button
              size="small"
              onClick={onToggleExpanded}
              startIcon={<ChatBubbleOutlineRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.78rem",
                color: INK_SOFT,
                minWidth: 0,
                "&:hover": { bgcolor: "rgba(14,42,61,0.04)", color: INK },
              }}
            >
              {inquiry.reply_count === 0
                ? "No replies"
                : `${inquiry.reply_count} repl${inquiry.reply_count === 1 ? "y" : "ies"}`}
            </Button>
            <Button
              size="small"
              onClick={() => {
                setExpanded(true);
                if (replies === null) void loadReplies();
                setComposeReply(true);
              }}
              startIcon={<ReplyRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.78rem",
                color: INK_SOFT,
                minWidth: 0,
                "&:hover": { bgcolor: "rgba(14,42,61,0.04)", color: INK },
              }}
            >
              Reply
            </Button>
            {(isOwn || viewer?.kind === "admin") && (
              <Button
                size="small"
                onClick={deleteInquiry}
                disabled={deleting}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  color: INK_MUTED,
                  minWidth: 0,
                  "&:hover": { bgcolor: "rgba(14,42,61,0.04)", color: "#8C1D1D" },
                }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </Stack>

          {/* Reply thread */}
          {expanded && (
            <Box
              sx={{
                mt: 1.75,
                borderLeft: `2px solid ${LINE}`,
                pl: { xs: 1.5, md: 2 },
              }}
            >
              {error && (
                <Alert
                  severity="error"
                  sx={{ mb: 1.5 }}
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
              )}
              {loadingReplies ? (
                <Stack sx={{ alignItems: "center", py: 2 }}>
                  <CircularProgress size={18} sx={{ color: GOLD }} />
                </Stack>
              ) : (replies ?? []).length === 0 ? (
                <Typography
                  sx={{
                    fontSize: "0.82rem",
                    color: INK_MUTED,
                    py: 1,
                    textAlign: "center",
                  }}
                >
                  No replies yet. Be the first to weigh in.
                </Typography>
              ) : (
                <Stack spacing={1.5} sx={{ mb: composeReply ? 1.5 : 0 }}>
                  {(replies ?? []).map((r) => (
                    <ReplyRow key={r.id} reply={r} />
                  ))}
                </Stack>
              )}

              {composeReply ? (
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  <TextField
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a reply…"
                    multiline
                    minRows={2}
                    fullWidth
                    autoFocus
                    slotProps={{ inputLabel: { shrink: false } }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        fontSize: "0.88rem",
                        bgcolor: SURFACE,
                      },
                    }}
                  />
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: "flex-end" }}
                  >
                    <Button
                      onClick={() => {
                        setComposeReply(false);
                        setDraft("");
                      }}
                      disabled={submitting}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        color: INK_MUTED,
                        fontSize: "0.82rem",
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={postReply}
                      disabled={submitting || draft.trim().length === 0}
                      variant="contained"
                      size="small"
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: 999,
                        px: 2,
                        py: 0.5,
                        fontSize: "0.82rem",
                        bgcolor: INK,
                        "&:hover": { bgcolor: "#1A3A4F" },
                      }}
                    >
                      {submitting ? "Posting…" : "Post reply"}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Button
                  size="small"
                  onClick={() => setComposeReply(true)}
                  startIcon={<ReplyRoundedIcon sx={{ fontSize: 15 }} />}
                  sx={{
                    mt: 1.25,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    color: INK_SOFT,
                    "&:hover": { bgcolor: "rgba(14,42,61,0.04)", color: INK },
                  }}
                >
                  Reply to this inquiry
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function ReplyRow({ reply }: { reply: Reply }) {
  const kindMeta = META_BY_KIND[reply.author_kind];
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
      <Avatar
        sx={{
          width: 30,
          height: 30,
          bgcolor: kindMeta.tint,
          color: kindMeta.color,
          fontSize: "0.7rem",
          fontWeight: 700,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {initials(reply.author_display_name)}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Typography
            sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}
          >
            {reply.author_display_name}
          </Typography>
          <KindChip kind={reply.author_kind} />
          <Typography sx={{ fontSize: "0.7rem", color: INK_MUTED }}>
            · {formatRelative(reply.created_at)}
          </Typography>
        </Stack>
        {reply.author_subtitle && (
          <Typography
            sx={{ fontSize: "0.7rem", color: INK_MUTED, lineHeight: 1.3, mt: 0.1 }}
          >
            {reply.author_subtitle}
          </Typography>
        )}
        <Typography
          sx={{
            mt: 0.5,
            fontSize: "0.88rem",
            color: INK_SOFT,
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

const META_BY_KIND: Record<
  AuthorKind,
  { label: string; tint: string; color: string }
> = {
  member: { label: "Member", tint: GOLD_SOFT, color: GOLD },
  expert: { label: "Expert", tint: EXPERT_GREEN_TINT, color: EXPERT_GREEN },
  partner: { label: "Partner", tint: PARTNER_WINE_TINT, color: PARTNER_WINE },
  admin: { label: "Team", tint: "rgba(14,42,61,0.10)", color: INK },
};

function KindChip({ kind }: { kind: AuthorKind }) {
  const m = META_BY_KIND[kind];
  return (
    <Chip
      label={m.label}
      size="small"
      sx={{
        bgcolor: m.tint,
        color: m.color,
        fontWeight: 700,
        fontSize: "0.6rem",
        height: 16,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        "& .MuiChip-label": { px: 0.7 },
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
