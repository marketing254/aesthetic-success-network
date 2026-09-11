"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { SectionCard, StatusChip, formatDate } from "@/components/portal/ui";
import type { KitFeedback, KitInquiry } from "@/lib/portal/data";

export default function KitEngagement({
  expertKitId,
  initialCompleted,
  initialFeedback,
  initialInquiries,
}: {
  expertKitId: string;
  initialCompleted: boolean;
  initialFeedback: KitFeedback | null;
  initialInquiries: KitInquiry[];
}) {
  return (
    <>
      <ProgressCard expertKitId={expertKitId} initialCompleted={initialCompleted} />
      <FeedbackCard expertKitId={expertKitId} initialFeedback={initialFeedback} />
      <QuestionsCard expertKitId={expertKitId} initialInquiries={initialInquiries} />
    </>
  );
}

function ProgressCard({ expertKitId, initialCompleted }: { expertKitId: string; initialCompleted: boolean }) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const next = !completed;
    setCompleted(next);
    setBusy(true);
    try {
      await fetch(`/api/portal/member/resources/${expertKitId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard>
      <FormControlLabel
        control={<Checkbox checked={completed} onChange={toggle} disabled={busy} />}
        label={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography sx={{ fontWeight: 600, fontSize: "0.92rem" }}>Mark this kit complete</Typography>
            {busy && <CircularProgress size={12} />}
          </Stack>
        }
      />
    </SectionCard>
  );
}

function FeedbackCard({ expertKitId, initialFeedback }: { expertKitId: string; initialFeedback: KitFeedback | null }) {
  const [rating, setRating] = useState(initialFeedback?.rating ?? 0);
  const [comment, setComment] = useState(initialFeedback?.comment ?? "");
  const [saved, setSaved] = useState(Boolean(initialFeedback));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!rating) {
      setErr("Pick a star rating first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/member/resources/${expertKitId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Could not save your feedback.");
        return;
      }
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Rate this kit">
      <Stack spacing={1.5}>
        {err && (
          <Alert severity="error" onClose={() => setErr(null)} sx={{ fontSize: "0.84rem" }}>
            {err}
          </Alert>
        )}
        <Rating
          value={rating}
          onChange={(_, v) => {
            setRating(v ?? 0);
            setSaved(false);
          }}
        />
        <TextField
          placeholder="Anything specific that helped — or didn't? (optional)"
          value={comment ?? ""}
          onChange={(e) => {
            setComment(e.target.value);
            setSaved(false);
          }}
          multiline
          minRows={2}
          size="small"
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
        <Box>
          <Button variant="contained" size="small" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : saved ? "Update feedback" : "Submit feedback"}
          </Button>
          {saved && !busy && (
            <Typography component="span" variant="body2" sx={{ ml: 1.5, color: "success.main" }}>
              Saved — thanks!
            </Typography>
          )}
        </Box>
      </Stack>
    </SectionCard>
  );
}

function QuestionsCard({ expertKitId, initialInquiries }: { expertKitId: string; initialInquiries: KitInquiry[] }) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (question.trim().length < 3) {
      setErr("Give a little more detail so we can help.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/member/resources/${expertKitId}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; createdAt?: string; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Could not submit your question.");
        return;
      }
      setInquiries((prev) => [
        {
          id: body.id!,
          name: null,
          question,
          status: "open",
          admin_note: null,
          created_at: body.createdAt ?? new Date().toISOString(),
          resolved_at: null,
        },
        ...prev,
      ]);
      setQuestion("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Questions about this kit">
      <Stack spacing={2.5}>
        {err && (
          <Alert severity="error" onClose={() => setErr(null)} sx={{ fontSize: "0.84rem" }}>
            {err}
          </Alert>
        )}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            placeholder="Ask a question about this kit"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            fullWidth
            size="small"
            multiline
            minRows={1}
            slotProps={{ htmlInput: { maxLength: 4000 } }}
          />
          <Button variant="outlined" onClick={submit} disabled={busy} sx={{ flexShrink: 0 }}>
            {busy ? "Sending…" : "Ask"}
          </Button>
        </Stack>

        {inquiries.length === 0 ? (
          <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
            No questions yet — be the first to ask.
          </Typography>
        ) : (
          <Stack spacing={2} divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
            {inquiries.map((q) => (
              <Box key={q.id}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                  <StatusChip status={q.status} />
                  <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
                    {formatDate(q.created_at)}
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: "0.9rem" }}>{q.question}</Typography>
                {q.admin_note && (
                  <Box sx={{ mt: 1, pl: 1.5, borderLeft: "2px solid", borderColor: "rgba(217,168,75,0.5)" }}>
                    <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                      {q.admin_note}
                    </Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </SectionCard>
  );
}
