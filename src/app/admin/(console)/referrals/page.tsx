import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import ReferralsTable, {
  type OwnerOption,
  type ReferralCodeRow,
  type ReferralSignupRow,
} from "./ReferralsTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoadResult = {
  rows: ReferralCodeRow[];
  signups: ReferralSignupRow[];
  experts: OwnerOption[];
  partners: OwnerOption[];
  error: string | null;
};

async function loadRows(): Promise<LoadResult> {
  try {
    const supabase = getSupabaseAdmin();
    const [codesRes, expertsRes, partnersRes, signupsRes] = await Promise.all([
      supabase
        .from("referral_codes")
        .select(
          "id, code, slug, expert_application_id, partner_application_id, active, created_by, created_at",
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
      supabase
        .from("referral_signups")
        .select("id, code_id, member_id, referred_name, referred_email, converted_at, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (codesRes.error) throw codesRes.error;
    if (expertsRes.error) throw expertsRes.error;
    if (partnersRes.error) throw partnersRes.error;
    if (signupsRes.error) throw signupsRes.error;

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

    return {
      rows: (codesRes.data ?? []) as ReferralCodeRow[],
      signups: (signupsRes.data ?? []) as ReferralSignupRow[],
      experts,
      partners,
      error: null,
    };
  } catch (err) {
    return { rows: [], signups: [], experts: [], partners: [], error: errMessage(err) };
  }
}

export default async function AdminReferralsPage() {
  const { rows, signups, experts, partners, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          REFERRALS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Referral codes
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
            The referrals tables aren&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0017_referrals.sql</code> in the Supabase SQL editor,
            then refresh. Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <ReferralsTable initialRows={rows} initialSignups={signups} experts={experts} partners={partners} />
  );
}
