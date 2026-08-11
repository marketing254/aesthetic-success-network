"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";

export default function AnswerForm({
  requestId,
  initialSummary,
  initialActionPlan,
  submitted,
}: {
  requestId: string;
  initialSummary: string;
  initialActionPlan: string;
  submitted: boolean;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [actionPlan, setActionPlan] = useState(initialActionPlan);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const send = async (action: "save" | "submit") => {
    setErr(null);
    setNote(null);
    setBusy(action);
    try {
      const res = await fetch(`/api/portal/expert/requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, summary, actionPlan }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Could not save. Please try again.");
        setBusy(null);
        return;
      }
      if (action === "save") {
        setNote("Draft saved. The member can't see it until you submit.");
        setBusy(null);
      } else {
        router.refresh();
      }
    } catch {
      setErr("Could not reach the server. Check your connection and try again.");
      setBusy(null);
    }
  };

  if (submitted) {
    return (
      <Stack spacing={2}>
        <Alert severity="success" sx={{ fontSize: "0.84rem" }}>
          Delivered. The member has been emailed and can read this in their portal.
        </Alert>
        <Box>
          <Typography
            sx={{
              fontSize: "0.66rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "text.secondary",
              mb: 0.5,
            }}
          >
            The short answer
          </Typography>
          <Typography sx={{ fontSize: "0.98rem", fontWeight: 600 }}>{initialSummary}</Typography>
        </Box>
        <Box>
          <Typography
            sx={{
              fontSize: "0.66rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "text.secondary",
              mb: 0.5,
            }}
          >
            Action plan
          </Typography>
          <Typography sx={{ fontSize: "0.93rem", whiteSpace: "pre-wrap" }}>{initialActionPlan}</Typography>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      {err && (
        <Alert severity="error" onClose={() => setErr(null)} sx={{ fontSize: "0.84rem" }}>
          {err}
        </Alert>
      )}
      {note && (
        <Alert severity="info" onClose={() => setNote(null)} sx={{ fontSize: "0.84rem" }}>
          {note}
        </Alert>
      )}

      <TextField
        label="The short answer"
        placeholder="One sentence the member can act on immediately."
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 300 } }}
        helperText={`${summary.length}/300 — 10 characters minimum to submit`}
      />

      <TextField
        label="Action plan"
        placeholder={
          "Concrete steps, in order, sized for the next two weeks.\n\n1. …\n2. …\n3. …\n\nInclude what to measure and when to check it."
        }
        value={actionPlan}
        onChange={(e) => setActionPlan(e.target.value)}
        multiline
        minRows={14}
        slotProps={{ htmlInput: { maxLength: 20000 } }}
        helperText={`${actionPlan.length} characters — 80 minimum to submit`}
      />

      <Stack direction="row" spacing={1.5}>
        <Button
          variant="contained"
          onClick={() => void send("submit")}
          disabled={busy !== null}
          endIcon={busy === "submit" ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined}
        >
          {busy === "submit" ? "Delivering…" : "Deliver the action plan"}
        </Button>
        <Button
          variant="outlined"
          onClick={() => void send("save")}
          disabled={busy !== null}
          endIcon={busy === "save" ? <CircularProgress size={14} /> : undefined}
        >
          {busy === "save" ? "Saving…" : "Save draft"}
        </Button>
      </Stack>

      <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
        Delivering emails the member and marks the request answered. Drafts stay private to you.
      </Typography>
    </Stack>
  );
}
