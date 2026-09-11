"use client";

import { useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import { SectionCard } from "@/components/portal/ui";

type Message = { id: string; role: "user" | "assistant"; content: string };

/**
 * A minimal chat shell for the member AI concierge. No LLM is wired up —
 * see /api/portal/member/assistant — this just proves out the UI and
 * conversation history so switching in a real model later is a backend-only
 * change. Flagged in the Phase 3 report as needing an OPENAI_API_KEY
 * decision before it does anything smarter than the canned reply.
 */
export default function AssistantWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setErr(null);
    setBusy(true);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content }]);
    setDraft("");
    try {
      const res = await fetch("/api/portal/member/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; reply?: string; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Could not reach the assistant.");
        return;
      }
      setMessages((prev) => [...prev, { id: `reply-${Date.now()}`, role: "assistant", content: body.reply ?? "" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Ask the AI concierge"
      action={
        <Chip
          icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />}
          label="Beta — coming soon"
          size="small"
          sx={{ fontSize: "0.66rem", bgcolor: "rgba(217,168,75,0.14)", color: "#A87D2C", fontWeight: 700 }}
        />
      }
    >
      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
          Quick questions get a placeholder reply for now — real answers still come from the Expert Hotline while we finish wiring up the AI model.
        </Typography>

        {err && (
          <Alert severity="error" onClose={() => setErr(null)} sx={{ fontSize: "0.84rem" }}>
            {err}
          </Alert>
        )}

        {messages.length > 0 && (
          <Stack spacing={1}>
            {messages.map((m) => (
              <Box
                key={m.id}
                sx={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  bgcolor: m.role === "user" ? "rgba(217,168,75,0.14)" : "rgba(10,19,32,0.04)",
                  borderRadius: "12px",
                  px: 1.5,
                  py: 0.75,
                }}
              >
                <Typography sx={{ fontSize: "0.85rem" }}>{m.content}</Typography>
              </Box>
            ))}
          </Stack>
        )}

        <Stack direction="row" spacing={1}>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything about running your practice…"
            size="small"
            fullWidth
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} disabled={busy || !draft.trim()} variant="contained" size="small" sx={{ flexShrink: 0 }}>
            {busy ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : "Send"}
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
