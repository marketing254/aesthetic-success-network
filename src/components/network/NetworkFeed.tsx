"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import RecommendOutlinedIcon from "@mui/icons-material/RecommendOutlined";
import RecommendRoundedIcon from "@mui/icons-material/RecommendRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import AddLinkRoundedIcon from "@mui/icons-material/AddLinkRounded";

// Tighter palette — neutral surface, green accent only for owner actions
// and the active reaction state. Visual language now mirrors a standard
// professional social network (LinkedIn-density).
const GREEN = "#2C7A52";
const GREEN_DARK = "#1F5238";
const GREEN_TINT = "#E8F2EC";
const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const LINE = "#E6DDCF";
const LINE_SOFT = "#EFEAE0";
const BG_SUNKEN = "#FBF8F1";

type ReactionKind = "heart" | "insightful" | "helpful" | "agree";
type AuthorKind = "expert" | "member" | "partner" | "admin";

type PreviewComment = {
  id: string;
  post_id: string;
  author_kind: AuthorKind;
  author_display_name: string;
  author_subtitle: string | null;
  content: string;
  created_at: string;
};

export type FeedPost = {
  id: string;
  expert_id: string | null;
  vendor_id: string | null;
  content: string;
  image_url: string | null;
  link_url: string | null;
  published_at: string | null;
  reaction_count: number;
  comment_count: number;
  created_at: string;
  author_kind: "expert" | "partner";
  author_display_name: string;
  author_subtitle: string | null;
  author_headshot_url: string | null;
  /** Link to the author's member-portal profile, or null. */
  profile_href: string | null;
  my_reaction: ReactionKind | null;
  preview_comments: PreviewComment[];
};

type ChatTarget = { expertId: string; expertName: string };

type Props = {
  onAskExpertBot?: (target: ChatTarget) => void;
  /** Hides the composer (used on member dashboard). Also disables post-delete UI. */
  hideComposer?: boolean;
  /** Page size — defaults to 20. Pass a smaller number for compact embeds. */
  limit?: number;
  /** Hides the "Show older posts" pagination control (compact embeds). */
  hidePagination?: boolean;
};

export default function NetworkFeed({
  onAskExpertBot,
  hideComposer,
  limit = 20,
  hidePagination = false,
}: Props) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (opts?: { append?: boolean; before?: string | null }) => {
    if (!opts?.append) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (opts?.before) params.set("before", opts.before);
      const res = await fetch(`/api/network/feed?${params.toString()}`, { cache: "no-store" });
      const body = (await res.json()) as { posts?: FeedPost[]; cursor?: string | null; error?: string };
      if (!res.ok || body.error) {
        // Show a generic message. The server-side error (with the
        // route + status) is already in the server log; the browser
        // doesn't need to repeat it.
        setError("Couldn't load the feed right now. Please refresh.");
        if (!opts?.append) setPosts([]);
        return;
      }
      const fetched = body.posts ?? [];
      setPosts((prev) => (opts?.append ? [...prev, ...fetched] : fetched));
      setCursor(body.cursor ?? null);
      setError(null);
    } catch (err) {
      // Network/JS error — keep specific detail in dev console only.
      if (process.env.NODE_ENV !== "production") console.error("[feed] load failed:", err);
      setError("Couldn't load the feed right now. Please refresh.");
    } finally {
      if (!opts?.append) setLoading(false);
      else setLoadingMore(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  // ──────────────────────────────────────────────────────────────────
  // Realtime — subscribe to expert_posts / post_reactions / post_comments
  // and refresh the feed on any change. Debounced so a flurry of edits
  // (e.g. a comment thread firing multiple INSERTs) collapses into one
  // network call. Falls back gracefully if Realtime is not configured
  // for these tables (the channel just never receives events).
  // ──────────────────────────────────────────────────────────────────
  const refreshTimer = useRef<number | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      void load();
    }, 350);
  }, [load]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("network-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expert_posts" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_reactions" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        scheduleRefresh,
      )
      .subscribe();
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh]);

  const onReact = useCallback(
    async (postId: string, kind: ReactionKind) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const wasMine = p.my_reaction === kind;
          const had = p.my_reaction !== null;
          const reactionDelta = wasMine ? -1 : had ? 0 : +1;
          return {
            ...p,
            my_reaction: wasMine ? null : kind,
            reaction_count: Math.max(0, p.reaction_count + reactionDelta),
          };
        }),
      );
      try {
        const res = await fetch(`/api/network/posts/${postId}/react`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
        });
        if (!res.ok) await load();
      } catch {
        await load();
      }
    },
    [load],
  );

  const onCommented = useCallback((postId: string, newComment: PreviewComment) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comment_count: p.comment_count + 1,
              preview_comments: [...p.preview_comments, newComment].slice(-3),
            }
          : p,
      ),
    );
  }, []);

  const onPostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return (
    <Stack spacing={1.5}>
      {!hideComposer && <Composer onPosted={() => load()} />}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={22} sx={{ color: GREEN }} />
        </Stack>
      ) : posts.length === 0 ? (
        <EmptyFeed />
      ) : (
        <Stack spacing={1.5}>
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onReact={onReact}
              onCommented={onCommented}
              onAskExpertBot={onAskExpertBot}
              onPostDeleted={hideComposer ? undefined : onPostDeleted}
            />
          ))}
          {cursor && !hidePagination && (
            <Stack sx={{ alignItems: "center", pt: 1 }}>
              <Button
                onClick={() => load({ append: true, before: cursor })}
                disabled={loadingMore}
                variant="text"
                size="small"
                sx={{ color: INK_MUTED, fontWeight: 600, textTransform: "none" }}
              >
                {loadingMore ? "Loading…" : "Show older posts"}
              </Button>
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
}

// ──────────────────────────────────────────────────────────────────────
// COMPOSER
// ──────────────────────────────────────────────────────────────────────

function Composer({ onPosted }: { onPosted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setContent("");
    setLinkUrl("");
    setShowLink(false);
    setExpanded(false);
    setError(null);
  };

  const submit = async (draft = false) => {
    setError(null);
    if (content.trim().length === 0) {
      setError("Write something first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/expert/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          link_url: linkUrl.trim() || undefined,
          draft,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        // 400/422 errors from the server are user-friendly already; trust
        // them. Everything else collapses to the generic "try again".
        const safe =
          body.error && res.status >= 400 && res.status < 500
            ? body.error
            : "Couldn't publish that post. Please try again.";
        setError(safe);
        return;
      }
      reset();
      onPosted();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[feed] publish failed:", err);
      setError("Couldn't publish that post. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <Box
        onClick={() => setExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded(true);
        }}
        sx={{
          px: 2,
          py: 1.5,
          borderRadius: 2,
          border: `1px solid ${LINE}`,
          bgcolor: "#FFFFFF",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          transition: "border-color 150ms ease, background-color 150ms ease",
          "&:hover, &:focus": { borderColor: GREEN, bgcolor: BG_SUNKEN, outline: "none" },
        }}
      >
        <Box
          sx={{
            flex: 1,
            color: INK_MUTED,
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          Share an update with the network…
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
      }}
    >
      <TextField
        value={content}
        onChange={(e) => setContent(e.target.value)}
        multiline
        minRows={3}
        fullWidth
        autoFocus
        placeholder="A quick take, a takeaway, a question for the network…"
        size="small"
        slotProps={{ inputLabel: { shrink: false } }}
        sx={{
          "& .MuiOutlinedInput-root": {
            fontSize: "0.92rem",
            bgcolor: "#FFFFFF",
          },
        }}
      />
      {showLink && (
        <TextField
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          fullWidth
          size="small"
          placeholder="https://link.to/article"
          sx={{ mt: 1, "& .MuiOutlinedInput-root": { fontSize: "0.88rem" } }}
          slotProps={{ inputLabel: { shrink: false } }}
        />
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1, py: 0.25 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Stack direction="row" sx={{ mt: 1.25, alignItems: "center", gap: 0.5 }}>
        <Tooltip title={showLink ? "Remove link" : "Add link"}>
          <IconButton
            size="small"
            onClick={() => setShowLink((s) => !s)}
            sx={{
              color: showLink ? GREEN_DARK : INK_MUTED,
              bgcolor: showLink ? GREEN_TINT : "transparent",
              "&:hover": { bgcolor: showLink ? `${GREEN}22` : "rgba(14,42,61,0.04)" },
            }}
          >
            <AddLinkRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          onClick={reset}
          disabled={busy}
          sx={{ color: INK_MUTED, fontWeight: 600, textTransform: "none", fontSize: "0.82rem" }}
        >
          Cancel
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => submit(true)}
          disabled={busy || content.trim().length === 0}
          sx={{ color: INK_SOFT, fontWeight: 600, textTransform: "none", fontSize: "0.82rem" }}
        >
          Draft
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={() => submit(false)}
          disabled={busy || content.trim().length === 0}
          endIcon={
            busy ? (
              <CircularProgress size={12} sx={{ color: "#FFFFFF" }} />
            ) : (
              <SendRoundedIcon sx={{ fontSize: 14 }} />
            )
          }
          sx={{
            borderRadius: 999,
            px: 2,
            py: 0.5,
            fontSize: "0.82rem",
            bgcolor: GREEN,
            color: "#FFFFFF",
            backgroundImage: `linear-gradient(180deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
            textTransform: "none",
            "&:hover": {
              bgcolor: GREEN_DARK,
              backgroundImage: `linear-gradient(180deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
            },
          }}
        >
          {busy ? "Posting…" : "Post"}
        </Button>
      </Stack>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────
// POST CARD
// ──────────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onReact,
  onCommented,
  onAskExpertBot,
  onPostDeleted,
}: {
  post: FeedPost;
  onReact: (postId: string, kind: ReactionKind) => void;
  onCommented: (postId: string, c: PreviewComment) => void;
  onAskExpertBot?: (t: ChatTarget) => void;
  onPostDeleted?: (postId: string) => void;
}) {
  // Comment thread state. We keep `fullComments` separate from
  // `post.preview_comments` so we always have a render target, even
  // before the full thread has been fetched.
  const [fullComments, setFullComments] = useState<PreviewComment[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [viewerAuthId, setViewerAuthId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFullThread = useCallback(async () => {
    const res = await fetch(`/api/network/posts/${post.id}/comments`, { cache: "no-store" });
    const body = (await res.json()) as {
      comments?: PreviewComment[];
      viewer?: { authUserId: string };
    };
    setFullComments(body.comments ?? []);
    setViewerAuthId(body.viewer?.authUserId ?? null);
    return body.comments ?? [];
  }, [post.id]);

  const onExpandComments = async () => {
    if (!expanded && !fullComments) {
      await fetchFullThread();
    }
    setExpanded((e) => !e);
  };

  const onStartComposing = async () => {
    // Pre-fetch the thread so when the new comment lands we have a place
    // to render it without an empty-array flash.
    if (!fullComments) await fetchFullThread();
    setComposing(true);
    setExpanded(true);
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/network/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const body = (await res.json()) as { ok?: boolean; comment?: PreviewComment; error?: string };
      if (!res.ok || !body.ok || !body.comment) return;
      onCommented(post.id, body.comment);
      // Always append into fullComments so the thread renders the new one
      // immediately. If fullComments was null, seed it from preview + new.
      setFullComments((prev) =>
        prev === null
          ? [...post.preview_comments, body.comment!]
          : [...prev, body.comment!],
      );
      setCommentText("");
      setComposing(false);
      setExpanded(true);
    } finally {
      setPosting(false);
    }
  };

  const deletePost = async () => {
    if (!onPostDeleted) return;
    setMenuAnchor(null);
    if (!confirm("Delete this post?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/expert/posts?id=${encodeURIComponent(post.id)}`, {
        method: "DELETE",
      });
      if (res.ok) onPostDeleted(post.id);
    } finally {
      setDeleting(false);
    }
  };

  // The thread we actually render: fullComments if loaded, preview otherwise.
  // Comments are HIDDEN by default — only render the thread when the user
  // has explicitly expanded it (clicked the comment count, the Comment
  // button, or the "View N comments" link). This matches how every
  // mainstream social feed handles inline comments: read-on-demand.
  const sourceComments = fullComments ?? post.preview_comments ?? [];
  const renderedComments = expanded ? sourceComments : [];

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
      }}
    >
      {/* Header */}
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start", px: 1.75, pt: 1.5 }}>
        <Avatar
          {...(post.profile_href ? { component: Link, href: post.profile_href } : {})}
          src={post.author_headshot_url ?? undefined}
          sx={{
            width: 36,
            height: 36,
            bgcolor: GREEN_TINT,
            color: GREEN,
            fontWeight: 700,
            fontSize: "0.8rem",
            border: `1px solid ${GREEN}22`,
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          {initials(post.author_display_name)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.6} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography
              {...(post.profile_href ? { component: Link, href: post.profile_href } : {})}
              sx={{ fontWeight: 700, color: INK, fontSize: "0.84rem", lineHeight: 1.2, textDecoration: "none", "&:hover": post.profile_href ? { color: GREEN_DARK } : {} }}
            >
              {post.author_display_name}
            </Typography>
            <KindChip kind={post.author_kind} />
          </Stack>
          <Typography sx={{ fontSize: "0.72rem", color: INK_MUTED, lineHeight: 1.35, mt: 0.1 }}>
            {post.author_subtitle ? `${post.author_subtitle} · ` : ""}
            {formatRelativeDate(post.published_at ?? post.created_at)}
          </Typography>
        </Box>
        {onPostDeleted && (
          <>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              disabled={deleting}
              sx={{ color: INK_MUTED, mt: -0.5, mr: -0.5 }}
            >
              {deleting ? (
                <CircularProgress size={14} />
              ) : (
                <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
            <Menu
              open={!!menuAnchor}
              anchorEl={menuAnchor}
              onClose={() => setMenuAnchor(null)}
              slotProps={{
                paper: { sx: { borderRadius: 2, border: `1px solid ${LINE}`, minWidth: 150 } },
              }}
            >
              <MenuItem onClick={deletePost} sx={{ color: "error.main", fontSize: "0.85rem", fontWeight: 600 }}>
                Delete post
              </MenuItem>
            </Menu>
          </>
        )}
      </Stack>

      {/* Body */}
      <Box sx={{ px: 1.75, pt: 1, pb: 0.75 }}>
        <Typography
          sx={{
            fontSize: "0.88rem",
            color: INK,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {post.content}
        </Typography>

        {post.link_url && (
          <Box
            component="a"
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              mt: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.4,
              px: 1.25,
              py: 0.4,
              borderRadius: 999,
              bgcolor: GREEN_TINT,
              color: GREEN_DARK,
              fontSize: "0.74rem",
              fontWeight: 600,
              textDecoration: "none",
              "&:hover": { bgcolor: `${GREEN}22` },
            }}
          >
            {prettyDomain(post.link_url)}
            <OpenInNewRoundedIcon sx={{ fontSize: 11 }} />
          </Box>
        )}
      </Box>

      {/* Engagement counts (subtle, between body and actions) */}
      {(post.reaction_count > 0 || post.comment_count > 0) && (
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            px: 1.75,
            pb: 0.5,
            color: INK_MUTED,
            fontSize: "0.72rem",
            alignItems: "center",
          }}
        >
          {post.reaction_count > 0 && (
            <ReactorTooltip postId={post.id} count={post.reaction_count}>
              <Stack
                direction="row"
                spacing={0.4}
                sx={{
                  alignItems: "center",
                  cursor: "default",
                  "&:hover": { color: INK_SOFT },
                }}
              >
                <FavoriteRoundedIcon sx={{ fontSize: 11, color: GREEN }} />
                <Box>{post.reaction_count}</Box>
              </Stack>
            </ReactorTooltip>
          )}
          {post.reaction_count > 0 && post.comment_count > 0 && (
            <Box sx={{ width: 2, height: 2, borderRadius: "50%", bgcolor: INK_MUTED }} />
          )}
          {post.comment_count > 0 && (
            <Box
              component="button"
              onClick={onExpandComments}
              sx={{
                background: "none",
                border: 0,
                cursor: "pointer",
                p: 0,
                color: INK_MUTED,
                fontSize: "0.72rem",
                fontFamily: "inherit",
                "&:hover": { color: INK_SOFT, textDecoration: "underline" },
              }}
            >
              {post.comment_count} comment{post.comment_count === 1 ? "" : "s"}
            </Box>
          )}
        </Stack>
      )}

      {/* Action bar — equal-width columns, no internal dividers (LinkedIn-style) */}
      <Box
        sx={{
          borderTop: `1px solid ${LINE_SOFT}`,
          display: "flex",
          alignItems: "stretch",
          px: 0.5,
          py: 0.25,
        }}
      >
        <Box sx={{ flex: 1, display: "flex" }}>
          <ReactionGroup
            myReaction={post.my_reaction}
            onReact={(k) => onReact(post.id, k)}
          />
        </Box>
        <Box sx={{ flex: 1, display: "flex" }}>
          <ActionButton
            icon={ChatBubbleOutlineRoundedIcon}
            label="Comment"
            onClick={onStartComposing}
          />
        </Box>
        {onAskExpertBot && (
          <Box sx={{ flex: 1, display: "flex" }}>
            {/* "Ask AI" is shipping later — the button stays visible so
                members know it's planned, but it's disabled with a
                "Soon" pill so they don't expect an answer today. The
                Tooltip explains what's coming when they hover. */}
            <Tooltip
              title="Per-expert AI helper grounded in their resources, shipping in a later release."
              placement="top"
              arrow
            >
              <Box
                component="span"
                sx={{ flex: 1, display: "flex", cursor: "not-allowed" }}
              >
                <Box
                  component="button"
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-label="Ask AI, coming soon"
                  sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.65,
                    px: 1.25,
                    py: 0.85,
                    bgcolor: "transparent",
                    border: 0,
                    borderRadius: 1.5,
                    cursor: "not-allowed",
                    color: INK_MUTED,
                    fontFamily: "inherit",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    opacity: 0.6,
                    pointerEvents: "none",
                  }}
                >
                  <SmartToyOutlinedIcon sx={{ fontSize: 16 }} />
                  <Box sx={{ display: { xs: "none", sm: "inline" } }}>Ask AI</Box>
                  <Box
                    component="span"
                    sx={{
                      ml: 0.5,
                      px: 0.6,
                      py: 0.05,
                      borderRadius: 999,
                      bgcolor: "rgba(217,168,75,0.16)",
                      color: "#A07823",
                      fontSize: "0.58rem",
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      lineHeight: 1.6,
                    }}
                  >
                    Soon
                  </Box>
                </Box>
              </Box>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Comments thread — rendered only when expanded or composing */}
      {(expanded || composing) && (
        <Box sx={{ borderTop: `1px solid ${LINE_SOFT}`, bgcolor: BG_SUNKEN, px: 2, py: 1.5 }}>
          {expanded && renderedComments.length > 0 && (
            <Stack spacing={1}>
              {renderedComments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  viewerCanDelete={
                    viewerAuthId !== null && c.id !== undefined && fullComments !== null
                  }
                  isOwn={viewerAuthId !== null && c.author_kind === "expert"}
                  postId={post.id}
                  onDeleted={() =>
                    setFullComments((prev) => prev?.filter((x) => x.id !== c.id) ?? null)
                  }
                />
              ))}
              <Button
                variant="text"
                size="small"
                onClick={() => setExpanded(false)}
                sx={{
                  alignSelf: "flex-start",
                  color: INK_MUTED,
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  textTransform: "none",
                  px: 0.5,
                }}
              >
                Hide comments
              </Button>
            </Stack>
          )}
          {expanded && renderedComments.length === 0 && !composing && (
            <Typography
              sx={{
                fontSize: "0.82rem",
                color: INK_MUTED,
                textAlign: "center",
                py: 1.5,
              }}
            >
              No comments yet. Be the first.
            </Typography>
          )}

          {composing && (
            <Box sx={{ mt: renderedComments.length > 0 ? 1.25 : 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
                <TextField
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment…"
                  fullWidth
                  multiline
                  maxRows={4}
                  size="small"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submitComment();
                    }
                  }}
                  slotProps={{ inputLabel: { shrink: false } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      fontSize: "0.86rem",
                      bgcolor: "#FFFFFF",
                      borderRadius: 999,
                      px: 1.5,
                    },
                  }}
                />
                <IconButton
                  size="small"
                  onClick={submitComment}
                  disabled={posting || !commentText.trim()}
                  sx={{
                    bgcolor: GREEN,
                    color: "#FFFFFF",
                    width: 34,
                    height: 34,
                    "&:hover": { bgcolor: GREEN_DARK },
                    "&.Mui-disabled": { bgcolor: "rgba(14,42,61,0.12)", color: "rgba(14,42,61,0.4)" },
                  }}
                >
                  {posting ? (
                    <CircularProgress size={14} sx={{ color: "#FFFFFF" }} />
                  ) : (
                    <SendRoundedIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Stack>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────
// ReactionGroup — single Like-style button + a hover-strip of 4 kinds
// ──────────────────────────────────────────────────────────────────────

const REACTION_META: Record<
  ReactionKind,
  { label: string; icon: React.ElementType<{ sx?: object }>; activeIcon: React.ElementType<{ sx?: object }> }
> = {
  heart: { label: "Heart", icon: FavoriteBorderRoundedIcon, activeIcon: FavoriteRoundedIcon },
  insightful: { label: "Insightful", icon: LightbulbOutlinedIcon, activeIcon: LightbulbRoundedIcon },
  helpful: { label: "Helpful", icon: HandshakeOutlinedIcon, activeIcon: HandshakeRoundedIcon },
  agree: { label: "Agree", icon: RecommendOutlinedIcon, activeIcon: RecommendRoundedIcon },
};

function ReactionGroup({
  myReaction,
  onReact,
}: {
  myReaction: ReactionKind | null;
  onReact: (kind: ReactionKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const active = myReaction ?? "heart";
  const meta = REACTION_META[active];
  const Icon = myReaction ? meta.activeIcon : meta.icon;

  const handleEnter = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const handleLeave = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  };

  return (
    <Box
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      sx={{ position: "relative", flex: 1, display: "flex" }}
    >
      <ActionButton
        icon={Icon}
        label={myReaction ? meta.label : "React"}
        onClick={() => onReact(active)}
        active={!!myReaction}
      />
      {open && (
        <Box
          sx={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            display: "flex",
            gap: 0.25,
            px: 0.5,
            py: 0.5,
            borderRadius: 999,
            bgcolor: "#FFFFFF",
            border: `1px solid ${LINE}`,
            boxShadow: "0 8px 24px -10px rgba(14,42,61,0.18)",
            zIndex: 5,
          }}
        >
          {(Object.keys(REACTION_META) as ReactionKind[]).map((k) => {
            const m = REACTION_META[k];
            const isActive = myReaction === k;
            const RIcon = isActive ? m.activeIcon : m.icon;
            return (
              <Tooltip key={k} title={m.label}>
                <IconButton
                  size="small"
                  onClick={() => {
                    onReact(k);
                    setOpen(false);
                  }}
                  sx={{
                    color: isActive ? GREEN : INK_MUTED,
                    transition: "all 150ms ease",
                    "&:hover": { transform: "scale(1.15)", color: GREEN, bgcolor: GREEN_TINT },
                  }}
                >
                  <RIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ElementType<{ sx?: object }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.65,
        px: 1.25,
        py: 0.85,
        bgcolor: "transparent",
        border: 0,
        borderRadius: 1.5,
        cursor: "pointer",
        color: active ? GREEN : INK_MUTED,
        fontFamily: "inherit",
        fontSize: "0.78rem",
        fontWeight: 600,
        transition: "background-color 150ms ease, color 150ms ease",
        "&:hover": { bgcolor: "rgba(14,42,61,0.04)", color: active ? GREEN_DARK : INK_SOFT },
      }}
    >
      <Icon sx={{ fontSize: 16 }} />
      <Box sx={{ display: { xs: "none", sm: "inline" } }}>{label}</Box>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────
// CommentRow — tighter, indented under the post
// ──────────────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  postId,
  isOwn: _isOwn,
  viewerCanDelete,
  onDeleted,
}: {
  comment: PreviewComment;
  postId: string;
  isOwn?: boolean;
  viewerCanDelete: boolean;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);

  const onDelete = async () => {
    setMenuAnchor(null);
    if (!confirm("Delete this comment?")) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/network/posts/${postId}/comments?comment_id=${comment.id}`,
        { method: "DELETE" },
      );
      if (res.ok) onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Avatar
        sx={{
          width: 28,
          height: 28,
          bgcolor: avatarBgForKind(comment.author_kind),
          color: avatarFgForKind(comment.author_kind),
          fontSize: "0.66rem",
          fontWeight: 700,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {initials(comment.author_display_name)}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            display: "inline-block",
            px: 1.25,
            py: 0.75,
            borderRadius: 2,
            bgcolor: "#FFFFFF",
            border: `1px solid ${LINE_SOFT}`,
            maxWidth: "100%",
          }}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.25 }}>
            <Typography sx={{ fontWeight: 700, color: INK, fontSize: "0.78rem", lineHeight: 1.3 }}>
              {comment.author_display_name}
            </Typography>
            <KindChip kind={comment.author_kind} small />
            {comment.author_subtitle && (
              <Typography sx={{ fontSize: "0.68rem", color: INK_MUTED }}>
                · {comment.author_subtitle}
              </Typography>
            )}
          </Stack>
          <Typography
            sx={{
              fontSize: "0.85rem",
              color: INK_SOFT,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {comment.content}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 0.4, alignItems: "center", pl: 1.25 }}>
          <Typography sx={{ fontSize: "0.68rem", color: INK_MUTED }}>
            {formatRelativeDate(comment.created_at)}
          </Typography>
          {viewerCanDelete && (
            <>
              <Box
                component="button"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                disabled={deleting}
                sx={{
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  p: 0,
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  color: INK_MUTED,
                  fontFamily: "inherit",
                  "&:hover": { color: INK_SOFT },
                }}
              >
                {deleting ? "Deleting…" : "More"}
              </Box>
              <Menu
                open={!!menuAnchor}
                anchorEl={menuAnchor}
                onClose={() => setMenuAnchor(null)}
                slotProps={{
                  paper: { sx: { borderRadius: 2, border: `1px solid ${LINE}`, minWidth: 140 } },
                }}
              >
                <MenuItem onClick={onDelete} sx={{ color: "error.main", fontSize: "0.82rem", fontWeight: 600 }}>
                  Delete comment
                </MenuItem>
              </Menu>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

function KindChip({ kind, small }: { kind: AuthorKind; small?: boolean }) {
  const map: Record<AuthorKind, { label: string; bg: string; color: string }> = {
    expert: { label: "Expert", bg: GREEN_TINT, color: GREEN_DARK },
    partner: { label: "Partner", bg: "rgba(110,51,70,0.12)", color: "#6E3346" },
    member: { label: "Member", bg: "rgba(217,168,75,0.16)", color: "#A07823" },
    admin: { label: "Admin", bg: "rgba(14,42,61,0.10)", color: INK },
  };
  const m = map[kind];
  return (
    <Chip
      label={m.label}
      size="small"
      sx={{
        bgcolor: m.bg,
        color: m.color,
        fontWeight: 700,
        fontSize: small ? "0.56rem" : "0.6rem",
        height: small ? 14 : 16,
        letterSpacing: "0.04em",
        "& .MuiChip-label": { px: small ? 0.55 : 0.7 },
      }}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────
// ReactorTooltip — wraps the reaction count and, on hover, shows a small
// floating chip listing who reacted. Data is fetched lazily the first
// time the user hovers; subsequent hovers reuse the cached list. Stays
// silent if the post has zero reactions or the API fails — the count
// chip on its own remains a valid display.
// ──────────────────────────────────────────────────────────────────────

type Reactor = {
  kind: ReactionKind;
  author_kind: AuthorKind;
  author_display_name: string;
  reacted_at: string;
};

function ReactorTooltip({
  postId,
  count,
  children,
}: {
  postId: string;
  count: number;
  children: React.ReactElement;
}) {
  const [reactors, setReactors] = useState<Reactor[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (reactors !== null || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/network/posts/${postId}/reactors`, {
        cache: "no-store",
      });
      const body = (await res.json()) as { reactors?: Reactor[] };
      setReactors(body.reactors ?? []);
    } catch {
      setReactors([]);
    } finally {
      setLoading(false);
    }
  }, [postId, reactors, loading]);

  const title = (
    <Box sx={{ minWidth: 180, maxWidth: 240, py: 0.5 }}>
      {reactors === null ? (
        <Typography sx={{ fontSize: "0.72rem", color: "#FFFFFF", opacity: 0.85 }}>
          {loading ? "Loading…" : `${count} reaction${count === 1 ? "" : "s"}`}
        </Typography>
      ) : reactors.length === 0 ? (
        <Typography sx={{ fontSize: "0.72rem", color: "#FFFFFF", opacity: 0.85 }}>
          No one yet.
        </Typography>
      ) : (
        <Stack spacing={0.25}>
          {reactors.slice(0, 10).map((r, i) => (
            <Stack
              key={i}
              direction="row"
              spacing={0.5}
              sx={{ alignItems: "center", fontSize: "0.72rem", color: "#FFFFFF" }}
            >
              <ReactionGlyph kind={r.kind} />
              <Box sx={{ fontWeight: 600 }}>{r.author_display_name}</Box>
              <Box sx={{ opacity: 0.7, textTransform: "lowercase" }}>·</Box>
              <Box sx={{ opacity: 0.7 }}>{r.author_kind}</Box>
            </Stack>
          ))}
          {reactors.length > 10 && (
            <Box sx={{ fontSize: "0.7rem", color: "#FFFFFF", opacity: 0.7, mt: 0.25 }}>
              and {reactors.length - 10} more
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );

  return (
    <Tooltip
      title={title}
      arrow
      placement="top"
      onOpen={() => void load()}
      slotProps={{
        tooltip: {
          sx: { bgcolor: "rgba(14,42,61,0.96)", color: "#FFFFFF", px: 1, py: 0.5 },
        },
      }}
    >
      {children}
    </Tooltip>
  );
}

function ReactionGlyph({ kind }: { kind: ReactionKind }) {
  const Icon = REACTION_META[kind].activeIcon;
  return <Icon sx={{ fontSize: 11, color: "#FFFFFF" }} />;
}

function EmptyFeed() {
  return (
    <Box
      sx={{
        p: 4,
        borderRadius: 2,
        border: `1px dashed ${LINE}`,
        bgcolor: "rgba(255,255,255,0.5)",
        textAlign: "center",
      }}
    >
      <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 28, color: INK_MUTED, mb: 1 }} />
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, mb: 0.25 }}>
        Nothing here yet
      </Typography>
      <Typography sx={{ fontSize: "0.82rem", color: INK_MUTED }}>
        Posts from experts will appear here as they share.
      </Typography>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const t = (name ?? "").trim();
  if (!t) return "··";
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function avatarBgForKind(kind: AuthorKind): string {
  switch (kind) {
    case "expert":
      return GREEN_TINT;
    case "partner":
      return "rgba(110,51,70,0.12)";
    case "member":
      return "rgba(217,168,75,0.16)";
    case "admin":
      return "rgba(14,42,61,0.10)";
  }
}

function avatarFgForKind(kind: AuthorKind): string {
  switch (kind) {
    case "expert":
      return GREEN_DARK;
    case "partner":
      return "#6E3346";
    case "member":
      return "#A07823";
    case "admin":
      return INK;
  }
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function prettyDomain(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
