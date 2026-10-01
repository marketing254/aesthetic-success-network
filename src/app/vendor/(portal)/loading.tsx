import { Box, Skeleton, Stack } from "@mui/material";

/** Instant route skeleton so navigation feels immediate while the page loads. */
export default function Loading() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Skeleton variant="text" width={220} height={36} sx={{ mb: 2 }} />
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mb: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={96} sx={{ flex: 1, borderRadius: "16px" }} />
        ))}
      </Stack>
      <Skeleton variant="rounded" height={280} sx={{ borderRadius: "16px" }} />
    </Box>
  );
}
