"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";

/**
 * FeedbackDialog — Udemy-style mid-kit rating prompt.
 *
 * Fires once per (member, topic) when the kit hits 50% progress. Single
 * required star rating (1–5) + optional one-line comment. Skipping is
 * fine — we set a session-storage flag so the same dialog doesn't pop
 * twice in one visit, and on the server we hard-block resubmissions via
 * the unique (member_id, topic_slug) constraint.
 */
export type FeedbackDialogProps = {
  open: boolean;
  topicSlug: string;
  topicTitle: string;
  progressPct: number;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function FeedbackDialog({
  open,
  topicSlug,
  topicTitle,
  progressPct,
  onClose,
  onSubmitted,
}: FeedbackDialogProps) {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when the dialog opens for a new kit
  useEffect(() => {
    if (open) {
      setRating(0);
      setHover(0);
      setComment("");
      setError(null);
    }
  }, [open, topicSlug]);

  const submit = async () => {
    if (rating < 1) {
      setError("Pick a rating, 1–5 stars.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/member/resources/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_slug: topicSlug,
          rating,
          comment: comment.trim() || null,
          progress_pct: progressPct,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Couldn't save your feedback. Please try again.");
        return;
      }
      // Remember locally so the prompt doesn't reappear in this session.
      try {
        sessionStorage.setItem(`feedback_done:${topicSlug}`, "1");
      } catch { /* ignore */ }
      onSubmitted?.();
      onClose();
    } catch {
      setError("Couldn't save your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const dismiss = () => {
    // Remember dismissal for the session so we don't re-pop on the next
    // resource the member opens in the same kit.
    try {
      sessionStorage.setItem(`feedback_dismissed:${topicSlug}`, "1");
    } catch { /* ignore */ }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            bgcolor: "#FFFFFF",
            overflow: "hidden",
            border: "1px solid rgba(14,42,61,0.08)",
            boxShadow: "0 32px 64px -32px rgba(14,42,61,0.4)",
          },
        },
      }}
    >
      <Box sx={{ position: "relative", p: { xs: 3, sm: 3.5 } }}>
        <IconButton
          aria-label="Close"
          onClick={dismiss}
          size="small"
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            color: "#7A8590",
            "&:hover": { bgcolor: "rgba(14,42,61,0.04)", color: "#0A1A2F" },
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>

        <Typography
          sx={{
            fontSize: "0.65rem",
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: "#A07823",
            textTransform: "uppercase",
            mb: 0.75,
          }}
        >
          You're halfway through
        </Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: "1.3rem",
            fontWeight: 500,
            color: "#0A1A2F",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            mb: 0.5,
          }}
        >
          Quick favor: how's it landing?
        </Typography>
        <Typography sx={{ fontSize: "0.84rem", color: "#3B4A55", lineHeight: 1.55, mb: 2.5 }}>
          Rate <strong>{topicTitle}</strong> so the team knows what's resonating. One question, takes ten seconds.
        </Typography>

        <Stack
          direction="row"
          spacing={0.25}
          sx={{ justifyContent: "center", mb: 1.25 }}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= (hover || rating);
            return (
              <IconButton
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${star} star${star === 1 ? "" : "s"}`}
                sx={{
                  color: filled ? "#F0C16E" : "#C5BDAB",
                  p: 0.5,
                  "&:hover": { color: "#D9A84B", bgcolor: "transparent" },
                }}
              >
                {filled ? (
                  <StarRoundedIcon sx={{ fontSize: 38 }} />
                ) : (
                  <StarBorderRoundedIcon sx={{ fontSize: 38 }} />
                )}
              </IconButton>
            );
          })}
        </Stack>
        <Typography
          sx={{
            textAlign: "center",
            fontSize: "0.74rem",
            color: "#7A8590",
            mb: 2,
            minHeight: 18,
          }}
        >
          {ratingLabel(hover || rating)}
        </Typography>

        <TextField
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Anything we should know? (optional)"
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          slotProps={{ inputLabel: { shrink: false }, htmlInput: { maxLength: 1000 } }}
          sx={{
            mb: 2,
            "& .MuiOutlinedInput-root": { fontSize: "0.88rem", bgcolor: "#FBF8F1" },
          }}
        />

        {error && (
          <Typography sx={{ fontSize: "0.78rem", color: "#8C1D1D", mb: 1.25 }}>
            {error}
          </Typography>
        )}

        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button
            onClick={dismiss}
            sx={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#5C6770",
              textTransform: "none",
              "&:hover": { bgcolor: "rgba(14,42,61,0.04)" },
            }}
          >
            Maybe later
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || rating < 1}
            variant="contained"
            disableElevation
            endIcon={
              submitting ? <CircularProgress size={14} sx={{ color: "#FFFFFF" }} /> : null
            }
            sx={{
              fontSize: "0.82rem",
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 1,
              px: 2,
              bgcolor: "#0A1A2F !important",
              backgroundImage: "none !important",
              color: "#FFFFFF !important",
              "&:hover": { bgcolor: "#0F2540 !important", color: "#FFFFFF !important" },
              "&.Mui-disabled": {
                bgcolor: "#3A3A3A !important",
                color: "rgba(255,255,255,0.55) !important",
              },
            }}
          >
            {submitting ? "Saving…" : "Submit"}
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}

function ratingLabel(n: number): string {
  switch (n) {
    case 1: return "Not useful";
    case 2: return "Could be better";
    case 3: return "Useful";
    case 4: return "Really useful";
    case 5: return "Game-changing";
    default: return "Tap a star";
  }
}
