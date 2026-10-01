"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";

type Status = {
  ok?: boolean;
  deployment?: string;
  vercelEnv?: string;
  livemode?: boolean;
  secretKey?: { mode: string; prefix: string };
  publishableKey?: { mode: string; prefix: string; matchesSecret: boolean };
  webhookSecretSet?: boolean;
  memberLaunchDate?: string | null;
  prices?: { env: string; set: boolean; id?: string; found?: boolean; active?: boolean; amount?: string | null; product?: string | null; livemode?: boolean; required?: boolean; error?: string }[];
  webhook?: { expectedUrl: string; found: boolean; status: string | null; events: string[] | null; others: { url: string; status: string }[] };
  problems?: string[];
  error?: string;
};

/** /admin/stripe-status: read-only check that Stripe is wired up on this deployment. */
export default function StripeStatusPage() {
  const [data, setData] = useState<Status | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(() => {
    fetch("/api/admin/stripe/status", { cache: "no-store" })
      .then((res) => res.json() as Promise<Status>)
      .then((body) => setData(body))
      .catch(() => setData({ error: "Network error." }))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const mode = data?.livemode === true ? "LIVE" : data?.livemode === false ? "TEST" : "unknown";

  return (
    <Box sx={{ maxWidth: 860 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Stripe status
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 2 }}>
        Checks the Stripe account, every price id and the webhook for <strong>this deployment</strong> ({data?.deployment ?? "..."}).
        Read-only: nothing is created in Stripe. Open it on Preview and on Production separately.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        <Chip label={`Mode: ${mode}`} color={mode === "LIVE" ? "success" : mode === "TEST" ? "warning" : "default"} />
        <Chip label={`Vercel env: ${data?.vercelEnv ?? "..."}`} variant="outlined" />
        <Chip label={`Launch date: ${data?.memberLaunchDate ?? "not set (provisional free period)"}`} variant="outlined" />
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            setBusy(true);
            load();
          }}
          disabled={busy}
        >
          {busy ? "Checking..." : "Re-check"}
        </Button>
      </Stack>
      {data?.error && <Alert severity="error">{data.error}</Alert>}
      {data && !data.error && (
        <Alert severity={data.ok ? "success" : "warning"} sx={{ mb: 2 }}>
          {data.ok ? "Stripe is correctly connected for this deployment." : "Stripe is not fully connected:"}
          {data.problems?.length ? (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {data.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      )}
      {data?.prices && (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden", mb: 2 }}>
          <Box sx={{ px: 2, py: 1, bgcolor: "rgba(10,19,32,0.04)", fontWeight: 700, fontSize: "0.85rem" }}>Prices</Box>
          {data.prices.map((p) => (
            <Stack key={p.env} direction="row" spacing={1.5} sx={{ px: 2, py: 0.75, borderTop: "1px solid", borderColor: "divider", alignItems: "center", fontSize: "0.82rem", flexWrap: "wrap" }}>
              <Chip size="small" label={!p.set ? "not set" : p.found ? (p.active ? "ok" : "archived") : "missing"} color={!p.set ? (p.required ? "error" : "default") : p.found && p.active ? "success" : "error"} />
              <Box component="code" sx={{ fontFamily: "monospace" }}>{p.env}</Box>
              <Box sx={{ color: "text.secondary" }}>{p.amount ?? ""} {p.product ? `· ${p.product}` : ""} {p.error ?? ""}</Box>
            </Stack>
          ))}
        </Box>
      )}
      {data?.webhook && (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, fontSize: "0.85rem" }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Webhook</Typography>
          <div>Expected URL: <code>{data.webhook.expectedUrl}</code></div>
          <div>Found: {data.webhook.found ? `yes (${data.webhook.status})` : "no"} · Signing secret set: {data.webhookSecretSet ? "yes" : "no"}</div>
          {data.webhook.others.length > 0 && (
            <div style={{ marginTop: 6, color: "#5C6770" }}>Other endpoints in this account: {data.webhook.others.map((o) => `${o.url} (${o.status})`).join(", ")}</div>
          )}
        </Box>
      )}
    </Box>
  );
}
