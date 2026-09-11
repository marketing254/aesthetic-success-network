"use client";
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import PauseCircleOutlinedIcon from "@mui/icons-material/PauseCircleOutlined";
import PlayCircleOutlinedIcon from "@mui/icons-material/PlayCircleOutlined";

export type ReferralCodeRow = {
  id: string;
  code: string;
  slug: string | null;
  expert_application_id: string | null;
  partner_application_id: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

export type ReferralSignupRow = {
  id: string;
  code_id: string;
  member_id: string | null;
  referred_name: string | null;
  referred_email: string | null;
  converted_at: string | null;
  created_at: string;
};

export type OwnerOption = { id: string; name: string };

function csvEscape(s: unknown): string {
  if (s === null || s === undefined) return "";
  const v = String(s);
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReferralsTable({
  initialRows,
  initialSignups,
  experts,
  partners,
}: {
  initialRows: ReferralCodeRow[];
  initialSignups: ReferralSignupRow[];
  experts: OwnerOption[];
  partners: OwnerOption[];
}) {
  const [rows, setRows] = useState<ReferralCodeRow[]>(initialRows);
  const [signups, setSignups] = useState<ReferralSignupRow[]>(initialSignups);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newOwnerType, setNewOwnerType] = useState<"expert" | "partner">("expert");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const ownerLabel = (row: ReferralCodeRow): string => {
    if (row.expert_application_id) {
      return experts.find((e) => e.id === row.expert_application_id)?.name ?? "Expert";
    }
    if (row.partner_application_id) {
      return partners.find((p) => p.id === row.partner_application_id)?.name ?? "Partner";
    }
    return "—";
  };

  const ownerKind = (row: ReferralCodeRow): "expert" | "partner" =>
    row.expert_application_id ? "expert" : "partner";

  const statsByCode = useMemo(() => {
    const map = new Map<string, { signups: number; conversions: number }>();
    for (const s of signups) {
      const entry = map.get(s.code_id) ?? { signups: 0, conversions: 0 };
      entry.signups += 1;
      if (s.converted_at) entry.conversions += 1;
      map.set(s.code_id, entry);
    }
    return map;
  }, [signups]);

  const codeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.id, r.code);
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(lc) ||
        (r.slug ?? "").toLowerCase().includes(lc) ||
        ownerLabel(r).toLowerCase().includes(lc),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, experts, partners]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.active).length,
      signups: signups.length,
      conversions: signups.filter((s) => s.converted_at).length,
    }),
    [rows, signups],
  );

  const refresh = async () => {
    const res = await fetch("/api/admin/referrals", { cache: "no-store" });
    const body = (await res.json()) as {
      rows?: ReferralCodeRow[];
      signups?: ReferralSignupRow[];
    };
    if (body.rows) setRows(body.rows);
    if (body.signups) setSignups(body.signups);
  };

  const toggleActive = async (row: ReferralCodeRow) => {
    const action = row.active ? "deactivate" : "activate";
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active: !row.active } : x)));
    const res = await fetch("/api/admin/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action }),
    });
    if (!res.ok) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active: row.active } : x)));
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`Copied ${code}.`);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  };

  const addCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerType: newOwnerType,
          ownerId: newOwnerId,
          code: newCode || undefined,
          slug: newSlug || undefined,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not create referral code.");
      setNotice("Referral code created.");
      setNewOwnerId("");
      setNewCode("");
      setNewSlug("");
      setAdding(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create referral code.");
    } finally {
      setBusy(false);
    }
  };

  const exportCSV = () => {
    const headers = ["code", "slug", "owner", "owner_kind", "active", "signups", "conversions", "created_at"];
    const lines = [
      headers.join(","),
      ...filtered.map((r) => {
        const stats = statsByCode.get(r.id) ?? { signups: 0, conversions: 0 };
        const record: Record<string, unknown> = {
          code: r.code,
          slug: r.slug,
          owner: ownerLabel(r),
          owner_kind: ownerKind(r),
          active: r.active,
          signups: stats.signups,
          conversions: stats.conversions,
          created_at: r.created_at,
        };
        return headers.map((h) => csvEscape(record[h])).join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asn-referral-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const ownerOptions = newOwnerType === "expert" ? experts : partners;
  const recentSignups = useMemo(() => signups.slice(0, 25), [signups]);

  return (
    <Stack spacing={3.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
            REFERRALS
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Referral codes
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            One code per approved expert or partner, so the team can track who&apos;s sending
            members. Conversions are marked by hand until a signup flow stamps them automatically.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => setAdding((v) => !v)}
          >
            Add code
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlinedIcon />}
            onClick={exportCSV}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {adding && (
        <Box
          component="form"
          onSubmit={addCode}
          sx={{
            p: 2.5,
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
          }}
        >
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Mint a referral code</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              select
              label="Owner type"
              size="small"
              value={newOwnerType}
              onChange={(e) => {
                setNewOwnerType(e.target.value as "expert" | "partner");
                setNewOwnerId("");
              }}
              sx={{ flex: 1 }}
            >
              <MenuItem value="expert">Expert</MenuItem>
              <MenuItem value="partner">Partner</MenuItem>
            </TextField>
            <TextField
              select
              label={newOwnerType === "expert" ? "Expert" : "Partner"}
              size="small"
              required
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              sx={{ flex: 1.4 }}
            >
              {ownerOptions.length === 0 && (
                <MenuItem value="" disabled>
                  No approved {newOwnerType}s yet
                </MenuItem>
              )}
              {ownerOptions.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Code"
              size="small"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              helperText="Optional — auto-generated from owner name"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Slug"
              size="small"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              helperText="Optional, e.g. drchen"
              sx={{ flex: 1 }}
            />
            <Button type="submit" variant="contained" disabled={busy} sx={{ flexShrink: 0 }}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </Stack>
        </Box>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total codes", value: counts.total, accent: false },
          { label: "Active", value: counts.active, accent: true },
          { label: "Signups", value: counts.signups, accent: false },
          { label: "Conversions", value: counts.conversions, accent: false },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 6, md: 3 }}>
            <Box
              sx={{
                p: 2.25,
                borderRadius: "16px",
                border: "1px solid",
                borderColor: card.accent ? "rgba(217,168,75,0.4)" : "divider",
                bgcolor: card.accent ? "rgba(217,168,75,0.05)" : "common.white",
              }}
            >
              <Typography variant="overline" sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                {card.label}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.8rem", md: "2.1rem" },
                  lineHeight: 1,
                  color: "text.primary",
                  mt: 0.5,
                }}
              >
                {card.value.toLocaleString("en-US")}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <TextField
        placeholder="Search code, slug, owner…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ maxWidth: 420 }}
      />

      <Box
        sx={{
          borderRadius: "20px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="h5" sx={{ mb: 1, color: "text.primary" }}>
              {rows.length === 0 ? "No referral codes yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0
                ? "Mint a code for an approved expert or partner above."
                : "Try clearing the search."}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                "& th": {
                  textAlign: "left",
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "text.secondary",
                  fontWeight: 700,
                  px: 2.5,
                  py: 1.5,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: "rgba(247,245,240,0.6)",
                },
                "& td": {
                  px: 2.5,
                  py: 1.9,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  fontSize: "0.88rem",
                  verticalAlign: "top",
                },
                "& tr:last-child td": { borderBottom: "none" },
              }}
            >
              <Box component="thead">
                <Box component="tr">
                  <Box component="th">Code</Box>
                  <Box component="th">Owner</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Signups</Box>
                  <Box component="th">Conversions</Box>
                  <Box component="th">Created</Box>
                  <Box component="th"></Box>
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((row) => {
                  const stats = statsByCode.get(row.id) ?? { signups: 0, conversions: 0 };
                  return (
                    <Box component="tr" key={row.id}>
                      <Box component="td">
                        <Typography sx={{ fontWeight: 600, color: "text.primary", fontFamily: "monospace" }}>
                          {row.code}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.25 }}
                        >
                          {row.slug ? `/join?ref=${row.slug}` : "—"}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography sx={{ color: "text.primary", fontSize: "0.85rem" }}>
                          {ownerLabel(row)}
                        </Typography>
                        <Chip
                          label={ownerKind(row)}
                          size="small"
                          sx={{
                            textTransform: "capitalize",
                            fontSize: "0.68rem",
                            height: 20,
                            mt: 0.4,
                            bgcolor: "rgba(217,168,75,0.14)",
                            color: "#7A5B17",
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <Chip
                          label={row.active ? "active" : "inactive"}
                          size="small"
                          sx={{
                            textTransform: "capitalize",
                            fontSize: "0.7rem",
                            height: 22,
                            bgcolor: row.active ? "rgba(46,138,87,0.12)" : "rgba(120,120,120,0.14)",
                            color: row.active ? "#1F5C39" : "#4A4A4A",
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.82rem" }}>
                          {stats.signups}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.82rem" }}>
                          {stats.conversions}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {formatDate(row.created_at)}
                        </Typography>
                      </Box>
                      <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Copy code">
                          <IconButton size="small" onClick={() => copyCode(row.code)}>
                            <ContentCopyOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={row.active ? "Deactivate" : "Activate"}>
                          <IconButton size="small" onClick={() => toggleActive(row)}>
                            {row.active ? (
                              <PauseCircleOutlinedIcon fontSize="small" />
                            ) : (
                              <PlayCircleOutlinedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
          RECENT SIGNUPS
        </Typography>
        <Box
          sx={{
            borderRadius: "20px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
            overflow: "hidden",
          }}
        >
          {recentSignups.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No signups yet — the member-signup flow doesn&apos;t stamp referral codes yet in
                this phase.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  "& th": {
                    textAlign: "left",
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "text.secondary",
                    fontWeight: 700,
                    px: 2.5,
                    py: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: "rgba(247,245,240,0.6)",
                  },
                  "& td": {
                    px: 2.5,
                    py: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    fontSize: "0.85rem",
                    verticalAlign: "top",
                  },
                  "& tr:last-child td": { borderBottom: "none" },
                }}
              >
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th">Referred</Box>
                    <Box component="th">Code</Box>
                    <Box component="th">Status</Box>
                    <Box component="th">Created</Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {recentSignups.map((s) => (
                    <Box component="tr" key={s.id}>
                      <Box component="td">
                        <Typography sx={{ color: "text.primary", fontWeight: 600 }}>
                          {s.referred_name ?? "—"}
                        </Typography>
                        {s.referred_email && (
                          <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.78rem" }}>
                            {s.referred_email}
                          </Typography>
                        )}
                      </Box>
                      <Box component="td">
                        <Typography sx={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                          {codeById.get(s.code_id) ?? "—"}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Chip
                          label={s.converted_at ? "converted" : "pending"}
                          size="small"
                          sx={{
                            fontSize: "0.7rem",
                            height: 22,
                            bgcolor: s.converted_at ? "rgba(46,138,87,0.12)" : "rgba(217,168,75,0.14)",
                            color: s.converted_at ? "#1F5C39" : "#7A5B17",
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {formatDate(s.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Stack>
  );
}
