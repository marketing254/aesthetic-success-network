"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import { EmptyState, PageHeader } from "@/components/vendor/PortalUI";

const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";
const NAVY_TINT = "rgba(14,42,61,0.08)";

type Conversation = {
  id: string;
  member_auth_user_id: string;
  member_display_name: string;
  status: "open" | "escalated" | "expert_handling" | "resolved" | "abandoned";
  message_count: number;
  last_message_at: string;
  last_member_message_at: string | null;
  last_bot_message_at: string | null;
  last_expert_message_at: string | null;
  created_at: string;
};

export default function ExpertChatbotPage() {
  const [rows, setRows] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expert/conversations", { cache: "no-store" });
      const body = (await res.json()) as { conversations?: Conversation[]; error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        return;
      }
      setRows(body.conversations ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="AI helper"
        subtitle="When members ask your AI helper a question, you see the thread here. You can take over any conversation manually; the bot keeps members covered while you're away."
      />

      {/* Stub notice */}
      <Alert severity="warning">
        <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", mb: 0.25 }}>Coming soon</Typography>
        <Typography sx={{ fontSize: "0.8125rem", lineHeight: 1.55 }}>
          Your AI helper is being trained on your published resources. Members will soon be able to ask questions and get answers in your voice. We&apos;ll let you know when it&apos;s ready.
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Conversations list */}
      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={24} />
        </Stack>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          body="Once a member asks your AI helper a question (usually from one of your posts in the feed), the thread shows up here. Reply directly when you want to take over."
        />
      ) : (
        <Box sx={{ bgcolor: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: "8px", overflow: "hidden" }}>
          <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
            {rows.map((r) => (
              <ConversationRow key={r.id} c={r} />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function ConversationRow({ c }: { c: Conversation }) {
  return (
    <Box sx={{ px: 3, py: 2, "&:hover": { bgcolor: "#F9FAFB" } }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Avatar
          sx={{
            width: 36,
            height: 36,
            bgcolor: NAVY_TINT,
            color: NAVY,
            fontWeight: 600,
            fontSize: "0.8125rem",
            flexShrink: 0,
          }}
        >
          {initials(c.member_display_name)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.5 }}>
            <Typography sx={{ fontWeight: 600, color: INK, fontSize: "0.875rem" }}>
              {c.member_display_name}
            </Typography>
            <StatusChip status={c.status} />
          </Stack>
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", color: MUTED, fontSize: "0.8125rem", alignItems: "center" }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <PersonOutlineRoundedIcon sx={{ fontSize: 14 }} />
              <Box>
                {c.message_count} message{c.message_count === 1 ? "" : "s"}
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <ScheduleOutlinedIcon sx={{ fontSize: 14 }} />
              <Box>Last active {formatRelativeDate(c.last_message_at)}</Box>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function StatusChip({ status }: { status: Conversation["status"] }) {
  const map: Record<
    Conversation["status"],
    { label: string; color: "default" | "primary" | "success" | "warning" }
  > = {
    open: { label: "Bot handling", color: "primary" },
    escalated: { label: "Needs your attention", color: "warning" },
    expert_handling: { label: "You're handling", color: "primary" },
    resolved: { label: "Resolved", color: "success" },
    abandoned: { label: "Inactive", color: "default" },
  };
  const m = map[status];
  return <Chip label={m.label} size="small" color={m.color} />;
}

function initials(name: string): string {
  const t = (name ?? "").trim();
  if (!t) return "··";
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "";
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
