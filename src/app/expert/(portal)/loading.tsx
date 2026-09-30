import { Box, Skeleton, Stack } from "@mui/material";

/** Instant route skeleton so navigation feels immediate while the page loads. */
export default function Loading() {
  return (
    <Box sx={{ maxWidth: 1120 }}>
      <Skeleton variant="text" width={320} height={24} sx={{ mb: 3 }} />
      <Skeleton variant="rounded" height={180} sx={{ borderRadius: "20px", mb: 3 }} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 3, mb: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={132} sx={{ borderRadius: "20px" }} />
        ))}
      </Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Skeleton variant="rounded" height={300} sx={{ flex: 1, borderRadius: "20px" }} />
        <Skeleton variant="rounded" height={300} sx={{ flex: 1, borderRadius: "20px" }} />
      </Stack>
    </Box>
  );
}
