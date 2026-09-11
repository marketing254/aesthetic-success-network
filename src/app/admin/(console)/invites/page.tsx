import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/stripe";
import InviteLinksTable, { type InviteLinkRow } from "./InviteLinksTable";
import { errMessage } from "@/lib/errMessage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadRows(): Promise<{ rows: InviteLinkRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("invite_links")
      .select(
        "id, code, kind, full_name, email, company_name, notes, status, viewed_at, accepted_at, expert_application_id, partner_application_id, expires_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const origin = appOrigin();
    const rows = (data ?? []).map((r) => ({
      ...r,
      invite_url: `${origin}/invite/${r.code}`,
    })) as InviteLinkRow[];
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

export default async function AdminInvitesPage() {
  const { rows, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          INVITE LINKS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Personal invite links
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
            See <code>supabase/README.md</code>. Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <InviteLinksTable initialRows={rows} />;
}
