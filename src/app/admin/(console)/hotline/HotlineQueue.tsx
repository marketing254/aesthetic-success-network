"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { StatusChip, formatDateTime } from "@/components/portal/ui";
import type { ApprovedExpert, HotlineRequest } from "@/lib/portal/data";

type Props = {
  initialRequests: HotlineRequest[];
  experts: ApprovedExpert[];
  expertNames: Record<string, string>;
};

const TABS = [
  { key: "needs_routing", label: "Needs routing" },
  { key: "assigned", label: "With experts" },
  { key: "answered", label: "Answered" },
  { key: "all", label: "All" },
] as const;

export default function HotlineQueue({ initialRequests, experts, expertNames }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("needs_routing");
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      needs_routing: initialRequests.filter((r) => r.status === "submitted").length,
      assigned: initialRequests.filter((r) => r.status === "assigned").length,
      answered: initialRequests.filter((r) => r.status === "answered").length,
      all: initialRequests.length,
    }),
    [initialRequests],
  );

  const rows = useMemo(() => {
    const byTab = initialRequests.filter((r) => {
      if (tab === "needs_routing") return r.status === "submitted";
      if (tab === "assigned") return r.status === "assigned";
      if (tab === "answered") return r.status === "answered";
      return true;
    });
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((r) =>
      [r.subject, r.member_email, r.category ?? "", r.details].some((v) => v.toLowerCase().includes(q)),
    );
  }, [initialRequests, tab, query]);

  const act = async (id: string, action: string, expertId?: string) => {
    setErr(null);
    setBusy(id);
    try {
      const res = await fetch("/api/admin/hotline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, expertId }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "That didn't work. Try again.");
        setBusy(null);
        return;
      }
      router.refresh();
      setBusy(null);
    } catch {
      setErr("Could not reach the server.");
      setBusy(null);
    }
  };

  return (
    <Box>
      <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
        EXPERT HOTLINE
      </Typography>
      <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
        Triage queue
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, maxWidth: 640 }}>
        Route each question to the expert best placed to answer it. They get an email immediately and
        the member sees the plan the moment it&apos;s delivered.
      </Typography>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)} sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {experts.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          There are no approved experts yet, so nothing can be routed. Approve an expert on the Experts
          page first.
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 600 } }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <span>{t.label}</span>
                  <Chip label={counts[t.key]} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                </Stack>
              }
            />
          ))}
        </Tabs>
        <TextField
          size="small"
          placeholder="Search subject, member, category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ maxWidth: { md: 320 } }}
        />
      </Stack>

      {rows.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: "20px", p: 5, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600 }}>Nothing here</Typography>
          <Typography variant="body2">No requests match this view.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((r) => {
            const open = expanded === r.id;
            return (
              <Paper key={r.id} variant="outlined" sx={{ borderRadius: "18px", p: 2.5 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  sx={{ alignItems: { md: "flex-start" }, justifyContent: "space-between" }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.5 }}>
                      <StatusChip status={r.status} />
                      {r.urgency === "urgent" && <StatusChip status="urgent" />}
                      {r.category && (
                        <Chip
                          label={r.category}
                          size="small"
                          sx={{ height: 20, fontSize: "0.66rem", bgcolor: "rgba(10,19,32,0.05)" }}
                        />
                      )}
                    </Stack>
                    <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>{r.subject}</Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.79rem" }}>
                      {r.member_email} · asked {formatDateTime(r.created_at)}
                      {r.assigned_expert_id
                        ? ` · routed to ${expertNames[r.assigned_expert_id] ?? "an expert"}`
                        : ""}
                      {r.answered_at ? ` · answered ${formatDateTime(r.answered_at)}` : ""}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setExpanded(open ? null : r.id)}
                      sx={{ px: 0, mt: 0.5, fontSize: "0.78rem" }}
                    >
                      {open ? "Hide the question" : "Read the question"}
                    </Button>
                    {open && (
                      <Box
                        sx={{
                          mt: 1,
                          p: 2,
                          borderRadius: "12px",
                          bgcolor: "rgba(10,19,32,0.03)",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography sx={{ fontSize: "0.88rem", whiteSpace: "pre-wrap" }}>
                          {r.details}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  <Stack spacing={1} sx={{ minWidth: { md: 280 }, flexShrink: 0 }}>
                    <TextField
                      select
                      size="small"
                      label="Route to expert"
                      value={pick[r.id] ?? r.assigned_expert_id ?? ""}
                      onChange={(e) => setPick((p) => ({ ...p, [r.id]: e.target.value }))}
                      disabled={experts.length === 0 || r.status === "closed"}
                    >
                      <MenuItem value="">
                        <em>Select an expert</em>
                      </MenuItem>
                      {experts.map((x) => (
                        <MenuItem key={x.id} value={x.id}>
                          {x.full_name}
                          {x.topics ? ` — ${x.topics.slice(0, 40)}` : ""}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={busy === r.id || !(pick[r.id] ?? r.assigned_expert_id)}
                        onClick={() => void act(r.id, "assign", pick[r.id] ?? r.assigned_expert_id ?? "")}
                      >
                        {r.assigned_expert_id ? "Re-route" : "Route"}
                      </Button>
                      {r.assigned_expert_id && (
                        <Button size="small" variant="outlined" disabled={busy === r.id} onClick={() => void act(r.id, "unassign")}>
                          Unassign
                        </Button>
                      )}
                      {r.status !== "closed" ? (
                        <Button
                          size="small"
                          disabled={busy === r.id}
                          onClick={() => void act(r.id, "close")}
                          sx={{ color: "text.secondary" }}
                        >
                          Close
                        </Button>
                      ) : (
                        <Button size="small" disabled={busy === r.id} onClick={() => void act(r.id, "reopen")}>
                          Reopen
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
