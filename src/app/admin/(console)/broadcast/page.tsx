"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";

const INK = "#0A1320";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const LINE = "#E0DACE";
const ACCENT = "#0A1320";

type ExpertOption = {
  id: string;
  name: string;
};

/**
 * Admin broadcast composer.
 *
 * Composes a network-feed post on behalf of an expert. Same model as
 * the expert's own composer — same `expert_posts` row — plus an audit
 * column (`composed_by_admin_id`) so we can always tell who actually
 * wrote it.
 *
 * Use this for:
 *   - announcing a new kit ("Dr. Jane just published a new module on…")
 *   - upcoming live AMA / CE notifications
 *   - event announcements
 *   - any time an expert hasn't logged in but the team needs to keep
 *     their feed warm
 */
export default function AdminBroadcastPage() {
  const [experts, setExperts] = useState<ExpertOption[]>([]);
  const [expertId, setExpertId] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/experts?simple=1", { cache: "no-store" });
        if (!active || !res.ok) return;
        const body = (await res.json()) as { experts?: { id: string; full_name?: string; display_name?: string }[] };
        if (active) {
          setExperts(
            (body.experts ?? []).map((e) => ({
              id: e.id,
              name: e.display_name || e.full_name || "(unnamed expert)",
            })),
          );
        }
      } catch {
        // best-effort
      }
    })();
    return () => { active = false; };
  }, []);

  const submit = async (draft: boolean) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expert_id: expertId,
          content: content.trim(),
          link_url: linkUrl.trim() || null,
          draft,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Couldn't post. Try again.");
        return;
      }
      setSuccess(draft ? "Saved as draft." : "Published to the feed.");
      setContent("");
      setLinkUrl("");
    } catch {
      setError("Couldn't post. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = expertId.length > 0 && content.trim().length > 0 && !submitting;

  return (
    <Stack spacing={3.5} sx={{ maxWidth: 760, mx: "auto" }}>
      <Box>
        <Typography
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "#7A5B17",
            textTransform: "uppercase",
            mb: 1,
          }}
        >
          Broadcast
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "1.9rem", md: "2.4rem" },
            fontWeight: 500,
            color: INK,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            mb: 1,
          }}
        >
          Post on behalf of an expert
        </Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, lineHeight: 1.55, maxWidth: 640 }}>
          Use this to keep an expert's feed warm: announce a new kit, an upcoming live AMA, an event reminder. The post renders identically to one the expert wrote themselves, and an audit field records that an admin composed it.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box
        sx={{
          borderRadius: 3,
          border: `1px solid ${LINE}`,
          bgcolor: "#FFFFFF",
          p: { xs: 2.5, md: 3 },
        }}
      >
        <Stack spacing={2.5}>
          <TextField
            label="Post as"
            value={expertId}
            onChange={(e) => setExpertId(e.target.value)}
            select
            size="small"
            fullWidth
            helperText="Expert whose name + headshot will appear on the post."
          >
            <MenuItem value=""><em>Choose an expert</em></MenuItem>
            {experts.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="What's the announcement?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            minRows={4}
            maxRows={12}
            fullWidth
            placeholder="New kit just dropped: the consult script that actually moves conversion."
            slotProps={{ htmlInput: { maxLength: 4000 } }}
            helperText={`${content.length}/4000`}
          />

          <TextField
            label="Optional link"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            size="small"
            fullWidth
            helperText="Podcast URL, event registration, new kit slug, etc."
          />

          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap", rowGap: 1 }}>
            <Button
              onClick={() => submit(true)}
              disabled={!canSubmit}
              startIcon={<SaveOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.85rem",
                color: INK_SOFT,
                "&:hover": { bgcolor: "rgba(14,42,61,0.05)", color: INK },
              }}
            >
              Save draft
            </Button>
            <Button
              onClick={() => submit(false)}
              disabled={!canSubmit}
              variant="contained"
              disableElevation
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
                fontSize: "0.85rem",
                borderRadius: 1,
                px: 2.25,
                bgcolor: `${ACCENT} !important`,
                backgroundImage: "none !important",
                color: "#FFFFFF !important",
                "&:hover": { bgcolor: "#0E2A3D !important", color: "#FFFFFF !important" },
                "&.Mui-disabled": {
                  bgcolor: "#3A3A3A !important",
                  color: "rgba(255,255,255,0.55) !important",
                },
              }}
            >
              {submitting ? "Posting…" : "Publish to feed"}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Typography sx={{ fontSize: "0.78rem", color: INK_MUTED, lineHeight: 1.55 }}>
        Tip: keep posts conversational, 2 to 4 sentences in the expert's voice, ending with a single clear action (link, kit, date).
      </Typography>
    </Stack>
  );
}
