import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import ApplicationsTable, { type AppRow } from "@/components/admin/ApplicationsTable";
import { errMessage } from "@/lib/errMessage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SELECT =
  "id, full_name, first_name, last_name, email, phone, company, topics, bio, booking_link, paid_courses, sample_link, content_ownership_confirmed, agreement_accepted, source, status, created_at";

async function loadRows(): Promise<{ rows: AppRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("expert_applications")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { rows: (data ?? []) as AppRow[], error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

export default async function AdminExpertsPage() {
  const { rows, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          EXPERTS
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Expert applications
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
      overline="Experts"
      title="Expert applications"
      initialRows={rows}
      apiPath="/api/admin/experts"
      emailKey="email"
      columns={[
        { key: "full_name", label: "Applicant", secondaryKey: "email" },
        { key: "company", label: "Company / practice" },
        { key: "topics", label: "Topics", maxWidth: 260 },
        { key: "paid_courses", label: "Paid courses" },
      ]}
      details={[
        { key: "phone", label: "Phone" },
        { key: "booking_link", label: "Booking link" },
        { key: "sample_link", label: "Sample recording" },
        { key: "bio", label: "Bio / credentials" },
        { key: "content_ownership_confirmed", label: "Owns content" },
        { key: "agreement_accepted", label: "Agreed to expert terms" },
        { key: "source", label: "Source" },
      ]}
      searchKeys={["full_name", "email", "company", "topics"]}
      csvKeys={[
        "full_name",
        "email",
        "phone",
        "company",
        "topics",
        "bio",
        "booking_link",
        "paid_courses",
        "sample_link",
        "content_ownership_confirmed",
        "agreement_accepted",
        "source",
      ]}
      emptyHint="Expert applications from the /experts page will appear here."
    />
  );
}
