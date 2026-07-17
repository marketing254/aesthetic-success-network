import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import MembersTable, { type MemberRow } from "./MembersTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadRows(): Promise<{ rows: MemberRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("members")
      .select(
        "id, email, first_name, last_name, practice_name, practice_role, phone, status, tier, waitlist_signup_id, activated_at, activated_by, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { rows: (data ?? []) as MemberRow[], error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

export default async function AdminMembersPage() {
  const { rows, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          MEMBERS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Members
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
            The members table isn&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0006_members_and_audit.sql</code> in the Supabase SQL
            editor, then refresh. Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <MembersTable initialRows={rows} />;
}
