"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import PauseCircleOutlinedIcon from "@mui/icons-material/PauseCircleOutlined";
import PlayCircleOutlinedIcon from "@mui/icons-material/PlayCircleOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import DomainAddOutlinedIcon from "@mui/icons-material/DomainAddOutlined";
import AddCompanyDialog from "@/components/admin/AddCompanyDialog";
import { normalizeVendorPlan, vendorPlanChipLabel, vendorRamp } from "@/lib/vendorPricing";

type VendorRow = {
  id: string;
  company_name: string;
  display_name: string;
  category: string | null;
  contact_name: string;
  contact_email: string;
  plan_id: string | null;
  billing_plan: "ladder" | "flat" | null;
  status: "pending_review" | "approved" | "rejected" | "suspended" | "churned";
  verified: boolean;
  billing_parent_id: string | null;
  created_at: string;
};

type FilterKey = "all" | "pending_review" | "approved" | "suspended" | "rejected";
type ActionKey = "approve" | "reject" | "suspend" | "unsuspend" | "grant_login";

export default function AdminVendorsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const initial = (params.get("filter") as FilterKey) || "all";
  const [filter, setFilter] = useState<FilterKey>(initial);
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileVendorId, setProfileVendorId] = useState<string | null>(null);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/vendors", { cache: "no-store" });
      const body = (await res.json()) as { rows?: VendorRow[]; error?: string };
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

  const runAction = async (vendorId: string, action: ActionKey, plan?: "ladder" | "flat") => {
    setActingId(vendorId);
    try {
      const res = await fetch("/api/admin/vendors", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: vendorId, action, rate: plan }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || body.error) {
        setToast(body.error ?? `Action failed (${res.status})`);
        return;
      }
      if (action === "grant_login") {
        setToast(body.message ?? "Portal access granted.");
        await load();
        return;
      }
      const verb =
        action === "approve"
          ? `approved on the ${plan === "flat" ? "$39 flat" : "$39 x 12, then $149"} plan. Approval email sent; they accept the agreement and save a card in the portal`
          : action === "reject"
            ? "rejected"
            : action === "suspend"
              ? "suspended"
              : "reinstated";
      setToast(`Company ${verb}.`);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending_review: rows.filter((r) => r.status === "pending_review").length,
      approved: rows.filter((r) => r.status === "approved").length,
      suspended: rows.filter((r) => r.status === "suspended").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    }),
    [rows],
  );

  return (
    <Stack spacing={4}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" } }}
      >
        <Box>
          <Typography variant="overline" sx={{ display: "block" }}>
            COMPANIES
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            All companies
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
            Approve new applications and manage active partners. To onboard a
            hand-picked company or expert privately, use{" "}
            <strong>Founding invites</strong>. It saves a draft, then you send
            their personalized agreement link when ready.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flexShrink: 0 }}>
          <Button
            variant="outlined"
            startIcon={<ImageOutlinedIcon />}
            onClick={() => {
              setProfileVendorId(null);
              setProfileOpen(true);
            }}
            sx={{ whiteSpace: "nowrap" }}
          >
            Profile &amp; logo
          </Button>
          <Button
            variant="outlined"
            startIcon={<DomainAddOutlinedIcon />}
            onClick={() => setAddCompanyOpen(true)}
            sx={{ whiteSpace: "nowrap" }}
          >
            Add a covered company
          </Button>
          <Button
            component={Link}
            href="/admin/founding"
            variant="contained"
            startIcon={<PersonAddAlt1OutlinedIcon />}
            sx={{ whiteSpace: "nowrap" }}
          >
            Founding invites
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={filter}
          onChange={(_, v) => setFilter(v)}
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.95rem" },
            "& .Mui-selected": { color: "primary.main" },
            "& .MuiTabs-indicator": { backgroundColor: "secondary.main", height: 3, borderRadius: 999 },
          }}
        >
          {(["all", "pending_review", "approved", "suspended", "rejected"] as FilterKey[]).map((k) => (
            <Tab
              key={k}
              value={k}
              label={
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Box sx={{ textTransform: "capitalize" }}>{labelForFilter(k)}</Box>
                  <Chip
                    size="small"
                    label={counts[k]}
                    sx={{
                      height: 20,
                      fontSize: "0.7rem",
                      bgcolor: filter === k ? "rgba(217,168,75,0.18)" : "grey.100",
                      color: filter === k ? "#A07823" : "text.secondary",
                      fontWeight: 700,
                    }}
                  />
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Box>

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
            gridTemplateColumns: "1.8fr 1.2fr 0.9fr 0.9fr 0.8fr 1.2fr",
            alignItems: "center",
            gap: 2,
            px: 3,
            py: 1.5,
            bgcolor: "grey.50",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Cell head>Company</Cell>
          <Cell head>Category</Cell>
          <Cell head>Plan</Cell>
          <Cell head>Status</Cell>
          <Cell head>Verified</Cell>
          <Box />
        </Box>

        {loading ? (
          <Box sx={{ p: 6, display: "grid", placeItems: "center" }}>
            <CircularProgress size={24} sx={{ color: "#A07823" }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <Typography sx={{ color: "text.secondary" }}>No companies in this view.</Typography>
          </Box>
        ) : (
          filtered.map((v, i) => (
            <Box
              key={v.id}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr auto", md: "1.8fr 1.2fr 0.9fr 0.9fr 0.8fr 1.2fr" },
                alignItems: "center",
                gap: 2,
                px: { xs: 2.5, md: 3 },
                py: 2,
                borderBottom: i === filtered.length - 1 ? 0 : "1px solid",
                borderColor: "divider",
                "&:hover": { bgcolor: "grey.50" },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 600 }} noWrap>
                  {v.company_name}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary" }} noWrap>
                  {v.contact_name} · {v.contact_email}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ display: { xs: "flex", md: "none" }, mt: 0.75, flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                  <StatusChip status={v.status} />
                  <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }}>
                    {v.category ?? ""}
                  </Typography>
                </Stack>
              </Box>
              <Cell>
                <Box sx={{ display: { xs: "none", md: "block" }, fontSize: "0.85rem" }} component="span">
                  {v.category ?? ""}
                </Box>
              </Cell>
              <Cell>
                <Stack direction="row" sx={{ display: { xs: "none", md: "flex" }, flexWrap: "wrap", gap: 0.5 }}>
                  <Chip
                    label={planLabel(v.plan_id)}
                    size="small"
                    sx={{
                      bgcolor: "rgba(14,42,61,0.07)",
                      color: "primary.dark",
                      fontWeight: 700,
                      fontSize: "0.68rem",
                      height: 22,
                      textTransform: "capitalize",
                    }}
                  />
                  {!v.billing_parent_id && (
                    <Tooltip title={vendorRamp(normalizeVendorPlan(v.billing_plan)).summary}>
                      <Chip
                        label={vendorPlanChipLabel(v.billing_plan)}
                        size="small"
                        sx={{
                          bgcolor: v.billing_plan === "flat" ? "rgba(44,122,82,0.12)" : "rgba(14,42,61,0.05)",
                          color: v.billing_plan === "flat" ? "#1F5238" : "text.secondary",
                          fontWeight: 700,
                          fontSize: "0.68rem",
                          height: 22,
                        }}
                      />
                    </Tooltip>
                  )}
                </Stack>
              </Cell>
              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <StatusChip status={v.status} />
              </Box>
              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <Chip
                  label={v.verified ? "Verified" : "Unverified"}
                  size="small"
                  sx={{
                    bgcolor: v.verified ? "rgba(34,108,78,0.12)" : "rgba(14,42,61,0.06)",
                    color: v.verified ? "#1F5C40" : "text.secondary",
                    fontWeight: 700,
                    fontSize: "0.68rem",
                    height: 22,
                  }}
                />
              </Box>
              <Stack direction="row" sx={{ justifyContent: "flex-end", gap: 0.5, alignItems: "center" }}>
                <Tooltip title="Edit profile & logo (headshot, description…)">
                  <IconButton
                    size="small"
                    sx={{ color: "#A07823" }}
                    onClick={() => {
                      setProfileVendorId(v.id);
                      setProfileOpen(true);
                    }}
                  >
                    <ImageOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {actingId === v.id ? (
                  <CircularProgress size={18} sx={{ color: "#A07823" }} />
                ) : (
                  <>
                    {v.status === "pending_review" && (
                      <>
                        <ApproveMenu onPick={(plan) => void runAction(v.id, "approve", plan)} />
                        <Tooltip title="Reject">
                          <IconButton
                            size="small"
                            sx={{ color: "error.main" }}
                            onClick={() => runAction(v.id, "reject")}
                          >
                            <CancelOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {v.plan_id === "covered" && (
                      <Tooltip title="Grant portal access (creates their login; nothing is emailed)">
                        <IconButton
                          size="small"
                          sx={{ color: "#A07823" }}
                          onClick={() => runAction(v.id, "grant_login")}
                        >
                          <VpnKeyOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {v.status === "approved" && (
                      <Tooltip title="Suspend">
                        <IconButton
                          size="small"
                          sx={{ color: "text.secondary" }}
                          onClick={() => runAction(v.id, "suspend")}
                        >
                          <PauseCircleOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {v.status === "suspended" && (
                      <Tooltip title="Reinstate">
                        <IconButton
                          size="small"
                          sx={{ color: "success.dark" }}
                          onClick={() => runAction(v.id, "unsuspend")}
                        >
                          <PlayCircleOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {v.status === "rejected" && (
                      <ApproveMenu onPick={(plan) => void runAction(v.id, "approve", plan)} />
                    )}
                  </>
                )}
              </Stack>
            </Box>
          ))
        )}
      </Box>

      {filter === "pending_review" && counts.pending_review > 0 && (
        <Stack direction="row" spacing={1.5} sx={{ p: 2.5, borderRadius: "14px", bgcolor: "rgba(217,168,75,0.08)", border: "1px solid rgba(217,168,75,0.32)" }}>
          <Typography variant="body2" sx={{ flex: 1, color: "text.primary", fontSize: "0.92rem" }}>
            <strong>{counts.pending_review} pending application{counts.pending_review === 1 ? "" : "s"}.</strong> SLA: review within 1 business day. Approving sends the &ldquo;You&apos;re verified&rdquo; email; the company signs in, accepts the agreement and saves a card in the portal. Bulk approve uses the $39 x 12 then $149 plan.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="small"
            disabled={!!actingId}
            onClick={async () => {
              const pending = rows.filter((r) => r.status === "pending_review");
              for (const v of pending) {
                // eslint-disable-next-line no-await-in-loop
                await runAction(v.id, "approve", "ladder");
              }
            }}
          >
            Bulk approve
          </Button>
        </Stack>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

      <VendorProfileDialog
        open={profileOpen}
        initialVendorId={profileVendorId}
        onClose={() => setProfileOpen(false)}
        onSaved={(msg) => {
          setProfileOpen(false);
          setToast(msg);
        }}
      />

      <AddCompanyDialog
        open={addCompanyOpen}
        payers={rows
          .filter((r) => !r.billing_parent_id && r.status !== "rejected" && r.status !== "churned")
          .map((r) => ({ id: r.id, company_name: r.company_name }))}
        onClose={() => setAddCompanyOpen(false)}
        onSaved={(name) => {
          setAddCompanyOpen(false);
          setToast(`${name} added as a covered company. Approve it to publish.`);
          void load();
        }}
      />
    </Stack>
  );
}
function labelForFilter(k: FilterKey): string {
  if (k === "pending_review") return "Pending";
  if (k === "approved") return "Approved";
  if (k === "suspended") return "Suspended";
  if (k === "rejected") return "Rejected";
  return "All";
}

function planLabel(planId: string | null): string {
  if (planId === "founding") return "Founding";
  if (planId === "annual") return "Annual";
  if (planId === "covered") return "Covered";
  return "Standard";
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

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending_review: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "Pending" },
    approved: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "Approved" },
    suspended: { bg: "rgba(140,29,29,0.12)", color: "#8C1D1D", label: "Suspended" },
    rejected: { bg: "rgba(140,29,29,0.08)", color: "#8C1D1D", label: "Rejected" },
    churned: { bg: "rgba(14,42,61,0.06)", color: "text.secondary", label: "Churned" },
  };
  const s = map[status] ?? map.pending_review;
  return (
    <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.68rem", height: 22 }} />
  );
}


/** Edit a partner's PUBLIC profile — the logo + description the publish
 *  gate requires (a partner is invisible in the directories without
 *  both), plus category / website / booking link. */
function VendorProfileDialog({
  open,
  initialVendorId = null,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialVendorId?: string | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [vendors, setVendors] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [calendarLink, setCalendarLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Opening from a row lands directly on that partner; the header button
  // opens blank for the dropdown.
  useEffect(() => {
    if (open) setVendorId(initialVendorId ?? "");
  }, [open, initialVendorId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/admin/invite-links?owners=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { partners?: { id: string; name: string; email: string | null }[] } | null) => {
        if (active && d?.partners) setVendors(d.partners);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!vendorId) return;
    let active = true;
    fetch(`/api/admin/vendors/profile?id=${vendorId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { vendor?: { display_name: string | null; company_name: string | null; category: string | null; description: string | null; website: string | null; calendar_link: string | null; logo_url: string | null } } | null) => {
        if (!active || !d?.vendor) return;
        setDisplayName(d.vendor.display_name ?? d.vendor.company_name ?? "");
        setCategory(d.vendor.category ?? "");
        setDescription(d.vendor.description ?? "");
        setWebsite(d.vendor.website ?? "");
        setCalendarLink(d.vendor.calendar_link ?? "");
        setCurrentLogo(d.vendor.logo_url);
        setFile(null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [vendorId]);

  const save = async () => {
    if (!vendorId) return;
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.set("vendor_id", vendorId);
      if (displayName.trim()) form.set("display_name", displayName.trim());
      if (category.trim()) form.set("category", category.trim());
      if (description.trim()) form.set("description", description.trim());
      if (website.trim()) form.set("website", website.trim());
      if (calendarLink.trim()) form.set("calendar_link", calendarLink.trim());
      if (file) form.set("logo", file);
      const res = await fetch("/api/admin/vendors/profile", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string; publishReady?: boolean };
      if (!res.ok) {
        setErr(body.error ?? "Couldn't save the profile.");
        return;
      }
      onSaved(
        body.publishReady
          ? "Profile saved. Logo and description present and the company is live in the directories."
          : "Profile saved. The company stays hidden until it is approved and verified AND has a logo and description.",
      );
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Company profile &amp; logo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
            A company only appears in the directories once approved + verified AND with BOTH a logo
            and a description. This is where the team supplies the missing pieces.
          </Typography>
          <TextField
            select
            label="Company"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            fullWidth
            size="small"
          >
            {vendors.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {v.name}
                {v.email ? ` · ${v.email}` : ""}
              </MenuItem>
            ))}
          </TextField>
          {vendorId && (
            <>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                {currentLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentLogo} alt="Current logo" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "contain", border: "1px solid #E0DACE", background: "#fff" }} />
                ) : (
                  <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: "rgba(160,120,35,0.14)", display: "grid", placeItems: "center", fontSize: "0.7rem", fontWeight: 800, color: "#A07823" }}>
                    NONE
                  </Box>
                )}
                <Button variant="outlined" component="label" size="small" sx={{ textTransform: "none", fontWeight: 700 }}>
                  {file ? file.name : "Choose logo image…"}
                  <input hidden type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </Button>
              </Stack>
              <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth size="small" />
              <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth size="small" />
              <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={4} size="small" />
              <TextField label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} fullWidth size="small" />
              <TextField label="Booking / calendar link" value={calendarLink} onChange={(e) => setCalendarLink(e.target.value)} fullWidth size="small" />
            </>
          )}
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!vendorId || busy}
          onClick={() => void save()}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Approve & verify with the company plan chosen at approval. Both start
 * with 6 free months from the member launch; the plan is what the
 * agreement, the welcome email and the portal all show afterwards.
 */
function ApproveMenu({ onPick }: { onPick: (plan: "ladder" | "flat") => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title="Approve & verify (choose the plan)">
        <IconButton size="small" sx={{ color: "success.dark" }} onClick={(e) => setAnchor(e.currentTarget)}>
          <CheckCircleOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onPick("ladder");
          }}
        >
          Approve: $39 a month for 12 months, then $149
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onPick("flat");
          }}
        >
          Approve: $39 a month flat, no increase
        </MenuItem>
      </Menu>
    </>
  );
}
