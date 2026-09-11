"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconButton, Tooltip } from "@mui/material";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";

export default function SaveButton({
  itemType,
  itemId,
  initialSaved,
}: {
  itemType: "expert" | "partner";
  itemId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next); // optimistic
    try {
      const res = await fetch("/api/portal/member/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId }),
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setSaved(!next); // revert
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tooltip title={saved ? "Remove from saved" : "Save"}>
      <IconButton
        onClick={toggle}
        disabled={busy}
        size="small"
        sx={{ color: saved ? "#A87D2C" : "text.secondary" }}
      >
        {saved ? <BookmarkRoundedIcon fontSize="small" /> : <BookmarkBorderRoundedIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
