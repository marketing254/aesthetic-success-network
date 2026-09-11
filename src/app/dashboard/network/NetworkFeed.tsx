"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import { SectionCard } from "@/components/portal/ui";

const POLL_MS = 20_000;

type Post = {
  id: string;
  authorKind: "expert" | "partner";
  authorName: string;
  content: string;
  linkUrl: string | null;
  publishedAt: string;
  reactionCount: number;
  commentCount: number;
  viewerReaction: string | null;
  recentComments: { id: string; author_display_name: string; content: string; created_at: string }[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NetworkFeed() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/network/feed?limit=30", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { posts?: Post[]; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not load the feed.");
        return;
      }
      setError(null);
      setPosts(body.posts ?? []);
    } catch {
      setError("Could not reach the server.");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") load();
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const react = async (postId: string) => {
    setPosts((prev) =>
      prev?.map((p) =>
        p.id === postId
          ? {
              ...p,
              viewerReaction: p.viewerReaction ? null : "heart",
              reactionCount: p.reactionCount + (p.viewerReaction ? -1 : 1),
            }
          : p,
      ) ?? null,
    );
    await fetch(`/api/network/posts/${postId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "heart" }),
    });
  };

  if (posts === null && !error) {
    return (
      <Stack sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress size={22} />
      </Stack>
    );
  }

  if (error && !posts?.length) {
    return (
      <SectionCard padded>
        <Typography sx={{ color: "error.main", fontWeight: 600 }}>{error}</Typography>
      </SectionCard>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <SectionCard padded>
        <Typography sx={{ fontWeight: 700, textAlign: "center" }}>Nothing posted yet</Typography>
        <Typography variant="body2" sx={{ textAlign: "center", mt: 0.5 }}>
          Expert and partner updates will show up here as they post.
        </Typography>
      </SectionCard>
    );
  }

  return (
    <Stack spacing={2}>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} onReact={() => react(p.id)} />
      ))}
    </Stack>
  );
}

function PostCard({ post, onReact }: { post: Post; onReact: () => void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.recentComments);
  const [commentDraft, setCommentDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedFull, setLoadedFull] = useState(false);

  const openComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !loadedFull) {
      const res = await fetch(`/api/network/posts/${post.id}/comments`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { comments?: typeof comments };
      if (res.ok && body.comments) {
        setComments(
          body.comments.map((c) => ({ ...c, author_display_name: c.author_display_name ?? "" })) as typeof comments,
        );
        setLoadedFull(true);
      }
    }
  };

  const submitComment = async () => {
    const content = commentDraft.trim();
    if (!content) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/network/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; comment?: (typeof comments)[number] };
      if (res.ok && body.ok && body.comment) {
        setComments((prev) => [...prev, body.comment!]);
        setCommentDraft("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Avatar sx={{ width: 40, height: 40, fontSize: "0.9rem" }}>{initials(post.authorName)}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }}>{post.authorName}</Typography>
              <Chip
                label={post.authorKind === "expert" ? "Expert" : "Partner"}
                size="small"
                sx={{ height: 18, fontSize: "0.62rem", bgcolor: "rgba(217,168,75,0.14)", color: "#A87D2C", fontWeight: 700 }}
              />
            </Stack>
            <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
              {timeAgo(post.publishedAt)}
            </Typography>
          </Box>
        </Stack>

        <Typography sx={{ fontSize: "0.94rem", whiteSpace: "pre-wrap" }}>{post.content}</Typography>

        {post.linkUrl && (
          <Box
            component="a"
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontSize: "0.85rem", color: "#A87D2C", fontWeight: 600, textDecoration: "none", wordBreak: "break-all" }}
          >
            {post.linkUrl}
          </Box>
        )}

        <Stack direction="row" spacing={2} sx={{ alignItems: "center", pt: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Button
            onClick={onReact}
            size="small"
            startIcon={post.viewerReaction ? <FavoriteRoundedIcon sx={{ fontSize: 16, color: "#C0392B" }} /> : <FavoriteBorderRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", color: "text.secondary", mt: 1 }}
          >
            {post.reactionCount}
          </Button>
          <Button
            onClick={openComments}
            size="small"
            startIcon={<ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", color: "text.secondary", mt: 1 }}
          >
            {post.commentCount}
          </Button>
        </Stack>

        {showComments && (
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {comments.map((c) => (
              <Box key={c.id} sx={{ display: "flex", gap: 1 }}>
                <Avatar sx={{ width: 26, height: 26, fontSize: "0.65rem" }}>{initials(c.author_display_name)}</Avatar>
                <Box sx={{ bgcolor: "rgba(10,19,32,0.04)", borderRadius: "12px", px: 1.5, py: 0.75, flex: 1 }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 700 }}>{c.author_display_name}</Typography>
                  <Typography sx={{ fontSize: "0.85rem" }}>{c.content}</Typography>
                </Box>
              </Box>
            ))}
            <Stack direction="row" spacing={1}>
              <TextField
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Write a comment…"
                size="small"
                fullWidth
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
              />
              <Button onClick={submitComment} disabled={busy || !commentDraft.trim()} variant="contained" size="small">
                Send
              </Button>
            </Stack>
          </Stack>
        )}
      </Stack>
    </SectionCard>
  );
}
