import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import type { VendorDeal } from "@/lib/portal/data";
import DealsReview from "./DealsReview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDealsPage() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vendor_deals")
      .select(
        "id, partner_id, company_name, title, category, description, deal_terms, redemption_url, redemption_note, status, published_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return <DealsReview initialDeals={(data ?? []) as VendorDeal[]} />;
  } catch (err) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          PARTNER OFFERS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Vendor deals
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
            The vendor deals table isn&apos;t available yet.
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
