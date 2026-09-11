import { Box } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { PageHeader } from "@/components/portal/ui";
import NetworkFeed from "./NetworkFeed";

export const dynamic = "force-dynamic";

export default async function MemberNetworkPage() {
  await requirePortalPage("member");

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <PageHeader
        eyebrow="The network"
        title="What's happening"
        description="Posts from experts and partners in the network. React or leave a comment."
      />
      <NetworkFeed />
    </Box>
  );
}
