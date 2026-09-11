import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import PromoCodesTable, { type OwnerOption, type PromoCodeRow } from "./PromoCodesTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoadResult = {
  rows: PromoCodeRow[];
  experts: OwnerOption[];
  partners: OwnerOption[];
  error: string | null;
};

async function loadRows(): Promise<LoadResult> {
  try {
    const supabase = getSupabaseAdmin();
    const [codesRes, expertsRes, partnersRes] = await Promise.all([
      supabase
        .from("promo_codes")
        .select(
          "id, code, label, discount_description, expert_application_id, partner_application_id, active, expires_at, max_redemptions, redemption_count, created_by, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("expert_applications")
        .select("id, full_name, company")
        .eq("status", "approved"),
      supabase
        .from("partner_applications")
        .select("id, company_name, contact_name")
        .eq("status", "approved"),
    ]);
    if (codesRes.error) throw codesRes.error;
    if (expertsRes.error) throw expertsRes.error;
    if (partnersRes.error) throw partnersRes.error;

    const experts: OwnerOption[] = (expertsRes.data ?? []).map((e) => ({
      id: e.id as string,
      name: e.company ? `${e.full_name as string} · ${e.company as string}` : (e.full_name as string),
    }));
    const partners: OwnerOption[] = (partnersRes.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.contact_name
        ? `${p.company_name as string} · ${p.contact_name as string}`
        : (p.company_name as string),
    }));

    return { rows: (codesRes.data ?? []) as PromoCodeRow[], experts, partners, error: null };
  } catch (err) {
    return { rows: [], experts: [], partners: [], error: errMessage(err) };
  }
}

export default async function AdminPromoCodesPage() {
  const { rows, experts, partners, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          PROMO CODES
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Promo codes
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
            The promo codes table isn&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0016_promo_codes.sql</code> in the Supabase SQL editor,
            then refresh. Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <PromoCodesTable initialRows={rows} experts={experts} partners={partners} />;
}
