"use client";

import { Stack } from "@mui/material";
import NetworkFeed from "@/components/network/NetworkFeed";
import { PageHeader } from "@/components/vendor/PortalUI";

export default function ExpertPostsPage() {
  return (
    <Stack spacing={3} sx={{ maxWidth: 960 }}>
      <PageHeader
        title="Network feed"
        subtitle="Posts appear in every member and company feed across the network. They can react and comment in real time."
      />

      <NetworkFeed />
    </Stack>
  );
}
