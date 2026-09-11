import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/stripe";
import FoundingInvitesTable, { type FoundingInviteRow } from "./FoundingInvitesTable";
import { errMessage } from "@/lib/errMessage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadRows(): Promise<{ rows: FoundingInviteRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("founding_member_invites")
      .select(
        "id, code, full_name, email, practice_name, notes, status, viewed_at, accepted_at, member_id, expires_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const origin = appOrigin();
    const rows = (data ?? []).map((r) => ({
      ...r,
      invite_url: `${origin}/founding/${r.code}`,
    })) as FoundingInviteRow[];
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

export default async function AdminFoundingPage() {
  const { rows, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          FOUNDING INVITES
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Founding invites
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
            Supabase isn&apos;t configured yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in
            <code> .env.local</code>, run the migrations in <code>supabase/migrations/</code>, then
            restart the dev server. See <code>supabase/README.md</code>.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.disabled", mt: 1.5, fontSize: "0.78rem" }}>
            Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <FoundingInvitesTable initialRows={rows} />;
}
