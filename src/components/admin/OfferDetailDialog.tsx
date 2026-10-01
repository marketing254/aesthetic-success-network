"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";

export type AdminOffer = {
  id: string;
  headline: string;
  discount_value: string;
  promo_code: string | null;
  description: string;
  terms: string;
  valid_from: string;
  valid_to: string;
  redemption_limit_per_member: string | null;
  review_status: "draft" | "pending_review" | "approved" | "rejected" | "needs_changes";
  review_note: string | null;
  reviewed_at: string | null;
  submitted_for_review_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  vendor_id: string;
  catalog_item_id: string;
  catalog_items: {
    id: string;
    name: string;
    category: string;
    type: "service" | "product" | "course";
    tagline: string | null;
    price_label: string;
  } | null;
  vendors: {
    id: string;
    company_name: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string | null;
    website: string | null;
    logo_url: string | null;
    status: string;
    verified: boolean;
  } | null;
  offer_media: {
    id: string;
    kind: "image" | "video";
    url: string;
    thumbnail_url: string | null;
    caption: string | null;
    position: number;
  }[];
};

export default function OfferDetailDialog({
  offer,
  open,
  onClose,
  onAction,
  busy,
}: {
  offer: AdminOffer | null;
  open: boolean;
  onClose: () => void;
  onAction?: (id: string, action: "approve" | "reject", note?: string) => Promise<void> | void;
  busy?: boolean;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [note, setNote] = useState("");

  if (!offer) return null;

  const pending = offer.review_status === "pending_review";

  const reset = () => {
    setRejectMode(false);
    setNote("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const images = (offer.offer_media ?? []).filter((m) => m.kind === "image");

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          },
        },
      }}
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          px: { xs: 2.5, md: 3.5 },
          py: 2,
          bgcolor: "rgba(246,241,231,0.96)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.25,
            bgcolor: "rgba(217,168,75,0.16)",
            color: "#A07823",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <LocalOfferOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7A8590" }}>
              Offer · {offer.catalog_items?.category ?? "Uncategorised"}
            </Typography>
            <ReviewStatusChip status={offer.review_status} />
          </Stack>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, lineHeight: 1.2, mt: 0.25 }} noWrap>
            {offer.headline}
          </Typography>
        </Box>
        <IconButton onClick={close} size="small" sx={{ color: "text.secondary" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: { xs: 2.5, md: 3.5 }, py: { xs: 2.5, md: 3 } }}>
        <Grid container spacing={3}>
          {/* LEFT */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={2}>
              {/* Discount banner */}
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  backgroundImage: "linear-gradient(135deg, #06182A 0%, #0E2A3D 50%, #1B4258 100%)",
                  color: "#FFFFFF",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: "radial-gradient(40% 40% at 90% 0%, rgba(217,168,75,0.4) 0%, transparent 60%)",
                  }}
                />
                <Box sx={{ position: "relative" }}>
                  <Typography sx={{ color: "#F0C16E", fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", mb: 0.5 }}>
                    DISCOUNT VALUE
                  </Typography>
                  <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", fontWeight: 600, lineHeight: 1.1 }}>
                    {offer.discount_value}
                  </Typography>
                  {offer.promo_code && (
                    <Typography sx={{ mt: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.82rem", color: "rgba(255,255,255,0.8)" }}>
                      Promo code: <Box component="strong" sx={{ color: "#F0C16E" }}>{offer.promo_code}</Box>
                    </Typography>
                  )}
                </Box>
              </Box>

              {images.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ overflowX: "auto" }}>
                  {images.map((img) => (
                    <Box
                      key={img.id}
                      sx={{
                        width: 140,
                        height: 90,
                        flexShrink: 0,
                        borderRadius: 1.5,
                        overflow: "hidden",
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.caption ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </Box>
                  ))}
                </Stack>
              )}

              <Box>
                <SectionTitle>Description</SectionTitle>
                <Typography sx={{ fontSize: "0.92rem", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {offer.description}
                </Typography>
              </Box>

              <Box>
                <SectionTitle>Terms</SectionTitle>
                <Typography sx={{ fontSize: "0.86rem", lineHeight: 1.65, color: "text.secondary", whiteSpace: "pre-wrap" }}>
                  {offer.terms}
                </Typography>
              </Box>

              {offer.review_note && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: "1px dashed rgba(217,168,75,0.4)",
                    bgcolor: "rgba(217,168,75,0.06)",
                  }}
                >
                  <Typography sx={{ fontSize: "0.78rem", color: "#7A5B17", fontStyle: "italic" }}>
                    <Box component="strong" sx={{ fontWeight: 700, fontStyle: "normal", mr: 0.5 }}>
                      Last team note:
                    </Box>
                    {offer.review_note}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Grid>

          {/* RIGHT */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2}>
              <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "common.white" }}>
                <SectionTitle>Company</SectionTitle>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
                  {offer.vendors?.logo_url ? (
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        overflow: "hidden",
                        bgcolor: "rgba(14,42,61,0.04)",
                        flexShrink: 0,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={offer.vendors.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        bgcolor: "rgba(217,168,75,0.12)",
                        color: "#A07823",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        fontWeight: 700,
                        fontSize: "0.85rem",
                      }}
                    >
                      {(offer.vendors?.company_name ?? "?")
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </Box>
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.92rem", lineHeight: 1.2 }} noWrap>
                      {offer.vendors?.company_name ?? "Company"}
                    </Typography>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mt: 0.25 }}>
                      <VendorStatusChip status={offer.vendors?.status ?? ""} />
                      {offer.vendors?.verified && (
                        <Chip
                          icon={<VerifiedUserOutlinedIcon sx={{ fontSize: 11 }} />}
                          label="VERIFIED"
                          size="small"
                          sx={{
                            height: 18,
                            bgcolor: "rgba(34,108,78,0.12)",
                            color: "#1F5C40",
                            fontWeight: 700,
                            fontSize: "0.58rem",
                            letterSpacing: "0.08em",
                            "& .MuiChip-icon": { color: "inherit" },
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>
                <MetaRow label="Contact" value={offer.vendors?.contact_name ?? ""} />
                <MetaRow label="Email" value={offer.vendors?.contact_email ?? ""} mono />
                {offer.vendors?.contact_phone && <MetaRow label="Phone" value={offer.vendors.contact_phone} />}
              </Box>

              <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "common.white" }}>
                <SectionTitle>Attached catalog item</SectionTitle>
                {offer.catalog_items ? (
                  <Stack spacing={0.85}>
                    <Typography sx={{ fontSize: "0.92rem", fontWeight: 700 }}>
                      {offer.catalog_items.name}
                    </Typography>
                    {offer.catalog_items.tagline && (
                      <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
                        {offer.catalog_items.tagline}
                      </Typography>
                    )}
                    <MetaRow label="Type" value={offer.catalog_items.type} />
                    <MetaRow label="Category" value={offer.catalog_items.category} />
                    <MetaRow label="Base price" value={offer.catalog_items.price_label} />
                  </Stack>
                ) : (
                  <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
                    Catalog item missing. Was it deleted?
                  </Typography>
                )}
              </Box>

              <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "common.white" }}>
                <SectionTitle>Validity & limits</SectionTitle>
                <Stack spacing={0.85}>
                  <MetaRow label="Valid from" value={offer.valid_from} />
                  <MetaRow label="Valid to" value={offer.valid_to} />
                  <MetaRow label="Limit / member" value={offer.redemption_limit_per_member ?? "unlimited"} />
                  {offer.submitted_for_review_at && (
                    <MetaRow label="Submitted" value={offer.submitted_for_review_at.slice(0, 10)} />
                  )}
                  {offer.approved_at && <MetaRow label="Approved" value={offer.approved_at.slice(0, 10)} />}
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>

        {/* Footer actions */}
        {onAction && (
          <>
            <Divider sx={{ my: 3 }} />
            {pending ? (
              rejectMode ? (
                <Stack spacing={1.5}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 700 }}>
                    Reject with a note (optional)
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Tell the company what to change. They'll see this in their portal + a notification."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    autoFocus
                  />
                  <Stack direction="row" spacing={1.25} sx={{ justifyContent: "flex-end" }}>
                    <Button onClick={() => { setRejectMode(false); setNote(""); }}>Cancel</Button>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<CancelOutlinedIcon />}
                      disabled={busy}
                      onClick={async () => {
                        await onAction(offer.id, "reject", note.trim() || undefined);
                        reset();
                      }}
                    >
                      {busy ? "Rejecting…" : "Confirm reject"}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1.25} sx={{ justifyContent: "flex-end" }}>
                  <Button onClick={close}>Close</Button>
                  <Button
                    variant="text"
                    color="error"
                    startIcon={<CancelOutlinedIcon />}
                    onClick={() => setRejectMode(true)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : <CheckCircleOutlinedIcon />}
                    disabled={busy}
                    onClick={async () => {
                      await onAction(offer.id, "approve");
                      reset();
                    }}
                  >
                    {busy ? "Approving…" : "Approve & publish"}
                  </Button>
                </Stack>
              )
            ) : (
              <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                <Button onClick={close} variant="outlined">Close</Button>
              </Stack>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "0.66rem",
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "#7A8590",
        mb: 1,
      }}
    >
      {children}
    </Typography>
  );
}

function MetaRow({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 1.5 }}>
      <Typography sx={{ fontSize: "0.7rem", color: "#9CA3AB", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box
        sx={{
          fontSize: highlight ? "0.92rem" : "0.82rem",
          fontWeight: highlight ? 700 : 500,
          color: highlight ? "#A07823" : "text.primary",
          fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
          textAlign: "right",
          minWidth: 0,
          wordBreak: "break-word",
        }}
      >
        {value}
      </Box>
    </Stack>
  );
}

function ReviewStatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending_review: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "PENDING REVIEW" },
    approved: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "APPROVED" },
    rejected: { bg: "rgba(140,29,29,0.12)", color: "#8C1D1D", label: "REJECTED" },
    draft: { bg: "rgba(14,42,61,0.07)", color: "primary.dark", label: "DRAFT" },
    needs_changes: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "NEEDS CHANGES" },
  };
  const s = map[status] ?? map.pending_review;
  return (
    <Chip
      label={s.label}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.1em", height: 20 }}
    />
  );
}

function VendorStatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending_review: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "Pending" },
    approved: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "Approved" },
    suspended: { bg: "rgba(140,29,29,0.12)", color: "#8C1D1D", label: "Suspended" },
    rejected: { bg: "rgba(140,29,29,0.08)", color: "#8C1D1D", label: "Rejected" },
  };
  const s = map[status] ?? map.pending_review;
  return (
    <Chip
      label={s.label}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: "0.58rem", letterSpacing: "0.08em", height: 18 }}
    />
  );
}
