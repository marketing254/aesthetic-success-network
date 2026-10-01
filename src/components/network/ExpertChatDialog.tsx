"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";

const EXPERT_GREEN = "#2C7A52";
const EXPERT_GREEN_DARK = "#1F5238";
const EXPERT_GREEN_TINT = "#E8F2EC";
const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const LINE = "#E6DDCF";

type Role = "member" | "bot" | "expert";

type Message = {
  id: string;
  role: Role;
  content: string;
  created_at: string;
  bot_provider?: string | null;
};

type ExpertSummary = {
  id: string;
  name: string;
  specialty: string | null;
  headshot_url: string | null;
};

type Props = {
  open: boolean;
  expertId: string;
  expertName: string;
  onClose: () => void;
};

export default function ExpertChatDialog({ open, expertId, expertName, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [expert, setExpert] = useState<ExpertSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/network/experts/${expertId}/chat`, { cache: "no-store" });
      const body = (await res.json()) as {
        messages?: Message[];
        expert?: ExpertSummary;
        error?: string;
      };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        return;
      }
      setMessages(body.messages ?? []);
      setExpert(body.expert ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat.");
    } finally {
      setLoading(false);
    }
  }, [expertId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    try {
      const res = await fetch(`/api/network/experts/${expertId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = (await res.json()) as { ok?: boolean; messages?: Message[]; error?: string };
      if (!res.ok || !body.ok || !body.messages) {
        setError(body.error ?? "Failed to send.");
        setInput(content); // restore input
        return;
      }
      setMessages((prev) => [...prev, ...body.messages!]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const displayName = expert?.name || expertName;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            border: `1px solid ${LINE}`,
            overflow: "hidden",
            bgcolor: "#FBF8F1",
            height: { xs: "100%", sm: "min(640px, 85vh)" },
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          borderBottom: `1px solid ${LINE}`,
          bgcolor: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <Avatar
          src={expert?.headshot_url ?? undefined}
          sx={{
            width: 40,
            height: 40,
            bgcolor: EXPERT_GREEN_TINT,
            color: EXPERT_GREEN,
            fontSize: "0.9rem",
            fontWeight: 700,
            position: "relative",
          }}
        >
          {initials(displayName)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <Typography sx={{ fontWeight: 700, color: INK, fontSize: "0.95rem" }} noWrap>
              {displayName}
            </Typography>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.4,
                px: 0.75,
                py: 0.15,
                borderRadius: "999px",
                bgcolor: EXPERT_GREEN_TINT,
                color: EXPERT_GREEN_DARK,
                fontSize: "0.62rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              <SmartToyOutlinedIcon sx={{ fontSize: 11 }} /> AI helper
            </Box>
          </Stack>
          <Typography sx={{ fontSize: "0.78rem", color: INK_MUTED }} noWrap>
            {expert?.specialty ?? "Ask questions; the bot routes to the expert if needed."}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: INK_MUTED }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      {/* Messages */}
      <DialogContent
        ref={scrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          px: 2.5,
          py: 2.5,
          bgcolor: "#FBF8F1",
        }}
      >
        {loading ? (
          <Stack sx={{ alignItems: "center", py: 6 }}>
            <CircularProgress size={24} sx={{ color: EXPERT_GREEN }} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            {/* Stub notice */}
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: "rgba(245,158,11,0.10)",
                border: "1px solid rgba(245,158,11,0.28)",
                fontSize: "0.78rem",
                color: "#8B5A00",
                lineHeight: 1.5,
              }}
            >
              <strong>Preview:</strong> the AI helper currently returns a placeholder reply so we can test the flow. Real LLM integration ships in the next round.
            </Box>

            {messages.length === 0 && (
              <Typography sx={{ color: INK_MUTED, fontSize: "0.9rem", textAlign: "center", py: 3 }}>
                Start the conversation. The bot replies instantly; {firstName(displayName)} will follow up when needed.
              </Typography>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} expertName={displayName} />
            ))}
          </Stack>
        )}
      </DialogContent>

      {/* Footer */}
      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          borderTop: `1px solid ${LINE}`,
          bgcolor: "#FFFFFF",
          flexShrink: 0,
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
          <TextField
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Ask ${firstName(displayName)} a question…`}
            multiline
            maxRows={5}
            fullWidth
            size="small"
            disabled={sending || loading}
            slotProps={{ inputLabel: { shrink: false } }}
          />
          <IconButton
            onClick={send}
            disabled={sending || !input.trim()}
            sx={{
              bgcolor: EXPERT_GREEN,
              color: "#FFFFFF",
              width: 40,
              height: 40,
              "&:hover": { bgcolor: EXPERT_GREEN_DARK },
              "&.Mui-disabled": { bgcolor: "rgba(14,42,61,0.12)", color: "rgba(14,42,61,0.4)" },
            }}
          >
            {sending ? (
              <CircularProgress size={16} sx={{ color: "#FFFFFF" }} />
            ) : (
              <SendRoundedIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Stack>
      </Box>
    </Dialog>
  );
}

function MessageBubble({ m, expertName }: { m: Message; expertName: string }) {
  if (m.role === "member") {
    return (
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Box
          sx={{
            maxWidth: "80%",
            px: 1.75,
            py: 1.25,
            borderRadius: "16px 16px 4px 16px",
            bgcolor: EXPERT_GREEN,
            color: "#FFFFFF",
            fontSize: "0.92rem",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {m.content}
        </Box>
      </Box>
    );
  }
  const isExpert = m.role === "expert";
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
      <Avatar
        sx={{
          width: 28,
          height: 28,
          bgcolor: EXPERT_GREEN_TINT,
          color: EXPERT_GREEN,
          fontSize: "0.7rem",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {isExpert ? initials(expertName) : "AI"}
      </Avatar>
      <Box
        sx={{
          maxWidth: "80%",
          px: 1.75,
          py: 1.25,
          borderRadius: "16px 16px 16px 4px",
          bgcolor: "#FFFFFF",
          color: INK,
          fontSize: "0.92rem",
          lineHeight: 1.5,
          border: `1px solid ${LINE}`,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: isExpert ? EXPERT_GREEN_DARK : INK_MUTED,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            mb: 0.5,
          }}
        >
          {isExpert ? expertName : "AI helper"}
        </Typography>
        <Box sx={{ color: INK_SOFT, fontSize: "0.9rem" }}>{m.content}</Box>
      </Box>
    </Box>
  );
}

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
