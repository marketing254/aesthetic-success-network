"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { HOTLINE_CATEGORIES } from "@/lib/portal/constants";

export default function NewRequestForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState<"standard" | "urgent">("standard");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/portal/member/hotline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, category, details, urgency }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Could not submit your question. Please try again.");
        setBusy(false);
        return;
      }
      // Land on the detail page so the member sees the request they just made.
      router.replace(body.id ? `/dashboard/hotline/${body.id}` : "/dashboard/hotline");
      router.refresh();
    } catch {
      setErr("Could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2.5}>
        {err && (
          <Alert severity="error" onClose={() => setErr(null)} sx={{ fontSize: "0.84rem" }}>
            {err}
          </Alert>
        )}

        <TextField
          label="Subject"
          placeholder="e.g. Our consult-to-treatment conversion has dropped 20%"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          slotProps={{ htmlInput: { maxLength: 160 } }}
          helperText={`${subject.length}/160`}
        />

        <TextField
          label="Category"
          select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          helperText="Helps us route you to the right expert."
        >
          <MenuItem value="">
            <em>No category</em>
          </MenuItem>
          {HOTLINE_CATEGORIES.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="The situation"
          placeholder="What's happening, what you've already tried, and what a good outcome looks like. The more context, the more specific the action plan."
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          required
          multiline
          minRows={8}
          slotProps={{ htmlInput: { maxLength: 5000 } }}
          helperText={`${details.length}/5000 — 20 characters minimum`}
        />

        <Box>
          <Typography
            sx={{
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "text.secondary",
              mb: 1,
            }}
          >
            Urgency
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={urgency}
            onChange={(_, v) => v && setUrgency(v as "standard" | "urgent")}
            sx={{ "& .MuiToggleButton-root": { borderRadius: "999px !important", px: 2.5, py: 0.9 } }}
          >
            <ToggleButton value="standard">Standard · 2–3 business days</ToggleButton>
            <ToggleButton value="urgent">Urgent · next business day</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={busy}
            endIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined}
          >
            {busy ? "Submitting…" : "Submit to the Hotline"}
          </Button>
          <Button component={Link} href="/dashboard/hotline" variant="outlined" disabled={busy}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
