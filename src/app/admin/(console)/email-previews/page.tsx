"use client";

import { useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";

/** /admin/email-previews: send every email template with sample data to a review inbox. */
export default function EmailPreviewsPage() {
  const [to, setTo] = useState("rushdhaakbar82@gmail.com, lester@ekwa.com");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; note?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/admin/email-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const body = (await res.json()) as { results?: { name: string; ok: boolean; note?: string }[]; error?: string };
      if (!res.ok) setError(body.error ?? `Failed (${res.status})`);
      else setResults(body.results ?? []);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Email drafts
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 3 }}>
        Sends every expert and company email (application received, approved, agreement with PDF, welcome after
        acceptance, 7-day billing reminder), plus the sign-in code and the two team alerts, with sample data to the
        addresses below so the copy, logo and layout can be reviewed in a real inbox. Members get no emails until the
        launch, so none are included. Comma-separate several addresses: every address receives a copy, and only the
        first one is printed inside the emails as the account email.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField label="Send to" value={to} onChange={(e) => setTo(e.target.value)} fullWidth />
        <Button
          variant="contained"
          onClick={() => void send()}
          disabled={busy || !to.includes("@")}
          sx={{ whiteSpace: "nowrap" }}
        >
          {busy ? "Sending..." : "Send all drafts"}
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {results && (
        <Stack spacing={0.75}>
          {results.map((r) => (
            <Alert key={r.name} severity={r.ok ? "success" : "warning"}>
              {r.name}
              {r.note ? `: ${r.note}` : ""}
            </Alert>
          ))}
        </Stack>
      )}
    </Box>
  );
}
