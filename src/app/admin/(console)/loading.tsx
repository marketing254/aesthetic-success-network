import { Box, Skeleton, Stack } from "@mui/material";

/**
 * Shared loading state for every console tab.
 *
 * Each tab is `force-dynamic`, so without a loading boundary a click on
 * the sidebar left the browser sitting on the previous page — no spinner,
 * no feedback — until the server had authenticated, queried Supabase and
 * rendered the whole table. That reads as "the console is slow" even when
 * the request itself is quick.
 *
 * This boundary also makes prefetching work: for a dynamic route Next
 * only prefetches as far as the nearest `loading` file, so with none in
 * the tree every tab switch started completely cold.
 *
 * The sidebar and top bar live in the layout above this, so they stay put
 * — only the content column swaps to the skeleton.
 */
export default function ConsoleLoading() {
  return (
    <Stack spacing={3.5} aria-busy="true" aria-label="Loading">
      <Box>
        <Skeleton variant="text" width={110} height={16} />
        <Skeleton variant="text" width={280} height={54} sx={{ mt: 0.5 }} />
      </Box>

      <Box
        sx={{
          borderRadius: "20px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 3, py: 2.25, borderBottom: "1px solid", borderColor: "divider" }}>
          <Skeleton variant="text" width={180} height={24} />
        </Box>
        {Array.from({ length: 8 }).map((_, i) => (
          <Stack
            key={i}
            direction="row"
            spacing={2}
            sx={{
              px: 3,
              py: 1.75,
              alignItems: "center",
              borderBottom: i < 7 ? "1px solid" : "none",
              borderColor: "divider",
              // Fade the lower rows so the block reads as content arriving
              // rather than as a finished, empty table.
              opacity: 1 - i * 0.09,
            }}
          >
            <Skeleton variant="rounded" width={74} height={22} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Skeleton variant="text" width={`${38 + ((i * 7) % 22)}%`} height={20} />
              <Skeleton variant="text" width={`${52 + ((i * 5) % 26)}%`} height={16} />
            </Box>
            <Skeleton variant="text" width={90} height={16} />
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}
