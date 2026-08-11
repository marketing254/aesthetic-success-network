import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { getExpertRequest } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import {
  MigrationNotice,
  PageHeader,
  RichText,
  SectionCard,
  StatusChip,
  formatDateTime,
} from "@/components/portal/ui";
import AnswerForm from "./AnswerForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExpertRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const identity = await requirePortalPage("expert");
  const expert = identity.expert!;

  let result;
  try {
    result = await getExpertRequest(expert.id, id);
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
  const submitted = response?.status === "submitted";

  return (
    <Box>
      <PageHeader
        eyebrow="Expert Hotline"
        title={request.subject}
        description={`${request.category ? `${request.category} · ` : ""}Asked ${formatDateTime(request.created_at)}`}
        action={
          <Button component={Link} href="/expert/requests" variant="outlined">
            Back to queue
          </Button>
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <SectionCard title="The question">
              <RichText text={request.details} />
            </SectionCard>

            <SectionCard title={submitted ? "Your action plan" : "Write the action plan"}>
              <AnswerForm
                requestId={request.id}
                initialSummary={response?.summary ?? ""}
                initialActionPlan={response?.action_plan ?? ""}
                submitted={submitted}
              />
            </SectionCard>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <SectionCard title="Request">
              <Stack spacing={2}>
                <Stack direction="row" spacing={1}>
                  <StatusChip status={request.status} size="medium" />
                  {request.urgency === "urgent" && <StatusChip status="urgent" size="medium" />}
                </Stack>
                {[
                  ["Asked", formatDateTime(request.created_at)],
                  ["Routed to you", formatDateTime(request.assigned_at)],
                  ["Delivered", formatDateTime(request.answered_at)],
                  ["Draft last saved", formatDateTime(response?.updated_at)],
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
            </SectionCard>

            <SectionCard title="What makes a good plan">
              <Stack spacing={1.5}>
                {[
                  ["Lead with the answer", "The one-liner should stand on its own."],
                  ["Sequence the steps", "Ordered actions beat a list of considerations."],
                  ["Size it to two weeks", "What can they actually start on Monday?"],
                  ["Name the metric", "Tell them what to measure and when to check."],
                ].map(([title, body]) => (
                  <Box key={title}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>{title}</Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                      {body}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
