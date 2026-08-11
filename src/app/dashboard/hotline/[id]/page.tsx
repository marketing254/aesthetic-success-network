import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { getMemberRequest } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import {
  MigrationNotice,
  PageHeader,
  RichText,
  SectionCard,
  StatusChip,
  formatDateTime,
} from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const identity = await requirePortalPage("member");
  const member = identity.member!;

  let result;
  try {
    result = await getMemberRequest(member.id, id);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Expert Hotline" title="Request" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  if (!result) notFound();
  const { request, response } = result;

  return (
    <Box>
      <PageHeader
        eyebrow="Expert Hotline"
        title={request.subject}
        description={`${request.category ? `${request.category} · ` : ""}Submitted ${formatDateTime(request.created_at)}`}
        action={
          <Button component={Link} href="/dashboard/hotline" variant="outlined">
            Back to questions
          </Button>
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2}>
            <SectionCard title="Your question">
              <RichText text={request.details} />
            </SectionCard>

            {response ? (
              <SectionCard title="Your action plan">
                <Stack spacing={2.5}>
                  <Box
                    sx={{
                      p: 2.25,
                      borderRadius: "14px",
                      bgcolor: "rgba(217,168,75,0.1)",
                      border: "1px solid rgba(217,168,75,0.32)",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "#7A5C10",
                        mb: 0.75,
                      }}
                    >
                      The short answer
                    </Typography>
                    <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "text.primary" }}>
                      {response.summary}
                    </Typography>
                  </Box>
                  <RichText text={response.action_plan} />
                  <Typography variant="body2" sx={{ fontSize: "0.76rem", color: "text.secondary" }}>
                    Delivered {formatDateTime(response.submitted_at)}
                  </Typography>
                </Stack>
              </SectionCard>
            ) : (
              <SectionCard title="Your action plan">
                <Stack spacing={1}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {request.status === "assigned"
                      ? "An expert is working on this now."
                      : "We're routing this to the right expert."}
                  </Typography>
                  <Typography variant="body2">
                    {request.urgency === "urgent"
                      ? "Flagged urgent — expect your written plan within one business day."
                      : "Expect your written plan within 2–3 business days. We'll email you the moment it lands."}
                  </Typography>
                </Stack>
              </SectionCard>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="Status">
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <StatusChip status={request.status} size="medium" />
                {request.urgency === "urgent" && <StatusChip status="urgent" size="medium" />}
              </Stack>
              <Stack spacing={1.25}>
                {[
                  ["Submitted", formatDateTime(request.created_at)],
                  ["Routed to an expert", formatDateTime(request.assigned_at)],
                  ["Action plan delivered", formatDateTime(request.answered_at)],
                ].map(([label, value]) => (
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
                    <Typography sx={{ fontSize: "0.86rem" }}>{value}</Typography>
                  </Box>
                ))}
              </Stack>
              <Button component={Link} href="/dashboard/hotline/new" variant="contained" fullWidth>
                Ask another question
              </Button>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
