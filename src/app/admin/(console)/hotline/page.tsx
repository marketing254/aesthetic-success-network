import { Box, Typography } from "@mui/material";
import { listAllHotlineRequests, listApprovedExperts } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import HotlineQueue from "./HotlineQueue";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminHotlinePage() {
  try {
    const [requests, experts] = await Promise.all([listAllHotlineRequests(), listApprovedExperts()]);
    const expertNames = Object.fromEntries(experts.map((x) => [x.id, x.full_name]));
    return <HotlineQueue initialRequests={requests} experts={experts} expertNames={expertNames} />;
  } catch (err) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          EXPERT HOTLINE
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Triage queue
        </Typography>
        <Box
          sx={{
            p: 3,
            borderRadius: "20px",
            border: "1px solid",
            borderColor: "error.light",
            bgcolor: "rgba(220,60,60,0.04)",
          }}
        >
          <Typography sx={{ color: "error.main", fontWeight: 600, mb: 1 }}>
            The Hotline tables aren&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0008_portals.sql</code> in the Supabase SQL editor, then
            refresh. Detail: {errMessage(err)}
          </Typography>
        </Box>
      </Box>
    );
  }
}
