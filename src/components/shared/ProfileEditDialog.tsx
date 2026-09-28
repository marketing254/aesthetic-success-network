"use client";

import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";

/**
 * ProfileEditDialog — reusable identity-edit modal used by all three
 * portals (member, expert, partner) via their sidebar identity card.
 *
 * Accepts:
 *   endpoint   PATCH URL (multipart/form-data) the role's API exposes
 *   nameField  which field the role's table uses for the display name
 *              ("first_name + last_name" for members, "display_name" for
 *               experts/partners)
 *   initial    current avatar + name values for the inputs
 *
 * On submit:
 *   - Reads file + name into FormData and PATCHes the endpoint.
 *   - Calls onSaved with the local preview avatar URL so the parent can
 *     update its UI optimistically without a full reload.
 *
 * `accentColor` is kept for API compatibility; the dialog is neutral.
 */

// Field caps mirror the DB check constraints so a long paste fails here,
// with a friendly message, instead of at the API.
const NAME_MAX = 80;
const DISPLAY_NAME_MAX = 120;

const NAVY = "#0E2A3D";
const NAVY_HOVER = "#0B2232";
const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

export type ProfileEditInitial = {
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
  displayName?: string;
};

export default function ProfileEditDialog({
  open,
  endpoint,
  nameField,
  initial,
  onClose,
  onSaved,
  accentColor: _accentColor,
}: {
  open: boolean;
  endpoint: string;
  nameField: "memberName" | "displayName";
  initial: ProfileEditInitial;
  onClose: () => void;
  onSaved?: (next: { avatarPreview: string | null; firstName?: string; lastName?: string; displayName?: string }) => void;
  accentColor?: string;
}) {
  void _accentColor;
  const [firstName, setFirstName] = useState(initial.firstName ?? "");
  const [lastName, setLastName] = useState(initial.lastName ?? "");
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial.avatarUrl ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setFirstName(initial.firstName ?? "");
      setLastName(initial.lastName ?? "");
      setDisplayName(initial.displayName ?? "");
      setFile(null);
      setPreviewUrl(initial.avatarUrl ?? null);
      setError(null);
    }
  }, [open, initial.avatarUrl, initial.firstName, initial.lastName, initial.displayName]);

  // Create a local object URL for preview when the user picks a file.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Pick an image file.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }
    setError(null);
    setFile(f);
  };

  const submit = async () => {
    if (nameField === "memberName") {
      if (!firstName.trim()) {
        setError("First name is required.");
        return;
      }
      if (firstName.trim().length > NAME_MAX || lastName.trim().length > NAME_MAX) {
        setError(`Names must be ${NAME_MAX} characters or fewer.`);
        return;
      }
    } else if (!displayName.trim() || displayName.trim().length > DISPLAY_NAME_MAX) {
      setError(`Display name is required and must be ${DISPLAY_NAME_MAX} characters or fewer.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      if (file) form.append("avatar", file);
      if (nameField === "memberName") {
        form.append("first_name", firstName.trim());
        form.append("last_name", lastName.trim());
      } else {
        form.append("display_name", displayName.trim());
      }
      const res = await fetch(endpoint, { method: "PATCH", body: form });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Couldn't save changes. Please try again.");
        return;
      }
      onSaved?.({
        avatarPreview: previewUrl,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: displayName.trim(),
      });
      onClose();
    } catch {
      setError("Couldn't save changes. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "8px",
            bgcolor: "#FFFFFF",
            border: `1px solid ${LINE}`,
            boxShadow: "0 10px 30px -10px rgba(17,24,39,0.2)",
            backgroundImage: "none",
          },
        },
      }}
    >
      <DialogTitle sx={{ fontFamily: "inherit", fontSize: "1rem", fontWeight: 600, color: INK, p: "20px 24px 4px", letterSpacing: 0 }}>
        Edit profile
      </DialogTitle>
      <DialogContent sx={{ p: "8px 24px 8px" }}>
        <Typography sx={{ fontSize: "0.8125rem", color: MUTED, mb: 2.5 }}>
          Update your photo and how your name appears across the portal.
        </Typography>

        <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2.5 }}>
          <Avatar
            src={previewUrl ?? undefined}
            sx={{
              width: 64,
              height: 64,
              bgcolor: "rgba(14,42,61,0.08)",
              color: NAVY,
              fontSize: "1.125rem",
              fontWeight: 600,
            }}
          >
            {initials(initial.firstName, initial.lastName, initial.displayName)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Button
              onClick={() => fileInputRef.current?.click()}
              startIcon={<PhotoCameraRoundedIcon sx={{ fontSize: 16 }} />}
              variant="outlined"
              size="small"
              disabled={submitting}
              sx={{
                textTransform: "none",
                fontWeight: 500,
                borderRadius: "6px",
                minHeight: 32,
                borderColor: "#D1D5DB",
                color: INK,
                bgcolor: "#FFFFFF",
                "&:hover": { bgcolor: "#F9FAFB", borderColor: "#D1D5DB", transform: "none" },
              }}
            >
              Choose photo
            </Button>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 0.75 }}>JPG or PNG, max 5 MB</Typography>
            <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={onPickFile} />
          </Box>
        </Stack>

        {nameField === "memberName" ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
            <TextField
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              size="small"
              fullWidth
              disabled={submitting}
              slotProps={{ htmlInput: { maxLength: NAME_MAX } }}
            />
            <TextField
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              size="small"
              fullWidth
              disabled={submitting}
              slotProps={{ htmlInput: { maxLength: NAME_MAX } }}
            />
          </Stack>
        ) : (
          <TextField
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            size="small"
            fullWidth
            disabled={submitting}
            slotProps={{ htmlInput: { maxLength: DISPLAY_NAME_MAX } }}
          />
        )}

        {error && (
          <Typography sx={{ fontSize: "0.8125rem", color: "#991B1B", mt: 1.5 }}>{error}</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: "12px 24px 20px", gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={submitting}
          variant="outlined"
          sx={{
            textTransform: "none",
            fontWeight: 500,
            borderRadius: "6px",
            minHeight: 36,
            borderColor: "#D1D5DB",
            color: INK,
            bgcolor: "#FFFFFF",
            "&:hover": { bgcolor: "#F9FAFB", borderColor: "#D1D5DB", transform: "none" },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={submitting}
          variant="contained"
          disableElevation
          endIcon={submitting ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : null}
          sx={{
            textTransform: "none",
            fontWeight: 500,
            borderRadius: "6px",
            minHeight: 36,
            px: 2,
            bgcolor: NAVY,
            color: "#FFFFFF",
            backgroundImage: "none",
            boxShadow: "none",
            "&:hover": { bgcolor: NAVY_HOVER, boxShadow: "none", transform: "none" },
          }}
        >
          {submitting ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function initials(first?: string, last?: string, display?: string): string {
  if (display) {
    const parts = display.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  const a = (first ?? "").trim().charAt(0);
  const b = (last ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "AS";
}
