import { Box, Grid, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PageHeader, SectionCard, StatusChip, formatDate } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PartnerRecord = {
  website: string | null;
  contact_role: string | null;
  contact_phone: string | null;
  category: string | null;
  description: string | null;
  member_deal: string | null;
  booking_link: string | null;
  billing_contact: string | null;
  status: string;
  reviewed_at: string | null;
  created_at: string;
};

export default async function PartnerProfilePage() {
  const identity = await requirePortalPage("partner");
  const partner = identity.partner!;

  let record: PartnerRecord | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("partner_applications")
      .select(
        "website, contact_role, contact_phone, category, description, member_deal, booking_link, billing_contact, status, reviewed_at, created_at",
      )
      .eq("id", partner.id)
      .maybeSingle();
    record = (data as PartnerRecord) ?? null;
  } catch {
    // Identity fields below still render.
  }

  const fields: [string, string][] = [
    ["Company", partner.companyName],
    ["Website", record?.website ?? "—"],
    ["Contact", partner.contactName],
    ["Contact role", record?.contact_role ?? "—"],
    ["Email", partner.email],
    ["Phone", record?.contact_phone ?? "—"],
    ["Category", record?.category ?? partner.category ?? "—"],
    ["Booking link", record?.booking_link ?? "—"],
    ["Billing contact", record?.billing_contact ?? "—"],
  ];

  return (
    <Box>
      <PageHeader
        eyebrow="Profile"
        title="Your partner profile"
        description="What our team holds on file for you. To change anything, email partners@aestheticsuccessnetwork.com."
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="Details">
            <Stack spacing={2}>
              {fields.map(([label, value]) => (
                <Box key={label}>
                  <Typography
                    sx={{
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "text.secondary",
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: "0.95rem", wordBreak: "break-word" }}>{value}</Typography>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <SectionCard title="Status">
              <Stack spacing={1.5}>
                <StatusChip
                  status={record?.status === "approved" ? "published" : (record?.status ?? "draft")}
                  size="medium"
                />
                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "text.secondary",
                    }}
                  >
                    Approved
                  </Typography>
                  <Typography sx={{ fontSize: "0.9rem" }}>
                    {formatDate(record?.reviewed_at ?? record?.created_at)}
                  </Typography>
                </Box>
              </Stack>
            </SectionCard>

            {record?.description && (
              <SectionCard title="Company description">
                <Typography sx={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                  {record.description}
                </Typography>
              </SectionCard>
            )}

            {record?.member_deal && (
              <SectionCard title="Deal from your application">
                <Typography sx={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                  {record.member_deal}
                </Typography>
              </SectionCard>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
