"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
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

export type FoundingInviteRoleValue = "partner" | "expert" | "both";

// An extra company beyond the primary one (multi-company partners/experts).
export type AdditionalCompany = {
  name: string;
  category: string;
  member_offer: string;
  contact_email: string;
};

export type FoundingInvitePricingValue = "standard" | "large";

export type FoundingInviteFormValues = {
  id?: string;
  role: FoundingInviteRoleValue;
  /**
   * Company rate after the free founding months (migration 0071):
   *   "standard" = $39 a month (default), "large" = $149 a month, no
   *   increase. Experts are always $39, so expert invites store
   *   "standard". For
   *   "both" the plan governs the company side only.
   */
  pricing_plan: FoundingInvitePricingValue;
  full_name: string;
  email: string;
  company_name: string;
  member_offer: string;
  website: string;
  category: string;
  calendar_link: string;
  description: string;
  phone: string;
  secondary_email: string;
  secondary_phone: string;
  signer_name: string;
  signer_title: string;
  notes: string;
  // Extra companies (the primary is the fields above). All go on one
  // agreement + one fee; extras become covered listings at acceptance.
  additionalCompanies: AdditionalCompany[];
};

const EMPTY: FoundingInviteFormValues = {
  role: "partner",
  // Default: standard rate ($39 after the free months). Expert invites
  // always store "standard".
  pricing_plan: "standard",
  full_name: "",
  email: "",
  company_name: "",
  member_offer: "",
  website: "",
  category: "",
  calendar_link: "",
  description: "",
  phone: "",
  secondary_email: "",
  secondary_phone: "",
  signer_name: "",
  signer_title: "",
  notes: "",
  additionalCompanies: [],
};

/**
 * Create OR edit a founding invite. Creating writes a DRAFT — it never
 * emails anyone. Sending is a separate, explicit action on the list.
 */
export default function FoundingInviteDialog({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<FoundingInviteFormValues> | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [v, setV] = useState<FoundingInviteFormValues>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setV({ ...EMPTY, ...(initial ?? {}) });
      setFormError(null);
    }
  }, [open, initial]);

  const set = (k: keyof FoundingInviteFormValues) => (e: { target: { value: string } }) =>
    setV((prev) => {
      const next = { ...prev, [k]: e.target.value } as FoundingInviteFormValues;
      // Expert-only invites have exactly one rate ($39 after the free months).
      if (k === "role" && e.target.value === "expert") next.pricing_plan = "standard";
      return next;
    });

  const needsCompany = v.role === "partner" || v.role === "both";
  const pricingHelper =
    v.role === "expert"
      ? "Agreement, acceptance page, email and Stripe all show the first 6 months free (from the member launch), then $39 a month with no increase. A card is saved at acceptance; nothing is charged until the free months end."
      : v.pricing_plan === "large"
        ? `Company listing: first 6 months free from the member launch, then $149 a month with no increase (large company rate). Agreement, acceptance page, email and Stripe all show this.${
            v.role === "both" ? " Expert access on the same invite is $39 a month after the free months." : ""
          }`
        : `Company listing: first 6 months free from the member launch, then $39 a month with no increase. Nothing they see mentions $149.${
            v.role === "both" ? " Expert access on the same invite is $39 a month after the free months." : ""
          }`;

  const addCompany = () =>
    setV((p) => ({
      ...p,
      additionalCompanies: [...p.additionalCompanies, { name: "", category: "", member_offer: "", contact_email: "" }],
    }));
  const removeCompany = (i: number) =>
    setV((p) => ({ ...p, additionalCompanies: p.additionalCompanies.filter((_, idx) => idx !== i) }));
  const updateCompany = (i: number, k: keyof AdditionalCompany, val: string) =>
    setV((p) => ({
      ...p,
      additionalCompanies: p.additionalCompanies.map((c, idx) => (idx === i ? { ...c, [k]: val } : c)),
    }));

  const submit = async () => {
    setFormError(null);
    if (!v.full_name.trim() || !v.email.trim()) {
      setFormError("Full name and email are required.");
      return;
    }
    if (needsCompany && !v.company_name.trim()) {
      setFormError("Company name is required for company / both invites.");
      return;
    }
    setSubmitting(true);
    try {
      // Build the companies list: the primary company (fields above) is
      // companies[0]; each additional row follows. Sent only for
      // partner/both invites.
      const companies = needsCompany
        ? [
            {
              name: v.company_name.trim(),
              category: v.category.trim() || null,
              website: v.website.trim() || null,
              description: v.description.trim() || null,
              member_offer: v.member_offer.trim() || null,
              contact_name: v.full_name.trim() || null,
              contact_email: v.email.trim().toLowerCase() || null,
              calendar_link: v.calendar_link.trim() || null,
            },
            ...v.additionalCompanies
              .filter((c) => c.name.trim())
              .map((c) => ({
                name: c.name.trim(),
                category: c.category.trim() || null,
                member_offer: c.member_offer.trim() || null,
                contact_email: c.contact_email.trim().toLowerCase() || null,
              })),
          ]
        : [];

      const payload = {
        role: v.role,
        pricing_plan: v.pricing_plan,
        full_name: v.full_name.trim(),
        email: v.email.trim(),
        company_name: v.company_name.trim(),
        member_offer: v.member_offer.trim(),
        website: v.website.trim(),
        category: v.category.trim(),
        calendar_link: v.calendar_link.trim(),
        description: v.description.trim(),
        phone: v.phone.trim(),
        secondary_email: v.secondary_email.trim(),
        secondary_phone: v.secondary_phone.trim(),
        signer_name: v.signer_name.trim(),
        signer_title: v.signer_title.trim(),
        notes: v.notes.trim(),
        companies: companies.length ? companies : undefined,
      };
      const url =
        mode === "edit" && initial?.id
          ? `/api/admin/founding-invite/${initial.id}`
          : "/api/admin/founding-invite";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        setFormError(body.error ?? `Failed (${res.status}).`);
        return;
      }
      onSaved(v.full_name.trim());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save invite.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle>
        {mode === "edit" ? "Edit founding invite" : "New founding invite (draft)"}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: "text.secondary", mb: 2, fontSize: "0.88rem" }}>
          Saves a <strong>draft</strong> only. No email is sent and nothing is approved.
          Review it in the list, then click <strong>Send invite</strong> to email the
          private link with their personalized agreement.
        </Typography>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField label="Invite as" value={v.role} onChange={set("role")} fullWidth select>
              <MenuItem value="partner">Partner (company)</MenuItem>
              <MenuItem value="expert">Expert (individual)</MenuItem>
              <MenuItem value="both">Both: Expert + Company (one fee covers both)</MenuItem>
            </TextField>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              label={needsCompany ? "Company pricing" : "Expert pricing"}
              value={v.pricing_plan}
              onChange={set("pricing_plan")}
              fullWidth
              select
              disabled={v.role === "expert"}
              helperText={pricingHelper}
            >
              {v.role === "expert" ? (
                <MenuItem value="standard" sx={{ whiteSpace: "normal" }}>Founding expert: 6 months free from launch, then $39 a month</MenuItem>
              ) : (
                [
                  <MenuItem key="standard" value="standard" sx={{ whiteSpace: "normal" }}>Standard: 6 months free from launch, then $39 a month with no increase</MenuItem>,
                  <MenuItem key="large" value="large" sx={{ whiteSpace: "normal" }}>Large company: 6 months free from launch, then $149 a month with no increase</MenuItem>,
                ]
              )}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <SectionLabel>01 · Company{needsCompany ? "" : " (optional for expert-only)"}</SectionLabel>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Company name"
              value={v.company_name}
              onChange={set("company_name")}
              fullWidth
              required={needsCompany}
              placeholder="Acme Aesthetics Supply"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Website" value={v.website} onChange={set("website")} fullWidth placeholder="https://acmeaesthetics.com" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Category" value={v.category} onChange={set("category")} fullWidth select>
              <MenuItem value="">None</MenuItem>
              {vendorCategories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Booking / calendar link"
              value={v.calendar_link}
              onChange={set("calendar_link")}
              fullWidth
              placeholder="https://cal.com/acme/intro"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="What do they do, in one sentence?"
              value={v.description}
              onChange={set("description")}
              fullWidth
              multiline
              minRows={2}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Exclusive member offer"
              value={v.member_offer}
              onChange={set("member_offer")}
              fullWidth
              multiline
              minRows={2}
              placeholder="e.g. 15% off your first year, or a free consultation"
            />
          </Grid>

          {needsCompany && (
            <>
              <Grid size={{ xs: 12 }}>
                <SectionLabel>Additional companies (optional): one fee &amp; one agreement covers all</SectionLabel>
              </Grid>
              {v.additionalCompanies.map((c, i) => (
                <Grid size={{ xs: 12 }} key={i}>
                  <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label={`Company ${i + 2} name`}
                          value={c.name}
                          onChange={(e) => updateCompany(i, "name", e.target.value)}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Category"
                          value={c.category}
                          onChange={(e) => updateCompany(i, "category", e.target.value)}
                          fullWidth
                          size="small"
                          select
                        >
                          <MenuItem value="">None</MenuItem>
                          {vendorCategories.map((cat) => (
                            <MenuItem key={cat} value={cat}>
                              {cat}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Contact email (distinct)"
                          type="email"
                          value={c.contact_email}
                          onChange={(e) => updateCompany(i, "contact_email", e.target.value)}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Member offer"
                          value={c.member_offer}
                          onChange={(e) => updateCompany(i, "member_offer", e.target.value)}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => removeCompany(i)}
                          sx={{ textTransform: "none" }}
                        >
                          Remove
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              ))}
              <Grid size={{ xs: 12 }}>
                <Button size="small" onClick={addCompany} sx={{ textTransform: "none" }}>
                  + Add another company
                </Button>
              </Grid>
            </>
          )}

          <Grid size={{ xs: 12 }}>
            <SectionLabel>02 · Contact</SectionLabel>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Full name"
              value={v.full_name}
              onChange={set("full_name")}
              fullWidth
              required
              placeholder="Taylor Morgan"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Primary work email"
              type="email"
              value={v.email}
              onChange={set("email")}
              fullWidth
              required
              placeholder="taylor@acme.com"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Primary phone" value={v.phone} onChange={set("phone")} fullWidth placeholder="+1 (555) 010-1234" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Secondary email (optional)"
              type="email"
              value={v.secondary_email}
              onChange={set("secondary_email")}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Secondary phone (optional)"
              value={v.secondary_phone}
              onChange={set("secondary_phone")}
              fullWidth
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <SectionLabel>03 · Signs on behalf of the company</SectionLabel>
          </Grid>
          <Grid size={{ xs: 12, sm: 7 }}>
            <TextField label="Signer full name" value={v.signer_name} onChange={set("signer_name")} fullWidth />
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <TextField label="Signer title" value={v.signer_title} onChange={set("signer_title")} fullWidth placeholder="VP of Partnerships" />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField label="Internal notes (optional)" value={v.notes} onChange={set("notes")} fullWidth multiline minRows={2} />
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
          {submitting ? "Saving…" : mode === "edit" ? "Save changes" : "Save draft"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "text.secondary",
        mt: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}
