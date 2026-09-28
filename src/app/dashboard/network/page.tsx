"use client";

import { Box, Stack, Typography } from "@mui/material";
import NetworkFeed from "@/components/network/NetworkFeed";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";

/**
 * Member view of the expert network feed.
 *
 * Notes on "Ask AI":
 *   The Ask-AI affordance still shows on each post in the feed itself
 *   (NetworkFeed.tsx) but is disabled with a "Soon" pill — the LLM-backed
 *   chat helper isn't shipping in this release. When it does ship, pass
 *   `onAskExpertBot` back to <NetworkFeed> here and re-mount the dialog;
 *   the rest of the infra (ExpertChatDialog, /api/network/experts/[id]/chat)
 *   is already in place.
 */
export default function MemberNetworkPage() {
  return (
    <Box sx={{ maxWidth: 720, mx: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, md: 0 } }}>
      <Stack spacing={4}>
        <Box>
          <Typography
            sx={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: INK_MUTED,
              textTransform: "uppercase",
              mb: 1,
            }}
          >
            Network
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.9rem", md: "2.4rem" },
              fontWeight: 500,
              color: INK,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              mb: 1,
            }}
          >
            Updates from the network
          </Typography>
          <Typography sx={{ color: INK_SOFT, fontSize: "0.98rem", lineHeight: 1.55 }}>
            Updates from the network&apos;s experts and partners: what they are publishing, offering and answering. React and comment to ask a follow-up.
          </Typography>
        </Box>

        <NetworkFeed hideComposer />
      </Stack>
    </Box>
  );
}
