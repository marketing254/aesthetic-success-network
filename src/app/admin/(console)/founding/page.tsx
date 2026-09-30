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
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import ForwardToInboxOutlinedIcon from "@mui/icons-material/ForwardToInboxOutlined";
import FoundingInviteDialog, {
  type FoundingInviteFormValues,
  type FoundingInviteRoleValue,
} from "@/components/admin/FoundingInviteDialog";

type InviteRow = {
  id: string;
  code: string;
  role: FoundingInviteRoleValue;
  pricing_plan: "ladder" | "flat_49";
  full_name: string;
  email: string;
  company_name: string | null;
  member_offer: string | null;
  phone: string | null;
  notes: string | null;
  website: string | null;
  category: string | null;
  calendar_link: string | null;
  description: string | null;
  secondary_email: string | null;
  secondary_phone: string | null;
  signer_name: string | null;
  signer_title: string | null;
  companies:
    | { name: string; category: string | null; member_offer: string | null; contact_email: string | null }[]
    | null;
  status: "draft" | "sent" | "viewed" | "accepted" | "revoked";
  agreement_pdf_path: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  invite_url: string;
};

type FilterKey = "all" | "draft" | "sent" | "accepted" | "revoked";

export default function AdminFoundingPage() {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogInitial, setDialogInitial] = useState<Partial<FoundingInviteFormValues> | null>(null);

  const [sendTarget, setSendTarget] = useState<InviteRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InviteRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/founding-invite", { cache: "no-store" });
      const body = (await res.json()) as { rows?: InviteRow[]; error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        setRows([]);
        return;
      }
      setRows(body.rows ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      draft: rows.filter((r) => r.status === "draft").length,
      sent: rows.filter((r) => r.status === "sent" || r.status === "viewed").length,
      accepted: rows.filter((r) => r.status === "accepted").length,
      revoked: rows.filter((r) => r.status === "revoked").length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "sent") return rows.filter((r) => r.status === "sent" || r.status === "viewed");
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const openCreate = () => {
    setDialogMode("create");
    setDialogInitial(null);
    setDialogOpen(true);
  };

  const openEdit = (r: InviteRow) => {
    setDialogMode("edit");
    setDialogInitial({
      id: r.id,
      role: r.role,
      pricing_plan: r.pricing_plan ?? "ladder",
      full_name: r.full_name,
      email: r.email,
      company_name: r.company_name ?? "",
      member_offer: r.member_offer ?? "",
      website: r.website ?? "",
      category: r.category ?? "",
      calendar_link: r.calendar_link ?? "",
      description: r.description ?? "",
      phone: r.phone ?? "",
      secondary_email: r.secondary_email ?? "",
      secondary_phone: r.secondary_phone ?? "",
      signer_name: r.signer_name ?? "",
      signer_title: r.signer_title ?? "",
      notes: r.notes ?? "",
      additionalCompanies: (r.companies ?? []).slice(1).map((c) => ({
        name: c.name ?? "",
        category: c.category ?? "",
        member_offer: c.member_offer ?? "",
        contact_email: c.contact_email ?? "",
      })),
    });
    setDialogOpen(true);
  };

  const doSend = async (r: InviteRow) => {
    setBusyId(r.id);
    setSendTarget(null);
    try {
      const res = await fetch(`/api/admin/founding-invite/${r.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; emailed?: boolean; warning?: string };
      if (!res.ok || body.error) {
        setToast(body.error ?? `Send failed (${res.status})`);
        return;
      }
      setToast(body.warning ?? `Invite emailed to ${r.email}.`);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setBusyId(null);
    }
  };

  const doRevoke = async (r: InviteRow) => {
    setBusyId(r.id);
    setRevokeTarget(null);
    try {
      const res = await fetch(`/api/admin/founding-invite/${r.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        setToast(body.error ?? `Revoke failed (${res.status})`);
        return;
      }
      setToast(`Invite for ${r.full_name} revoked.`);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (r: InviteRow) => {
    try {
      await navigator.clipboard.writeText(r.invite_url);
      setToast("Private link copied.");
    } catch {
      setToast(r.invite_url);
    }
  };

  const doNotify = async (r: InviteRow) => {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/admin/founding-invite/${r.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "notify_team" }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; emailed?: boolean; kind?: string };
      if (!res.ok || body.error) {
        setToast(body.error ?? `Notify failed (${res.status})`);
        return;
      }
      const what = body.kind === "invite_accepted" ? "acceptance" : "invite";
      setToast(body.emailed ? `Team emailed about ${r.full_name}'s ${what}.` : "Sent, but the email transport didn't confirm.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Notify failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Stack spacing={4}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" } }}
      >
        <Box>
          <Typography variant="overline" sx={{ display: "block" }}>
            PEOPLE
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Founding invites
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Hand-picked founding companies &amp; experts. Adding one saves a{" "}
            <strong>draft</strong> only. Nothing is emailed. Review the details, then click{" "}
            <strong>Send invite</strong> to email their private link with a personalized
            agreement. They accept through it; company roles save a card for the ramp.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddAlt1OutlinedIcon />}
          onClick={openCreate}
          sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
        >
          New founding invite
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={filter}
          onChange={(_, val) => setFilter(val)}
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.95rem" },
            "& .Mui-selected": { color: "primary.main" },
            "& .MuiTabs-indicator": { backgroundColor: "secondary.main", height: 3, borderRadius: 999 },
          }}
        >
          {(["all", "draft", "sent", "accepted", "revoked"] as FilterKey[]).map((k) => (
            <Tab
              key={k}
              value={k}
              label={`${k === "all" ? "All" : k[0].toUpperCase() + k.slice(1)} (${counts[k]})`}
            />
          ))}
        </Tabs>
      </Box>

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={26} />
        </Stack>
      ) : filtered.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 4 }}>No invites here yet.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((r) => (
            <InviteCard
              key={r.id}
              row={r}
              busy={busyId === r.id}
              onSend={() => setSendTarget(r)}
              onEdit={() => openEdit(r)}
              onCopy={() => copyLink(r)}
              onNotify={() => doNotify(r)}
              onRevoke={() => setRevokeTarget(r)}
            />
          ))}
        </Stack>
      )}

      <FoundingInviteDialog
        open={dialogOpen}
        mode={dialogMode}
        initial={dialogInitial}
        onClose={() => setDialogOpen(false)}
        onSaved={(name) => {
          setDialogOpen(false);
          setToast(dialogMode === "edit" ? `Saved ${name}.` : `Draft saved for ${name}. Send it when ready.`);
          void load();
        }}
      />

      {/* Send confirmation — this emails a real person. */}
      <Dialog open={!!sendTarget} onClose={() => setSendTarget(null)}>
        <DialogTitle>Send founding invite?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This emails <strong>{sendTarget?.email}</strong> their private invite link with a
            personalized {roleLabel(sendTarget?.role)} agreement attached. They&apos;ll be able to
            review and accept it. Company roles will save a card. Send it now?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSendTarget(null)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => sendTarget && doSend(sendTarget)}
            startIcon={<SendOutlinedIcon />}
            sx={{ textTransform: "none" }}
          >
            Send invite
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke confirmation. */}
      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)}>
        <DialogTitle>Revoke this invite?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The private link for <strong>{revokeTarget?.full_name}</strong> will stop working
            immediately. This can&apos;t be undone; you&apos;d create a fresh draft to invite them
            again.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRevokeTarget(null)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => revokeTarget && doRevoke(revokeTarget)}
            sx={{ textTransform: "none" }}
          >
            Revoke
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}

function InviteCard({
  row,
  busy,
  onSend,
  onEdit,
  onCopy,
  onNotify,
  onRevoke,
}: {
  row: InviteRow;
  busy: boolean;
  onSend: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onNotify: () => void;
  onRevoke: () => void;
}) {
  const terminal = row.status === "accepted" || row.status === "revoked";
  // The team alert can be re-fired once an invite has actually gone out
  // (sent / viewed / accepted) — not for drafts or revoked invites.
  const canNotify = row.status === "sent" || row.status === "viewed" || row.status === "accepted";
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: { xs: 2, sm: 2.5 },
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 2,
        alignItems: { md: "center" },
        justifyContent: "space-between",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
          <Typography sx={{ fontWeight: 700 }}>{row.full_name}</Typography>
          <Chip
            label={roleLabel(row.role)}
            size="small"
            sx={{ height: 20, fontSize: "0.66rem", fontWeight: 700, bgcolor: "rgba(14,42,61,0.06)" }}
          />
          <Chip
              label={
                row.role === "expert"
                  ? "12 mo free, then $39"
                  : row.pricing_plan === "ladder"
                    ? `$39 x 12, then $149${row.role === "both" ? " (expert: 12 mo free, then $39)" : ""}`
                    : `$39 flat${row.role === "both" ? " (expert: 12 mo free, then $39)" : ""}`
              }
              size="small"
              sx={{
                height: 20,
                fontSize: "0.66rem",
                fontWeight: 700,
                bgcolor: row.pricing_plan === "ladder" ? "rgba(160,120,35,0.12)" : "rgba(44,122,82,0.12)",
                color: row.pricing_plan === "ladder" ? "#7A5B17" : "#1F5238",
              }}
          />
          <StatusChip status={row.status} />
        </Stack>
        <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
          {row.email}
          {row.company_name ? ` · ${row.company_name}` : ""}
        </Typography>
        {row.member_offer && (
          <Typography sx={{ color: "text.secondary", fontSize: "0.8rem", mt: 0.5 }}>
            Offer: {row.member_offer}
          </Typography>
        )}
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", flexShrink: 0 }}>
        {!terminal && (
          <Button
            size="small"
            variant="contained"
            onClick={onSend}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={13} sx={{ color: "inherit" }} /> : <SendOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none" }}
          >
            {row.status === "draft" ? "Send invite" : "Resend"}
          </Button>
        )}
        {!terminal && (
          <Button size="small" variant="outlined" onClick={onEdit} disabled={busy} startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: "none" }}>
            Edit
          </Button>
        )}
        {row.status !== "draft" && (
          <Button size="small" variant="text" onClick={onCopy} startIcon={<LinkRoundedIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: "none" }}>
            Copy link
          </Button>
        )}
        {canNotify && (
          <Button
            size="small"
            variant="text"
            onClick={onNotify}
            disabled={busy}
            startIcon={<ForwardToInboxOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none" }}
          >
            {row.status === "accepted" ? "Notify team of acceptance" : "Notify team"}
          </Button>
        )}
        {!terminal && (
          <Button size="small" color="error" variant="text" onClick={onRevoke} disabled={busy} startIcon={<BlockOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: "none" }}>
            Revoke
          </Button>
        )}
      </Stack>
    </Box>
  );
}

function StatusChip({ status }: { status: InviteRow["status"] }) {
  const map: Record<InviteRow["status"], { bg: string; color: string; label: string }> = {
    draft: { bg: "rgba(14,42,61,0.08)", color: "#3B4A55", label: "Draft" },
    sent: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "Sent" },
    viewed: { bg: "rgba(43,108,176,0.14)", color: "#1F5C8C", label: "Viewed" },
    accepted: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "Accepted" },
    revoked: { bg: "rgba(140,29,29,0.10)", color: "#8C1D1D", label: "Revoked" },
  };
  const s = map[status];
  return <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.66rem", height: 20 }} />;
}

function roleLabel(role?: FoundingInviteRoleValue): string {
  if (role === "both") return "Expert + Partner";
  if (role === "expert") return "Expert";
  return "Company";
}
