import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import SpotlightsTable, {
  type ExpertOption,
  type PartnerOption,
  type SpotlightRow,
} from "./SpotlightsTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadData(): Promise<{
  rows: SpotlightRow[];
  experts: ExpertOption[];
  partners: PartnerOption[];
  error: string | null;
}> {
  try {
    const supabase = getSupabaseAdmin();
    const [spotlights, experts, partners] = await Promise.all([
      supabase
        .from("profile_spotlights")
        .select(
          "id, expert_application_id, partner_application_id, kind, title, body, link_url, link_label, image_url, event_date, is_published, created_by, created_at, updated_at, published_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("expert_applications")
        .select("id, full_name, company")
        .eq("status", "approved")
        .order("full_name", { ascending: true }),
      supabase
        .from("partner_applications")
        .select("id, company_name, contact_name")
        .eq("status", "approved")
        .order("company_name", { ascending: true }),
    ]);
    if (spotlights.error) throw spotlights.error;
    if (experts.error) throw experts.error;
    if (partners.error) throw partners.error;

    return {
      rows: (spotlights.data ?? []) as SpotlightRow[],
      experts: (experts.data ?? []) as ExpertOption[],
      partners: (partners.data ?? []) as PartnerOption[],
      error: null,
    };
  } catch (err) {
    return { rows: [], experts: [], partners: [], error: errMessage(err) };
  }
}

export default async function AdminSpotlightsPage() {
  const { rows, experts, partners, error } = await loadData();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          SPOTLIGHTS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Profile spotlights
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
            The profile spotlights table isn&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0020_profile_spotlights.sql</code> in the Supabase SQL
            editor, then refresh. Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <SpotlightsTable initialRows={rows} experts={experts} partners={partners} />;
}
