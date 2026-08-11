import Link from "next/link";
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PageHeader, SectionCard, StatusChip, formatDate } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MemberRecord = {
  phone: string | null;
  practice_role: string | null;
  status: string;
  tier: string;
  activated_at: string | null;
  joined_at: string | null;
  created_at: string;
};

export default async function MemberAccountPage() {
  const identity = await requirePortalPage("member");
  const member = identity.member!;

  let record: MemberRecord | null = null;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("members")
      .select("phone, practice_role, status, tier, activated_at, joined_at, created_at")
      .eq("id", member.id)
      .maybeSingle();
    record = (data as MemberRecord) ?? null;
  } catch {
    // Fall through — the identity fields below are enough to render.
  }

  const fields: [string, string][] = [
    ["Name", `${member.firstName} ${member.lastName}`.trim() || "—"],
    ["Email", member.email],
    ["Practice", member.practiceName ?? "—"],
    ["Role", record?.practice_role ?? "—"],
    ["Phone", record?.phone ?? "—"],
    ["Member since", formatDate(record?.activated_at ?? record?.joined_at ?? record?.created_at)],
  ];

  return (
    <Box>
      <PageHeader
        eyebrow="Account"
        title="Your membership"
        description="Need something changed? Email members@aestheticsuccessnetwork.com and we'll update it for you."
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
                  <Typography sx={{ fontSize: "0.95rem" }}>{value}</Typography>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <SectionCard title="Membership">
              <Stack spacing={1.75}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <StatusChip status={record?.status ?? "active"} size="medium" />
                  <Typography sx={{ fontSize: "0.86rem", textTransform: "capitalize" }}>
                    {record?.tier ?? member.tier} tier
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ fontSize: "0.84rem" }}>
                  Your founding rate is locked for as long as your membership stays active. Cancel any
                  time — the 30-day money-back guarantee applies to your first month.
                </Typography>
              </Stack>
            </SectionCard>

            <SectionCard title="Agreements">
              <Stack spacing={1}>
                {[
                  ["Member Agreement", "/member-agreement"],
                  ["Privacy Policy", "/privacy"],
                  ["Refund Policy", "/refund-policy"],
                ].map(([label, href]) => (
                  <Button
                    key={href}
                    component={Link}
                    href={href}
                    variant="outlined"
                    size="small"
                    sx={{ justifyContent: "flex-start" }}
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
