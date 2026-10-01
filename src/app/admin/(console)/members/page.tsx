"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

// Full members-table row. The list API returns SELECT * so every column the
// admin might want to see is here, not just the summary columns.
type MemberRow = {
  id: string;
  auth_user_id?: string | null;
  first_name: string;
  last_name: string | null;
  credential: string | null;
  email: string;
  phone: string | null;
  practice_name: string | null;
  practice_role: string | null;
  city: string | null;
  state?: string | null;
  locations?: string | null;
  biggest_challenge?: string | null;
  heard_about?: string | null;
  referred_by?: string | null;
  promo_code_used?: string | null;
  early_member_locked?: boolean | null;
  sms_consent_at?: string | null;
  sms_consent_text?: string | null;
  status: "waitlist" | "invited" | "active" | "paused" | "churned";
  tier: string | null;
  joined_at: string | null;
  activated_at?: string | null;
  created_at: string;
  updated_at?: string | null;

  // Stripe billing
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  subscription_status?: string | null;
  subscription_interval?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  canceled_at?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  founding_member_locked?: boolean | null;
};

type WaitlistRow = {
  id: string;
  full_name: string;
  email: string;
  practice_name: string | null;
  city_state: string | null;
  phone: string | null;
  status: "new" | "contacted" | "converted" | "declined";
  created_at: string;
};

type TabKey = "members" | "waitlist";

export default function AdminMembersPage() {
  const [tab, setTab] = useState<TabKey>("members");

  return (
    <Stack spacing={4}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}>
        <Box>
          <Typography variant="overline" sx={{ display: "block" }}>
            MEMBERS
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Members & waitlist
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
            Active members appear here as they convert from the waitlist. The founding rate ($29, first 100 members) is locked at signup and never increases; everyone after that is Standard ($99).
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as TabKey)}
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.95rem" },
            "& .Mui-selected": { color: "primary.main" },
            "& .MuiTabs-indicator": { backgroundColor: "secondary.main", height: 3, borderRadius: 999 },
          }}
        >
          <Tab value="members" label="Active members" />
          <Tab value="waitlist" label="Waitlist signups" />
        </Tabs>
      </Box>

      {tab === "members" ? <MembersPanel /> : <WaitlistPanel />}
    </Stack>
  );
}

function MembersPanel() {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members", { cache: "no-store" });
      const body = (await res.json()) as { rows?: MemberRow[]; error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        setRows([]);
        return;
      }
      setRows(body.rows ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const lc = q.toLowerCase();
    return rows.filter(
      (m) =>
        `${m.first_name} ${m.last_name ?? ""}`.toLowerCase().includes(lc) ||
        m.email.toLowerCase().includes(lc) ||
        (m.practice_name ?? "").toLowerCase().includes(lc) ||
        (m.city ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q]);

  // Client-side CSV of the rows currently on screen (search applied).
  const exportCsv = () => {
    const head = ["First name", "Last name", "Email", "Phone", "Practice", "Role", "City", "State", "Status", "Tier", "Joined", "Activated", "Created"];
    const esc = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((m) =>
      [m.first_name, m.last_name, m.email, m.phone, m.practice_name, m.practice_role, m.city, m.state, m.status, m.tier, m.joined_at, m.activated_at, m.created_at]
        .map(esc)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `asn-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Stack spacing={2.5}>
      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <TextField
          placeholder="Search members…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon sx={{ color: "text.secondary", fontSize: 18 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ maxWidth: 420, flex: 1 }}
        />
        <Button variant="outlined" color="primary" startIcon={<DownloadOutlinedIcon />} disabled={filtered.length === 0} onClick={exportCsv}>
          Export CSV
        </Button>
      </Stack>

      <Box
        sx={{
          borderRadius: "18px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: { xs: "none", md: "grid" },
            gridTemplateColumns: "1.8fr 1.4fr 0.8fr 0.8fr 0.9fr",
            alignItems: "center",
            gap: 2,
            px: 3,
            py: 1.5,
            bgcolor: "grey.50",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Cell head>Member</Cell>
          <Cell head>Practice</Cell>
          <Cell head>Tier</Cell>
          <Cell head>Status</Cell>
          <Cell head>Joined</Cell>
        </Box>

        {loading ? (
          <Box sx={{ p: 6, display: "grid", placeItems: "center" }}>
            <CircularProgress size={24} sx={{ color: "#A07823" }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <Typography sx={{ color: "text.secondary" }}>
              {q
                ? `No members match "${q}".`
                : "No members yet. They'll appear here as soon as the first waitlist signup converts."}
            </Typography>
          </Box>
        ) : (
          filtered.map((m, i) => (
            <Box
              key={m.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(m)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(m);
                }
              }}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1.8fr 1.4fr 0.8fr 0.8fr 0.9fr" },
                alignItems: "center",
                gap: 2,
                px: { xs: 2.5, md: 3 },
                py: 2,
                borderBottom: i === filtered.length - 1 ? 0 : "1px solid",
                borderColor: "divider",
                cursor: "pointer",
                "&:hover": { bgcolor: "grey.50" },
                "&:focus-visible": { outline: "2px solid #A07823", outlineOffset: -2 },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 600 }} noWrap>
                  {m.first_name} {m.last_name ?? ""}
                  {m.credential ? `, ${m.credential}` : ""}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary" }} noWrap>
                  {m.email}
                </Typography>
              </Box>
              <Cell>
                <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 500 }} noWrap>
                    {m.practice_name ?? ""}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }} noWrap>
                    {m.city ?? ""}
                  </Typography>
                </Box>
              </Cell>
              <Cell>
                <Box sx={{ display: { xs: "none", md: "block" } }}>
                  <TierChip tier={m.tier} />
                </Box>
              </Cell>
              <Cell>
                <Box sx={{ display: { xs: "none", md: "block" } }}>
                  <StatusChip status={m.status} />
                </Box>
              </Cell>
              <Cell>
                <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.85rem", color: "text.secondary" }}>
                  {(m.joined_at ?? m.created_at).slice(0, 10)}
                </Box>
              </Cell>
            </Box>
          ))
        )}
      </Box>

      <MemberDetailDrawer
        member={selected}
        onClose={() => setSelected(null)}
        onToast={setToast}
        onChanged={load}
      />
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}

function MemberDetailDrawer({
  member,
  onClose,
  onToast,
  onChanged,
}: {
  member: MemberRow | null;
  onClose: () => void;
  onToast: (msg: string) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<"deactivate" | "reactivate" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const open = !!member;

  // Reset confirmation state every time a different member is opened.
  useEffect(() => {
    setConfirmDelete(false);
    setTypedEmail("");
  }, [member?.id]);

  if (!member) {
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        slotProps={{ paper: { sx: { width: { xs: "100%", sm: 480 } } } }}
      />
    );
  }

  const isPaused = member.status === "paused";
  const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email;

  const doAction = async (action: "deactivate" | "reactivate") => {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        onToast(body.error ?? `${action} failed (${res.status})`);
        return;
      }
      onToast(action === "deactivate" ? "Member deactivated." : "Member reactivated.");
      await onChanged();
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : `${action} failed.`);
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        onToast(body.error ?? `Delete failed (${res.status})`);
        return;
      }
      onToast(`Deleted ${member.email}.`);
      await onChanged();
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        slotProps={{ paper: { sx: { width: { xs: "100%", sm: 480 } } } }}
      >
        <Box sx={{ p: 3 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography sx={{ fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "text.secondary", fontWeight: 700 }}>
              Member detail
            </Typography>
            <IconButton size="small" onClick={onClose}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography sx={{ fontSize: "1.4rem", fontWeight: 700, color: "#0A1320" }}>
            {fullName}
            {member.credential ? `, ${member.credential}` : ""}
          </Typography>
          <Typography sx={{ fontSize: "0.86rem", color: "text.secondary", mt: 0.25 }}>
            {member.email}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <StatusChip status={member.status} />
            <TierChip tier={member.tier} />
            {member.founding_member_locked && (
              <Chip
                label="FOUNDING LOCKED"
                size="small"
                sx={{
                  bgcolor: "rgba(217,168,75,0.18)",
                  color: "#A07823",
                  fontWeight: 800,
                  fontSize: "0.66rem",
                  height: 22,
                }}
              />
            )}
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          <Section title="Identity">
            <Field label="First name" value={member.first_name} />
            <Field label="Last name" value={member.last_name} />
            <Field label="Credential" value={member.credential} />
            <Field label="Email" value={member.email} mono />
            <Field label="Phone" value={member.phone} />
            <Field label="Member ID" value={member.id} mono small />
            {member.auth_user_id && <Field label="Auth user ID" value={member.auth_user_id} mono small />}
          </Section>

          <Section title="Practice">
            <Field label="Practice name" value={member.practice_name} />
            <Field label="Role" value={member.practice_role} />
            <Field label="City" value={member.city} />
            {member.state && <Field label="State / Region" value={member.state} />}
            <Field label="Number of locations" value={member.locations ?? null} />
            <Field label="Biggest challenge" value={member.biggest_challenge ?? null} />
          </Section>

          <Section title="Acquisition">
            <Field label="How they heard about us" value={member.heard_about ?? null} />
            <Field label="Referred by" value={member.referred_by ?? null} />
            <Field label="Promo code used" value={member.promo_code_used ?? null} />
          </Section>

          <Section title="Consent">
            <Field
              label="SMS consent"
              value={member.sms_consent_at ? `Yes, ${formatDate(member.sms_consent_at)}` : "No"}
            />
            {member.sms_consent_text && (
              <Field label="Consent text shown" value={member.sms_consent_text} small />
            )}
          </Section>

          <Section title="Subscription">
            <Field label="Subscription status" value={member.subscription_status} />
            <Field label="Interval" value={member.subscription_interval} />
            <Field label="Current period ends" value={formatDate(member.current_period_end)} />
            <Field
              label="Cancel at period end?"
              value={member.cancel_at_period_end ? "Yes" : "No"}
            />
            <Field label="Canceled at" value={formatDate(member.canceled_at)} />
            <Field label="Card" value={cardLabel(member)} />
            <Field
              label="Founding rate locked?"
              value={member.founding_member_locked ? "Yes" : "No"}
            />
          </Section>

          <Section title="Stripe IDs">
            <Field label="Customer ID" value={member.stripe_customer_id} mono small />
            <Field label="Subscription ID" value={member.stripe_subscription_id} mono small />
            <Field label="Price ID" value={member.stripe_price_id} mono small />
          </Section>

          <Section title="Activity">
            <Field label="Joined" value={formatDate(member.joined_at)} />
            <Field label="Activated" value={formatDate(member.activated_at)} />
            <Field label="Created" value={formatDate(member.created_at)} />
            <Field label="Updated" value={formatDate(member.updated_at)} />
          </Section>

          <Divider sx={{ my: 2.5 }} />

          <Stack spacing={1}>
            {isPaused ? (
              <Button
                fullWidth
                variant="outlined"
                disabled={busy !== null}
                onClick={() => doAction("reactivate")}
                startIcon={
                  busy === "reactivate" ? (
                    <CircularProgress size={14} />
                  ) : (
                    <PlayArrowRoundedIcon fontSize="small" />
                  )
                }
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderColor: "#1F5C40",
                  color: "#1F5C40",
                  "&:hover": { borderColor: "#1F5C40", bgcolor: "rgba(31,92,64,0.06)" },
                }}
              >
                {busy === "reactivate" ? "Reactivating…" : "Reactivate member"}
              </Button>
            ) : (
              <Button
                fullWidth
                variant="outlined"
                disabled={busy !== null}
                onClick={() => doAction("deactivate")}
                startIcon={
                  busy === "deactivate" ? (
                    <CircularProgress size={14} />
                  ) : (
                    <PauseCircleOutlineRoundedIcon fontSize="small" />
                  )
                }
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderColor: "#A07823",
                  color: "#A07823",
                  "&:hover": { borderColor: "#A07823", bgcolor: "rgba(160,120,35,0.06)" },
                }}
              >
                {busy === "deactivate" ? "Deactivating…" : "Deactivate (pause + cancel Stripe at period end)"}
              </Button>
            )}

            <Button
              fullWidth
              variant="contained"
              color="error"
              disabled={busy !== null}
              onClick={() => setConfirmDelete(true)}
              startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                bgcolor: "#8C1D1D",
                "&:hover": { bgcolor: "#6F1717" },
              }}
            >
              Delete member permanently
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete this member?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This permanently removes <strong>{fullName}</strong>{" "}
            ({member.email}). Their Stripe subscription will be cancelled
            immediately and their auth user deleted. The email can re-signup
            from scratch.
          </DialogContentText>
          <DialogContentText sx={{ mb: 1, fontSize: "0.85rem" }}>
            Type the email to confirm:
          </DialogContentText>
          <TextField
            fullWidth
            size="small"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            placeholder={member.email}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={typedEmail.trim().toLowerCase() !== member.email.toLowerCase() || busy === "delete"}
            onClick={doDelete}
            sx={{ textTransform: "none", bgcolor: "#8C1D1D", "&:hover": { bgcolor: "#6F1717" } }}
          >
            {busy === "delete" ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography
        sx={{
          fontSize: "0.7rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "text.secondary",
          fontWeight: 700,
          mb: 1,
        }}
      >
        {title}
      </Typography>
      <Stack spacing={0.75}>{children}</Stack>
    </Box>
  );
}

function Field({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "baseline", gap: 1.5 }}>
      <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", width: 150, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: small ? "0.74rem" : "0.86rem",
          fontFamily: mono ? "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)" : undefined,
          color: value ? "text.primary" : "text.secondary",
          wordBreak: "break-all",
        }}
      >
        {value ?? ""}
      </Typography>
    </Stack>
  );
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 19).replace("T", " ");
  }
}

function cardLabel(m: MemberRow): string | null {
  if (!m.card_brand && !m.card_last4) return null;
  return `${m.card_brand ?? "Card"} •••• ${m.card_last4 ?? "----"}`;
}

function WaitlistPanel() {
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/waitlist", { cache: "no-store" });
      const body = (await res.json()) as { rows?: WaitlistRow[]; error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        setRows([]);
        return;
      }
      setRows((body.rows ?? []).filter((r) => "full_name" in r));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activate = async (signupId: string, fullName: string) => {
    if (!confirm(`Activate ${fullName}? They'll receive a "portal is ready" email.`)) return;
    setActivatingId(signupId);
    try {
      const res = await fetch("/api/admin/members/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitlist_signup_id: signupId }),
      });
      const body = (await res.json()) as { ok?: boolean; email_sent?: boolean; error?: string };
      if (!res.ok || body.error) {
        setToast(body.error ?? `Activate failed (${res.status})`);
        return;
      }
      setToast(
        body.email_sent
          ? `Activated. Welcome email sent.`
          : `Activated. Welcome email FAILED to send. Check email config.`,
      );
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Activate failed.");
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <Stack spacing={2.5}>
      {error && <Alert severity="error">{error}</Alert>}
      <Box
        sx={{
          borderRadius: "18px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: { xs: "none", md: "grid" },
            gridTemplateColumns: "1.6fr 1.4fr 0.9fr 0.9fr 1fr",
            alignItems: "center",
            gap: 2,
            px: 3,
            py: 1.5,
            bgcolor: "grey.50",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Cell head>Name</Cell>
          <Cell head>Practice</Cell>
          <Cell head>Status</Cell>
          <Cell head>Signed up</Cell>
          <Box />
        </Box>

        {loading ? (
          <Box sx={{ p: 6, display: "grid", placeItems: "center" }}>
            <CircularProgress size={24} sx={{ color: "#A07823" }} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <Typography sx={{ color: "text.secondary" }}>No waitlist signups yet.</Typography>
          </Box>
        ) : (
          rows.map((w, i) => {
            const isActive = w.status === "converted";
            return (
              <Box
                key={w.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1.6fr 1.4fr 0.9fr 0.9fr 1fr" },
                  alignItems: { md: "center" },
                  gap: { xs: 1.5, md: 2 },
                  px: { xs: 2.5, md: 3 },
                  py: 2,
                  borderBottom: i === rows.length - 1 ? 0 : "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 600 }} noWrap>
                    {w.full_name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary" }} noWrap>
                    {w.email}
                  </Typography>
                  {/* Mobile-only: practice + status + date inline */}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      display: { xs: "flex", md: "none" },
                      mt: 0.75,
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 0.75,
                    }}
                  >
                    <WaitlistStatusChip status={w.status} />
                    {w.practice_name && (
                      <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }}>
                        {w.practice_name}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }}>
                      · {w.created_at.slice(0, 10)}
                    </Typography>
                  </Stack>
                </Box>
                <Cell>
                  <Box sx={{ display: { xs: "none", md: "block" } }}>
                    <Typography sx={{ fontSize: "0.86rem" }} noWrap>
                      {w.practice_name ?? ""}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }} noWrap>
                      {w.city_state ?? ""}
                    </Typography>
                  </Box>
                </Cell>
                <Cell>
                  <Box sx={{ display: { xs: "none", md: "block" } }}>
                    <WaitlistStatusChip status={w.status} />
                  </Box>
                </Cell>
                <Cell>
                  <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.85rem", color: "text.secondary" }}>
                    {w.created_at.slice(0, 10)}
                  </Box>
                </Cell>
                {/* Activate button — visible on every screen size */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: { xs: "flex-start", md: "flex-end" },
                    alignItems: "center",
                  }}
                >
                  {activatingId === w.id ? (
                    <CircularProgress size={18} sx={{ color: "#A07823" }} />
                  ) : isActive ? (
                    <Typography sx={{ fontSize: "0.72rem", color: "#1F5C40", fontWeight: 600 }}>
                      ✓ Activated
                    </Typography>
                  ) : (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => activate(w.id, w.full_name)}
                      sx={{
                        bgcolor: "#0A1320",
                        textTransform: "none",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        px: 1.75,
                        py: 0.5,
                        "&:hover": { bgcolor: "#0E2A3D" },
                      }}
                    >
                      Activate member
                    </Button>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Box>
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}

function Cell({ head, children }: { head?: boolean; children?: React.ReactNode }) {
  return (
    <Box
      sx={{
        fontSize: head ? "0.7rem" : "0.9rem",
        fontWeight: head ? 700 : 500,
        letterSpacing: head ? "0.06em" : 0,
        textTransform: head ? "uppercase" : "none",
        color: head ? "text.secondary" : "text.primary",
      }}
    >
      {children}
    </Box>
  );
}

function TierChip({ tier }: { tier: string | null }) {
  // ASN tiers: Founding ($29) and Standard ($99). Any legacy value renders
  // in the neutral style.
  const raw = tier ?? "";
  const label = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "None";
  const map: Record<string, { bg: string; color: string }> = {
    Founding: { bg: "rgba(217,168,75,0.16)", color: "#A07823" },
    Standard: { bg: "rgba(14,42,61,0.07)", color: "primary.dark" },
  };
  const s = map[label] ?? { bg: "grey.100", color: "text.secondary" };
  return <Chip label={label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.7rem", height: 22 }} />;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "Active" },
    invited: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "Invited" },
    waitlist: { bg: "rgba(14,42,61,0.07)", color: "primary.dark", label: "Waitlist" },
    paused: { bg: "grey.200", color: "text.secondary", label: "Paused" },
    churned: { bg: "rgba(140,29,29,0.1)", color: "#8C1D1D", label: "Churned" },
  };
  const s = map[status] ?? map.waitlist;
  return <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.66rem", height: 20 }} />;
}

function WaitlistStatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    new: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "New" },
    contacted: { bg: "rgba(14,42,61,0.07)", color: "primary.dark", label: "Contacted" },
    converted: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "Converted" },
    declined: { bg: "rgba(140,29,29,0.1)", color: "#8C1D1D", label: "Declined" },
  };
  const s = map[status] ?? map.new;
  return <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.66rem", height: 20 }} />;
}
