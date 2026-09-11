import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import BroadcastTable, { type AnnouncementRow } from "./BroadcastTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadRows(): Promise<{ rows: AnnouncementRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, body, audience, status, sent_at, created_by, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { rows: (data ?? []) as AnnouncementRow[], error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

export default async function AdminBroadcastPage() {
  const { rows, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          BROADCAST
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Announcements
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
            The announcements table isn&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0022_announcements.sql</code> in the Supabase SQL editor,
            then refresh. Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <BroadcastTable initialRows={rows} />;
}
