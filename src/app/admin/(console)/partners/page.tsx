import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import ApplicationsTable, { type AppRow } from "@/components/admin/ApplicationsTable";
import { errMessage } from "@/lib/errMessage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SELECT =
  "id, company_name, website, contact_name, contact_role, contact_email, contact_phone, category, description, member_deal, booking_link, billing_contact, agreement_accepted, source, status, created_at";

async function loadRows(): Promise<{ rows: AppRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("partner_applications")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { rows: (data ?? []) as AppRow[], error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

export default async function AdminPartnersPage() {
  const { rows, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          PARTNERS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Partner applications
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

  return (
    <ApplicationsTable
      overline="Partners"
      title="Partner applications"
      initialRows={rows}
      apiPath="/api/admin/partners"
      emailKey="contact_email"
      columns={[
        { key: "company_name", label: "Company", secondaryKey: "website" },
        { key: "contact_name", label: "Contact", secondaryKey: "contact_email" },
        { key: "category", label: "Category" },
        { key: "member_deal", label: "Member deal", maxWidth: 260 },
      ]}
      details={[
        { key: "contact_role", label: "Contact role" },
        { key: "contact_phone", label: "Phone" },
        { key: "description", label: "Company description" },
        { key: "member_deal", label: "Member deal (full)" },
        { key: "booking_link", label: "Booking link" },
        { key: "billing_contact", label: "Billing contact" },
        { key: "agreement_accepted", label: "Agreed to commitments" },
        { key: "source", label: "Source" },
      ]}
      searchKeys={["company_name", "contact_name", "contact_email", "category"]}
      csvKeys={[
        "company_name",
        "website",
        "contact_name",
        "contact_role",
        "contact_email",
        "contact_phone",
        "category",
        "description",
        "member_deal",
        "booking_link",
        "billing_contact",
        "agreement_accepted",
        "source",
      ]}
      emptyHint="Partner applications from the /partners page will appear here."
    />
  );
}
