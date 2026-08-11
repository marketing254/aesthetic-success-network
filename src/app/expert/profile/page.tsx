import { Box, Grid, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PageHeader, SectionCard, StatusChip, formatDate } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExpertRecord = {
  phone: string | null;
  company: string | null;
  topics: string | null;
  bio: string | null;
  booking_link: string | null;
  paid_courses: string | null;
  sample_link: string | null;
  status: string;
  reviewed_at: string | null;
  created_at: string;
};

export default async function ExpertProfilePage() {
  const identity = await requirePortalPage("expert");
  const expert = identity.expert!;

  let record: ExpertRecord | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("expert_applications")
      .select("phone, company, topics, bio, booking_link, paid_courses, sample_link, status, reviewed_at, created_at")
      .eq("id", expert.id)
      .maybeSingle();
    record = (data as ExpertRecord) ?? null;
  } catch {
    // Identity fields below still render.
  }

  const fields: [string, string][] = [
    ["Name", expert.fullName],
    ["Email", expert.email],
    ["Company / practice", record?.company ?? expert.company ?? "—"],
    ["Phone", record?.phone ?? "—"],
    ["Areas of expertise", record?.topics ?? "—"],
    ["Booking link", record?.booking_link ?? "—"],
    ["Sample content", record?.sample_link ?? "—"],
    ["Open to paid courses", record?.paid_courses ?? "—"],
  ];

  return (
    <Box>
      <PageHeader
        eyebrow="Profile"
        title="Your expert profile"
        description="This is what our team uses to route questions to you. To change anything, email experts@aestheticsuccessnetwork.com."
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
                <StatusChip status={record?.status === "approved" ? "published" : (record?.status ?? "draft")} size="medium" />
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

            {record?.bio && (
              <SectionCard title="Bio">
                <Typography sx={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{record.bio}</Typography>
              </SectionCard>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
