"use client";

import { Box } from "@mui/material";

/** "Live for members" (green) or "Waiting for your approval" (gold). */
export default function ProtocolStatusBadge({ status }: { status: "live" | "pending" }) {
  const live = status === "live";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.25,
        height: 24,
        borderRadius: 999,
        fontSize: "0.74rem",
        fontWeight: 700,
        bgcolor: live ? "rgba(236,247,240,0.96)" : "rgba(253,246,232,0.96)",
        color: live ? "#1F5C40" : "#7A5A14",
        border: `1px solid ${live ? "#CFE8D9" : "#F1DFB5"}`,
        whiteSpace: "nowrap",
      }}
    >
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: live ? "#2F7A4D" : "#D9A84B" }} />
      {live ? "Live for members" : "Waiting for your approval"}
    </Box>
  );
}
