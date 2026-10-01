"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Grid,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";

// Shape mirrors the columns selected by /api/admin/experts (a Pick of
// ExpertApplicationsRow, not the full row).
type ExpertRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  specialty: string;
  topics: string | null;
  website: string | null;
  booking_link: string | null;
  source: string | null;
  status: "new" | "reviewing" | "invited" | "declined" | "onboarded";
  created_at: string;
  contacted_at: string | null;
  notes: string | null;
};

type FilterKey = "all" | "new" | "reviewing" | "declined" | "onboarded";
type ActionKey = "start_review" | "decline" | "mark_onboarded" | "reset";

export default function AdminExpertsPage() {
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
  const [rows, setRows] = useState<ExpertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Founding-expert billing exemption: the first 20 real experts are free
  // for life. `exemptEmails` marks who already has it; `slots` drives the
  // "N of 20 left" counter. Keyed by email because this page lists
  // expert_applications while the flag lives on the `experts` row.
  const [slots, setSlots] = useState<{ cap: number; used: number; remaining: number } | null>(null);
  const [exemptEmails, setExemptEmails] = useState<Set<string>>(new Set());

  const loadSlots = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/experts/billing", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as {
        cap: number; used: number; remaining: number;
        experts?: { email: string }[];
      };
      setSlots({ cap: body.cap, used: body.used, remaining: body.remaining });
      setExemptEmails(new Set((body.experts ?? []).map((e) => e.email.toLowerCase())));
    } catch {
      /* counter is informational — never block the page on it */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/experts", { cache: "no-store" });
      const body = (await res.json()) as { rows?: ExpertRow[]; error?: string };
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
    void loadSlots();
  }, [load, loadSlots]);

  /**
   * Grant the billing exemption (manual admin override, never charged).
   * Expert-side only — if they also run a company, that company keeps
   * paying normally. The cap of 20 is enforced by a DB trigger, so a 409
   * here is expected once the slots run out and is shown as a normal
   * message. Founding invites do NOT use this: a founding expert gets 12
   * months free, then $39 a month.
   */
  const grantFree = async (email: string, name: string) => {
    if (
      !confirm(
        `Make ${name} billing-exempt (manual override)?\n\nThey will never be charged and never asked for a card. This cannot be undone.\n\nThis is not the founding expert offer (first 6 months free from the member launch, then $39 a month); use a founding invite for that.\n\nIf they also list a company, that company keeps paying normally.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/admin/experts/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: "grant_free" }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? `Could not grant (${res.status})`);
        return;
      }
      setToast(body.message ?? `${name} is now billing-exempt.`);
      setError(null);
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grant the exemption.");
    }
  };

  const runAction = async (expertId: string, action: ActionKey) => {
    setActingId(expertId);
    try {
      const res = await fetch("/api/admin/experts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: expertId, action }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        setToast(body.error ?? `Action failed (${res.status})`);
        return;
      }
      const verb =
        action === "start_review"
          ? "marked as reviewing"
          : action === "decline"
            ? "declined"
            : action === "mark_onboarded"
              ? "approved: approval email and agreement sent. The portal opens once they accept."
              : "reset";
      setToast(`Application ${verb}.`);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "reviewing") {
      // Treat legacy `invited` rows as reviewing in the new flow.
      return rows.filter(
        (r) => r.status === "reviewing" || r.status === "invited",
      );
    }
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      new: rows.filter((r) => r.status === "new").length,
      // Bucket any legacy `invited` rows together with `reviewing` so the
      // admin can still find them — `invited` is no longer surfaced as a
      // separate workflow step.
      reviewing: rows.filter(
        (r) => r.status === "reviewing" || r.status === "invited",
      ).length,
      declined: rows.filter((r) => r.status === "declined").length,
      onboarded: rows.filter((r) => r.status === "onboarded").length,
    }),
    [rows],
  );

  return (
    <Stack spacing={4}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { md: "flex-start" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="overline" sx={{ display: "block" }}>
            EXPERTS
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            All expert applications
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 720 }}>
            Coaches, consultants, and educators applying to join the Founding
            Expert Bench. Triage new applications and onboard the ones you
            want. Onboarding activates the portal and sends the welcome email.
          </Typography>
          {/* Billing-exemption slots (INTERNAL ONLY, manual override, max
              20). Founding invites do not use these: every expert, founding
              invite or website signup, gets the first 6 months free from the
              member launch, then $39 a month with no increase. */}
          {slots && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1.5 }}>
              <WorkspacePremiumOutlinedIcon fontSize="small" sx={{ color: slots.remaining > 0 ? "#A07823" : "text.disabled" }} />
              <Typography sx={{ fontSize: "0.86rem", color: "text.secondary" }}>
                {slots.remaining > 0 ? (
                  <>
                    <Box component="strong" sx={{ color: "text.primary" }}>
                      {slots.remaining} of {slots.cap}
                    </Box>{" "}
                    billing-exemption overrides left ({slots.used} granted). Every other expert: first 6 months free from the member launch, then $39 a month with no increase.
                  </>
                ) : (
                  <>
                    All {slots.cap} billing-exemption overrides used. Every other expert: first 6 months free from the member launch, then $39 a month with no increase.
                  </>
                )}
              </Typography>
            </Stack>
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setAddOpen(true)}
          sx={{
            flexShrink: 0,
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 999,
            px: 2.5,
            py: 1,
            bgcolor: "#0E2A3D",
            color: "#FFFFFF",
            "&:hover": { bgcolor: "#1B4258" },
          }}
        >
          Add expert
        </Button>
        <Button
          variant="outlined"
          onClick={() => setProfileOpen(true)}
          sx={{
            flexShrink: 0,
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 999,
            px: 2.5,
            py: 1,
            borderColor: "#0E2A3D",
            color: "#0E2A3D",
            "&:hover": { borderColor: "#1B4258", bgcolor: "rgba(14,42,61,0.04)" },
          }}
        >
          Profile &amp; headshot
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={filter}
          onChange={(_, v) => setFilter(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.95rem" },
            "& .Mui-selected": { color: "primary.main" },
            "& .MuiTabs-indicator": { backgroundColor: "secondary.main", height: 3, borderRadius: 999 },
          }}
        >
          {(["all", "new", "reviewing", "declined", "onboarded"] as FilterKey[]).map((k) => (
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
            gridTemplateColumns: "1.8fr 1.7fr 0.9fr 0.9fr 1.2fr",
            alignItems: "center",
            gap: 2,
            px: 3,
            py: 1.5,
            bgcolor: "grey.50",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Cell head>Applicant</Cell>
          <Cell head>Specialty</Cell>
          <Cell head>Source</Cell>
          <Cell head>Status</Cell>
          <Box />
        </Box>

        {loading ? (
          <Box sx={{ p: 6, display: "grid", placeItems: "center" }}>
            <CircularProgress size={24} sx={{ color: "#A07823" }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <Typography sx={{ color: "text.secondary" }}>
              No expert applications in this view.
            </Typography>
          </Box>
        ) : (
          filtered.map((v, i) => {
            const isExpanded = expandedId === v.id;
            const toggleExpanded = () => setExpandedId(isExpanded ? null : v.id);
            return (
              <Box
                key={v.id}
                sx={{
                  borderBottom: i === filtered.length - 1 ? 0 : "1px solid",
                  borderColor: "divider",
                  bgcolor: isExpanded ? "grey.50" : "transparent",
                  transition: "background-color 150ms ease",
                }}
              >
                <Box
                  onClick={toggleExpanded}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpanded();
                    }
                  }}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr auto",
                      md: "1.8fr 1.7fr 0.9fr 0.9fr 1.2fr",
                    },
                    alignItems: "center",
                    gap: 2,
                    px: { xs: 2.5, md: 3 },
                    py: 2,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "grey.50" },
                    "&:focus-visible": {
                      outline: "2px solid #A07823",
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.92rem", fontWeight: 600 }} noWrap>
                      {v.full_name}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontSize: "0.78rem", color: "text.secondary" }}
                      noWrap
                    >
                      {v.email}
                      {v.company_name ? ` · ${v.company_name}` : ""}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{
                        display: { xs: "flex", md: "none" },
                        mt: 0.75,
                        flexWrap: "wrap",
                        gap: 0.5,
                        alignItems: "center",
                      }}
                    >
                      <StatusChip status={v.status} />
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.74rem", color: "text.secondary" }}
                        noWrap
                      >
                        {v.specialty}
                      </Typography>
                    </Stack>
                  </Box>
                  <Cell>
                    <Box
                      sx={{
                        display: { xs: "none", md: "block" },
                        fontSize: "0.85rem",
                        lineHeight: 1.4,
                      }}
                      component="span"
                    >
                      {v.specialty}
                    </Box>
                  </Cell>
                  <Cell>
                    <Box sx={{ display: { xs: "none", md: "inline-block" } }}>
                      <Chip
                        label={shortSource(v.source)}
                        size="small"
                        sx={{
                          bgcolor: "rgba(14,42,61,0.07)",
                          color: "primary.dark",
                          fontWeight: 700,
                          fontSize: "0.68rem",
                          height: 22,
                        }}
                      />
                    </Box>
                  </Cell>
                  <Box sx={{ display: { xs: "none", md: "block" } }}>
                    <StatusChip status={v.status} />
                  </Box>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "flex-end", gap: 0.5, alignItems: "center" }}
                    // Stop the row-level click from firing when the user
                    // hits one of the action buttons.
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actingId === v.id ? (
                      <CircularProgress size={18} sx={{ color: "#A07823" }} />
                    ) : (
                      <RowActions
                        status={v.status}
                        onAction={(a) => runAction(v.id, a)}
                        isExempt={exemptEmails.has(v.email.toLowerCase())}
                        slotsLeft={slots?.remaining ?? null}
                        onGrantFree={() => grantFree(v.email, v.full_name || v.email)}
                      />
                    )}
                  </Stack>
                </Box>
                {isExpanded && <ExpertDetails row={v} />}
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

      <AddExpertDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={async (name) => {
          setAddOpen(false);
          setToast(
            `${name} onboarded, portal activated and welcome email sent.`,
          );
          await load();
        }}
        onError={(msg) => setToast(msg)}
      />

      <ExpertProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={(msg) => {
          setProfileOpen(false);
          setToast(msg);
        }}
      />
    </Stack>
  );
}

/** Edit an existing expert's PUBLIC profile — the headshot + bio the
 *  publish gate requires (an expert is invisible on /experts without
 *  both), plus specialty / website / booking link. */
function ExpertProfileDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [experts, setExperts] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [expertId, setExpertId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [bookingLink, setBookingLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [currentHeadshot, setCurrentHeadshot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/admin/invite-links?owners=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { experts?: { id: string; name: string; email: string | null }[] } | null) => {
        if (active && d?.experts) setExperts(d.experts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!expertId) return;
    let active = true;
    fetch(`/api/admin/experts/profile?id=${expertId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { expert?: { display_name: string | null; specialty: string | null; bio: string | null; website: string | null; booking_link: string | null; headshot_url: string | null } } | null) => {
        if (!active || !d?.expert) return;
        setDisplayName(d.expert.display_name ?? "");
        setSpecialty(d.expert.specialty ?? "");
        setBio(d.expert.bio ?? "");
        setWebsite(d.expert.website ?? "");
        setBookingLink(d.expert.booking_link ?? "");
        setCurrentHeadshot(d.expert.headshot_url);
        setFile(null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [expertId]);

  const save = async () => {
    if (!expertId) return;
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.set("expert_id", expertId);
      if (displayName.trim()) form.set("display_name", displayName.trim());
      if (specialty.trim()) form.set("specialty", specialty.trim());
      if (bio.trim()) form.set("bio", bio.trim());
      if (website.trim()) form.set("website", website.trim());
      if (bookingLink.trim()) form.set("booking_link", bookingLink.trim());
      if (file) form.set("headshot", file);
      const res = await fetch("/api/admin/experts/profile", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string; publishReady?: boolean };
      if (!res.ok) {
        setErr(body.error ?? "Couldn't save the profile.");
        return;
      }
      onSaved(
        body.publishReady
          ? "Profile saved, headshot + bio present, the expert is LIVE on /experts."
          : "Profile saved, still hidden from /experts until BOTH a headshot and a bio are set.",
      );
    } catch {
      setErr("Network error, try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Expert profile &amp; headshot</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
            An expert only appears on the public /experts page once they have BOTH a headshot and a
            bio. This is where you set them.
          </Typography>
          <TextField
            select
            label="Expert"
            value={expertId}
            onChange={(e) => setExpertId(e.target.value)}
            fullWidth
            size="small"
          >
            {experts.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name}
                {e.email ? ` · ${e.email}` : ""}
              </MenuItem>
            ))}
          </TextField>
          {expertId && (
            <>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                {currentHeadshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentHeadshot} alt="Current headshot" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: "rgba(160,120,35,0.14)", display: "grid", placeItems: "center", fontSize: "0.7rem", fontWeight: 800, color: "#A07823" }}>
                    NONE
                  </Box>
                )}
                <Button variant="outlined" component="label" size="small" sx={{ textTransform: "none", fontWeight: 700 }}>
                  {file ? file.name : "Choose headshot image…"}
                  <input hidden type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </Button>
              </Stack>
              <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth size="small" />
              <TextField label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} fullWidth size="small" />
              <TextField label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} fullWidth multiline minRows={4} size="small" />
              <TextField label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} fullWidth size="small" />
              <TextField label="Booking link" value={bookingLink} onChange={(e) => setBookingLink(e.target.value)} fullWidth size="small" />
            </>
          )}
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!expertId || busy}
          onClick={() => void save()}
          sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#0E2A3D", "&:hover": { bgcolor: "#1B4258" } }}
        >
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AddExpertDialog({
  open,
  onClose,
  onAdded,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (name: string) => void;
  onError: (msg: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [bookingLink, setBookingLink] = useState("");
  const [topics, setTopics] = useState("");
  const [bioText, setBioText] = useState("");
  const [headshotFile, setHeadshotFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setFullName("");
    setEmail("");
    setSpecialty("");
    setPhone("");
    setCompanyName("");
    setWebsite("");
    setBookingLink("");
    setTopics("");
    setNotes("");
    setFormError(null);
  };

  const submit = async () => {
    setFormError(null);
    if (!fullName.trim() || !email.trim() || !specialty.trim()) {
      setFormError("Full name, email and specialty are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/experts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          specialty: specialty.trim(),
          phone: phone.trim() || undefined,
          company_name: companyName.trim() || undefined,
          website: website.trim() || undefined,
          booking_link: bookingLink.trim() || undefined,
          bio: bioText.trim() || undefined,
          topics: topics.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        provisioning?: { experts_row?: { id?: string } };
      };
      if (!res.ok || body.error) {
        setFormError(body.error ?? `Failed (${res.status}).`);
        return;
      }
      // One-step onboarding: chain the headshot upload straight onto the
      // freshly created experts row (same endpoint the Profile & headshot
      // dialog uses).
      const newExpertId = body.provisioning?.experts_row?.id;
      if (headshotFile && newExpertId) {
        try {
          const fd = new FormData();
          fd.set("expert_id", newExpertId);
          fd.set("headshot", headshotFile);
          await fetch("/api/admin/experts/profile", { method: "POST", body: fd });
        } catch {
          /* profile dialog remains the fallback */
        }
      }
      const name = fullName.trim();
      reset();
      onAdded(name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add expert.";
      setFormError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!submitting) {
          reset();
          onClose();
        }
      }}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle>Add expert</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: "text.secondary", mb: 2, fontSize: "0.88rem" }}>
          Skips the public application form. Onboards immediately , 
          provisions the portal and sends the welcome email to the address
          below.
        </Typography>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              fullWidth
              required
              autoFocus
              placeholder="Dr. Taylor Morgan"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              type="email"
              placeholder="taylor@coachingco.com"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              fullWidth
              required
              placeholder="Practice growth"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              fullWidth
              placeholder="(555) 000-0000"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Company / brand"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              fullWidth
              placeholder="Optional"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              fullWidth
              placeholder="https://"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Booking link"
              value={bookingLink}
              onChange={(e) => setBookingLink(e.target.value)}
              fullWidth
              placeholder="https://cal.com/..."
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Topics (one per line)"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              placeholder="Optional"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Admin notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              placeholder="Internal notes, not visible to the expert"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={() => {
            if (!submitting) {
              reset();
              onClose();
            }
          }}
          disabled={submitting}
          sx={{ textTransform: "none", color: "text.secondary" }}
        >
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={submitting}
          variant="contained"
          startIcon={
            submitting ? (
              <CircularProgress size={14} sx={{ color: "#FFFFFF" }} />
            ) : null
          }
          sx={{
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 999,
            px: 2.5,
            bgcolor: "#0E2A3D",
            "&:hover": { bgcolor: "#1B4258" },
          }}
        >
          {submitting ? "Adding…" : "Add & onboard"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RowActions({
  status,
  onAction,
  isExempt,
  slotsLeft,
  onGrantFree,
}: {
  status: ExpertRow["status"];
  onAction: (a: ActionKey) => void;
  /** Already billing-exempt (manual admin override). */
  isExempt?: boolean;
  /** Founding slots left (null while loading). 0 hides the grant button. */
  slotsLeft?: number | null;
  onGrantFree?: () => void;
}) {
  // Workflow transitions (simplified — no more `invite` step):
  //   new       → start_review, decline
  //   reviewing → mark_onboarded, decline
  //   invited   → mark_onboarded, decline   (legacy rows only)
  //   declined  → reset (for misclicks)
  //   onboarded → reset (rare; only when undoing an action)
  if (status === "new") {
    return (
      <>
        <Tooltip title="Start review">
          <IconButton size="small" sx={{ color: "primary.main" }} onClick={() => onAction("start_review")}>
            <RateReviewOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Decline">
          <IconButton size="small" sx={{ color: "error.main" }} onClick={() => onAction("decline")}>
            <CancelOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </>
    );
  }
  if (status === "reviewing" || status === "invited") {
    return (
      <>
        <Tooltip title="Approve: sends the approval email and the agreement (card saved on acceptance). The portal opens once they accept.">
          <IconButton size="small" sx={{ color: "success.dark" }} onClick={() => onAction("mark_onboarded")}>
            <SchoolOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Decline">
          <IconButton size="small" sx={{ color: "error.main" }} onClick={() => onAction("decline")}>
            <CancelOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </>
    );
  }
  // declined | onboarded
  return (
    <>
      {/* Billing exemption (manual admin override). Only offered once
          they're onboarded, because the flag lives on the provisioned
          `experts` row, not on the application. Hidden when the 20 slots
          are gone. Not the founding offer (that is the first 6 months free
          from the member launch, then $39, via a founding invite). */}
      {status === "onboarded" &&
        (isExempt ? (
          <Tooltip title="Billing-exempt (manual override). Never charged, never asked for a card. (Their company, if any, still pays.)">
            <WorkspacePremiumOutlinedIcon fontSize="small" sx={{ color: "#2C7A52" }} />
          </Tooltip>
        ) : slotsLeft == null || slotsLeft > 0 ? (
          <Tooltip
            title={`Make billing-exempt (manual override, never charged)${
              slotsLeft == null ? "" : ` (${slotsLeft} of 20 overrides left)`
            }. Not the founding offer. Their company keeps paying normally. Cannot be undone.`}
          >
            <IconButton size="small" sx={{ color: "#A07823" }} onClick={() => onGrantFree?.()}>
              <WorkspacePremiumOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null)}
      <Tooltip title="Reset to new (undo)">
        <IconButton size="small" sx={{ color: "text.secondary" }} onClick={() => onAction("reset")}>
          <RestartAltOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  );
}

function labelForFilter(k: FilterKey): string {
  if (k === "new") return "New";
  if (k === "reviewing") return "Reviewing";
  if (k === "declined") return "Declined";
  if (k === "onboarded") return "Onboarded";
  return "All";
}

function shortSource(source: string | null): string {
  if (!source) return "";
  // The application form passes "experts-page" or "landing-expert-cta".
  if (source === "experts-page") return "Experts page";
  if (source === "landing-expert-cta") return "Home page";
  return source;
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

function ExpertDetails({ row }: { row: ExpertRow }) {
  const fields: Array<{ label: string; value: React.ReactNode; full?: boolean }> = [
    { label: "Email", value: <CopyableValue value={row.email} /> },
    { label: "Phone", value: row.phone ? <CopyableValue value={row.phone} /> : "" },
    { label: "Company", value: row.company_name ?? "" },
    { label: "Source", value: shortSource(row.source) },
    {
      label: "Specialty",
      value: row.specialty,
      full: true,
    },
    {
      label: "Topics",
      value: row.topics ? (
        <Box component="pre" sx={{ m: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>
          {row.topics}
        </Box>
      ) : (
        ""
      ),
      full: true,
    },
    {
      label: "Website",
      value: row.website ? (
        <Box
          component="a"
          href={row.website}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: "#A07823",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {row.website}
        </Box>
      ) : (
        ""
      ),
    },
    {
      label: "Booking link",
      value: row.booking_link ? (
        <Box
          component="a"
          href={row.booking_link}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: "#A07823",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {row.booking_link}
        </Box>
      ) : (
        ""
      ),
    },
    { label: "Submitted", value: formatDateTime(row.created_at) },
    {
      label: "Contacted",
      value: row.contacted_at ? formatDateTime(row.contacted_at) : "Not yet",
    },
    {
      label: "Notes",
      value: row.notes ?? "",
      full: true,
    },
  ];

  return (
    <Box
      sx={{
        px: { xs: 2.5, md: 4 },
        py: 2.5,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "grey.50",
      }}
    >
      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        {fields.map((f) => (
          <Grid key={f.label} size={{ xs: 12, md: f.full ? 12 : 6 }}>
            <Typography
              sx={{
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "text.secondary",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                mb: 0.5,
              }}
            >
              {f.label}
            </Typography>
            <Typography
              component="div"
              sx={{
                fontSize: "0.88rem",
                color: "text.primary",
                lineHeight: 1.55,
                wordBreak: "break-word",
              }}
            >
              {f.value}
            </Typography>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Box
      component="button"
      onClick={async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Best-effort copy. If the clipboard API is gated (insecure
          // context, permission denied), the user can still read the
          // value — silent failure beats a blocking error toast.
        }
      }}
      sx={{
        background: "none",
        border: 0,
        p: 0,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: "inherit",
        color: "inherit",
        textAlign: "left",
        "&:hover": { color: "#A07823" },
      }}
      title={copied ? "Copied!" : "Click to copy"}
    >
      {copied ? "Copied!" : value}
    </Box>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    new: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "New" },
    reviewing: { bg: "rgba(14,42,61,0.10)", color: "#0E2A3D", label: "Reviewing" },
    invited: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "Invited" },
    declined: { bg: "rgba(140,29,29,0.10)", color: "#8C1D1D", label: "Declined" },
    onboarded: { bg: "rgba(160,120,35,0.16)", color: "#6E5618", label: "Onboarded" },
  };
  const s = map[status] ?? map.new;
  return (
    <Chip
      label={s.label}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.68rem", height: 22 }}
    />
  );
}
