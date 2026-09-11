import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import LeadMagnetsTable, { type LeadMagnetRow } from "./LeadMagnetsTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadRows(): Promise<{ rows: LeadMagnetRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("lead_magnet_leads")
      .select(
        "id, magnet_slug, email, full_name, practice_name, source, utm, ip_hash, user_agent, contacted_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { rows: (data ?? []) as LeadMagnetRow[], error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

export default async function AdminLeadMagnetsPage() {
  const { rows, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          LEAD MAGNETS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Lead magnet leads
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
            The lead magnet leads table isn&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0019_lead_magnet_leads.sql</code> in the Supabase SQL
            editor, then refresh. Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <LeadMagnetsTable initialRows={rows} />;
}
