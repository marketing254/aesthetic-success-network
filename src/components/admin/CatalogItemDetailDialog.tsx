"use client";

import { useMemo, useState } from "react";
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
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import MedicalServicesOutlinedIcon from "@mui/icons-material/MedicalServicesOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";

export type AdminCatalogItem = {
  id: string;
  type: "service" | "product" | "course";
  name: string;
  tagline: string | null;
  description: string;
  category: string;
  price_label: string;
  duration_hours: number | null;
  module_count: number | null;
  ce_credits: number | null;
  highlights: string[] | null;
  tags: string[] | null;
  review_status: "draft" | "pending_review" | "approved" | "rejected" | "needs_changes";
  review_note: string | null;
  reviewed_at: string | null;
  submitted_for_review_at: string | null;
  approved_at: string | null;
  offer_count: number;
  redemptions_lifetime: number;
  created_at: string;
  updated_at: string;
  vendor_id: string;
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
  catalog_media: {
    id: string;
    kind: "image" | "video" | "document";
    url: string;
    thumbnail_url: string | null;
    caption: string | null;
    mime_type: string | null;
    file_size_bytes: number | null;
    duration_label: string | null;
    position: number;
  }[];
};

export default function CatalogItemDetailDialog({
  item,
  open,
  onClose,
  onAction,
  busy,
}: {
  item: AdminCatalogItem | null;
  open: boolean;
  onClose: () => void;
  onAction?: (id: string, action: "approve" | "reject", note?: string) => Promise<void> | void;
  busy?: boolean;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [note, setNote] = useState("");

  const images = useMemo(
    () => (item?.catalog_media ?? []).filter((m) => m.kind === "image"),
    [item],
  );
  const videos = useMemo(
    () => (item?.catalog_media ?? []).filter((m) => m.kind === "video"),
    [item],
  );
  const documents = useMemo(
    () => (item?.catalog_media ?? []).filter((m) => m.kind === "document"),
    [item],
  );

  if (!item) return null;

  const Icon =
    item.type === "service"
      ? MedicalServicesOutlinedIcon
      : item.type === "product"
        ? Inventory2OutlinedIcon
        : SchoolOutlinedIcon;

  const pending = item.review_status === "pending_review";

  const reset = () => {
    setRejectMode(false);
    setNote("");
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="lg"
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
      {/* Header strip */}
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
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7A8590" }}>
              {item.type} · {item.category}
            </Typography>
            <ReviewStatusChip status={item.review_status} />
          </Stack>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, lineHeight: 1.2, mt: 0.25 }} noWrap>
            {item.name}
          </Typography>
        </Box>
        <IconButton onClick={close} size="small" sx={{ color: "text.secondary" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: { xs: 2.5, md: 3.5 }, py: { xs: 2.5, md: 3 } }}>
        <Grid container spacing={3}>
          {/* LEFT: media + about */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={2}>
              {images.length > 0 && (
                <Box
                  sx={{
                    borderRadius: 2,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "#FBF8F1",
                  }}
                >
                  <Box sx={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={images[0]!.url}
                      alt={images[0]!.caption ?? item.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </Box>
                  {images.length > 1 && (
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ px: 1, py: 1, borderTop: "1px solid", borderColor: "divider", overflowX: "auto", bgcolor: "#FBFAF6" }}
                    >
                      {images.map((img) => (
                        <Box
                          key={img.id}
                          sx={{
                            width: 64,
                            height: 64,
                            flexShrink: 0,
                            borderRadius: 1,
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
                </Box>
              )}

              {item.tagline && (
                <Typography sx={{ fontSize: "0.95rem", color: "#3B4A55", lineHeight: 1.5 }}>
                  {item.tagline}
                </Typography>
              )}

              <SectionTitle>About this listing</SectionTitle>
              <Typography sx={{ fontSize: "0.92rem", lineHeight: 1.65, color: "text.primary", whiteSpace: "pre-wrap" }}>
                {item.description}
              </Typography>

              {(item.highlights?.length ?? 0) > 0 && (
                <Box>
                  <SectionTitle>Highlights</SectionTitle>
                  <Stack spacing={1}>
                    {item.highlights!.map((h) => (
                      <Stack key={h} direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                        <CheckCircleRoundedIcon sx={{ fontSize: 16, color: "#A07823", mt: "1px", flexShrink: 0 }} />
                        <Typography sx={{ fontSize: "0.86rem", color: "text.primary", lineHeight: 1.55 }}>{h}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}

              {videos.length > 0 && (
                <Box>
                  <SectionTitle>Videos · {videos.length}</SectionTitle>
                  <Grid container spacing={1.5}>
                    {videos.map((v) => (
                      <Grid key={v.id} size={{ xs: 12, sm: 6 }}>
                        <Box
                          component="a"
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            display: "block",
                            textDecoration: "none",
                            color: "inherit",
                            borderRadius: 1.5,
                            overflow: "hidden",
                            border: "1px solid",
                            borderColor: "divider",
                            "&:hover": { borderColor: "#A07823" },
                          }}
                        >
                          <Box sx={{ position: "relative", width: "100%", aspectRatio: "16 / 9", bgcolor: "#0A1320" }}>
                            {v.thumbnail_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={v.thumbnail_url} alt={v.caption ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
                            )}
                            <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                              <Box sx={{ width: 44, height: 44, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.92)", display: "grid", placeItems: "center", color: "#0A1320" }}>
                                <PlayArrowRoundedIcon sx={{ fontSize: 28 }} />
                              </Box>
                            </Box>
                            {v.duration_label && (
                              <Box sx={{ position: "absolute", right: 8, bottom: 8, px: 0.85, py: 0.25, borderRadius: 0.5, bgcolor: "rgba(10,26,47,0.85)", color: "#FFFFFF", fontSize: "0.7rem", fontWeight: 600 }}>
                                {v.duration_label}
                              </Box>
                            )}
                          </Box>
                          {v.caption && (
                            <Box sx={{ p: 1.25 }}>
                              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600 }}>{v.caption}</Typography>
                            </Box>
                          )}
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {documents.length > 0 && (
                <Box>
                  <SectionTitle>Documents · {documents.length}</SectionTitle>
                  <Stack spacing={0.75}>
                    {documents.map((d) => {
                      const filename = d.url.split("/").pop() ?? "document";
                      const sizeKb = d.file_size_bytes ? Math.max(1, Math.round(d.file_size_bytes / 1024)) : null;
                      return (
                        <Box
                          key={d.id}
                          component="a"
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            px: 1.5,
                            py: 1.25,
                            borderRadius: 1.5,
                            border: "1px solid",
                            borderColor: "divider",
                            bgcolor: "common.white",
                            textDecoration: "none",
                            color: "inherit",
                            "&:hover": { borderColor: "#A07823", bgcolor: "rgba(217,168,75,0.04)" },
                          }}
                        >
                          <Box sx={{ width: 32, height: 32, borderRadius: 1, display: "grid", placeItems: "center", bgcolor: "rgba(217,168,75,0.12)", color: "#A07823", flexShrink: 0 }}>
                            <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }} noWrap>
                              {d.caption || filename}
                            </Typography>
                            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                              {(d.mime_type ?? "Document").replace("application/", "").toUpperCase()}
                              {sizeKb ? ` · ${sizeKb} KB` : ""}
                            </Typography>
                          </Box>
                          <OpenInNewOutlinedIcon sx={{ fontSize: 16, color: "#9CA3AB" }} />
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {item.review_note && (
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
                    {item.review_note}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Grid>

          {/* RIGHT: vendor + details */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "common.white",
                }}
              >
                <SectionTitle>Company</SectionTitle>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
                  {item.vendors?.logo_url ? (
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
                      <img src={item.vendors.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                      {(item.vendors?.company_name ?? "?")
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </Box>
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.92rem", lineHeight: 1.2 }} noWrap>
                      {item.vendors?.company_name ?? "Company"}
                    </Typography>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mt: 0.25 }}>
                      <VendorStatusChip status={item.vendors?.status ?? ""} />
                      {item.vendors?.verified && (
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
                <MetaRow label="Contact" value={item.vendors?.contact_name ?? ""} />
                <MetaRow label="Email" value={item.vendors?.contact_email ?? ""} mono />
                {item.vendors?.contact_phone && <MetaRow label="Phone" value={item.vendors.contact_phone} />}
                {item.vendors?.website && (
                  <MetaRow
                    label="Website"
                    value={
                      <Box
                        component="a"
                        href={item.vendors.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ color: "#A07823", textDecoration: "none", fontSize: "0.82rem", "&:hover": { textDecoration: "underline" } }}
                      >
                        {item.vendors.website}
                      </Box>
                    }
                  />
                )}
              </Box>

              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "common.white",
                }}
              >
                <SectionTitle>Details</SectionTitle>
                <Stack spacing={0.85}>
                  <MetaRow label="Price" value={item.price_label} highlight />
                  {item.duration_hours !== null && <MetaRow label="Duration" value={`${item.duration_hours} hours`} />}
                  {item.module_count !== null && <MetaRow label="Modules" value={`${item.module_count}`} />}
                  {item.ce_credits !== null && <MetaRow label="CE credits" value={`${item.ce_credits}`} />}
                  <MetaRow label="Category" value={item.category} />
                  <MetaRow label="Created" value={item.created_at.slice(0, 10)} />
                  <MetaRow label="Updated" value={item.updated_at.slice(0, 10)} />
                </Stack>
              </Box>

              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "common.white",
                }}
              >
                <SectionTitle>Performance</SectionTitle>
                <Stack spacing={0.85}>
                  <MetaRow label="Attached offers" value={`${item.offer_count}`} />
                  <MetaRow label="Lifetime redemptions" value={`${item.redemptions_lifetime}`} />
                  <MetaRow
                    label="Media"
                    value={`${images.length} images · ${videos.length} videos · ${documents.length} docs`}
                  />
                  {item.submitted_for_review_at && (
                    <MetaRow label="Submitted" value={item.submitted_for_review_at.slice(0, 10)} />
                  )}
                  {item.approved_at && <MetaRow label="Approved" value={item.approved_at.slice(0, 10)} />}
                </Stack>
              </Box>

              {(item.tags?.length ?? 0) > 0 && (
                <Box>
                  <SectionTitle>Tags</SectionTitle>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    {item.tags!.map((t) => (
                      <Chip key={t} label={t} size="small" sx={{ bgcolor: "rgba(14,42,61,0.06)", color: "primary.dark", fontWeight: 600, fontSize: "0.7rem" }} />
                    ))}
                  </Stack>
                </Box>
              )}
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
                        await onAction(item.id, "reject", note.trim() || undefined);
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
                      await onAction(item.id, "approve");
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
