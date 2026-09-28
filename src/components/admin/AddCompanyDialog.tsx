"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { vendorCategories } from "@/lib/vendorData";

export type PayerOption = { id: string; company_name: string };

/**
 * Add another COMPANY under an existing paying partner (multi-company
 * partners). The company is created as a covered listing — its billing
 * and access inherit the chosen partner, so it never needs its own card
 * or login. Staged as a draft (pending); publish with the Approve action.
 */
export default function AddCompanyDialog({
  open,
  payers,
  defaultParentId,
  onClose,
  onSaved,
}: {
  open: boolean;
  payers: PayerOption[];
  defaultParentId?: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [parentId, setParentId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [category, setCategory] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [memberOffer, setMemberOffer] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [calendarLink, setCalendarLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setParentId(defaultParentId ?? "");
      setCompanyName("");
      setCategory("");
      setWebsite("");
      setDescription("");
      setMemberOffer("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setCalendarLink("");
      setFormError(null);
    }
  }, [open, defaultParentId]);

  const submit = async () => {
    setFormError(null);
    if (!parentId) {
      setFormError("Choose the paying company this one belongs to.");
      return;
    }
    if (!companyName.trim() || !contactName.trim() || !contactEmail.trim()) {
      setFormError("Company name, contact name and contact email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          billing_parent_id: parentId,
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || undefined,
          category: category.trim() || undefined,
          website: website.trim() || undefined,
          description: description.trim() || undefined,
          member_offer: memberOffer.trim() || undefined,
          calendar_link: calendarLink.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        setFormError(body.error ?? `Failed (${res.status}).`);
        return;
      }
      onSaved(companyName.trim());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add company.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle>Add a covered company</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: "text.secondary", mb: 2, fontSize: "0.88rem" }}>
          Adds an extra company under one paying partner. Its billing and access are{" "}
          <strong>covered by the paying company</strong>: no separate card, subscription, or login.
          Saved as a draft; use <strong>Approve</strong> to publish it.
        </Typography>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Paying company"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              fullWidth
              select
              required
              helperText="The company whose one fee covers this one."
            >
              <MenuItem value="" disabled>
                Choose the paying company
              </MenuItem>
              {payers.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.company_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} fullWidth required />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth select>
              <MenuItem value="">None</MenuItem>
              {vendorCategories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} fullWidth placeholder="https://…" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Booking / calendar link" value={calendarLink} onChange={(e) => setCalendarLink(e.target.value)} fullWidth />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="What does this company do?" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={2} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Exclusive member offer"
              value={memberOffer}
              onChange={(e) => setMemberOffer(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              placeholder="This company's own offer to members"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} fullWidth required />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Contact email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              fullWidth
              required
              helperText="Use this company's own email (distinct from the paying company's)."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} fullWidth />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={() => !submitting && onClose()} disabled={submitting} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={15} sx={{ color: "inherit" }} /> : null}
          sx={{ textTransform: "none" }}
        >
          {submitting ? "Adding…" : "Add company"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
