import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { requirePortalPage } from "@/lib/auth/portal";
import {
  getMemberKitFeedback,
  getPublishedKit,
  listMemberKitInquiries,
  listMemberKitProgress,
} from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { MigrationNotice, PageHeader, RichText, SectionCard, formatDate } from "@/components/portal/ui";
import KitEngagement from "./KitEngagement";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requirePortalPage("member");
  const member = identity.member!;
  const { id } = await params;

  let kit, feedback, progress, inquiries;
  try {
    [kit, feedback, progress, inquiries] = await Promise.all([
      getPublishedKit(id),
      getMemberKitFeedback(member.id, id),
      listMemberKitProgress(member.id),
      listMemberKitInquiries(member.id, id),
    ]);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Expert kits" title="Kit" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }
  if (!kit) notFound();

  const alreadyCompleted = Boolean(progress[id]?.completed_at);

  return (
    <Box>
      <Box
        component={Link}
        href="/dashboard/kits"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          textDecoration: "none",
          color: "text.secondary",
          fontSize: "0.85rem",
          fontWeight: 600,
          mb: 2,
          "&:hover": { color: "#A87D2C" },
        }}
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> All kits
      </Box>

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 1 }}>
        <Typography
          sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A87D2C" }}
        >
          {kit.expert_name}
        </Typography>
        {kit.category && <Chip label={kit.category} size="small" sx={{ fontSize: "0.66rem", height: 20 }} />}
        <Typography variant="body2" sx={{ fontSize: "0.72rem" }}>
          {formatDate(kit.published_at)}
        </Typography>
      </Stack>
      <Typography
        sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.7rem", md: "2.1rem" }, lineHeight: 1.15, mb: 3 }}
      >
        {kit.title}
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard>
            <Stack spacing={1.5}>
              {kit.summary && (
                <Typography variant="body1" sx={{ fontSize: "0.95rem" }}>
                  {kit.summary}
                </Typography>
              )}
              {kit.content && <RichText text={kit.content} />}
              {kit.resource_url && (
                <Box sx={{ pt: 1 }}>
                  <Button
                    component="a"
                    href={kit.resource_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    size="small"
                  >
                    Open the resource
                  </Button>
                </Box>
              )}
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <KitEngagement
              expertKitId={id}
              initialCompleted={alreadyCompleted}
              initialFeedback={feedback}
              initialInquiries={inquiries}
            />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
