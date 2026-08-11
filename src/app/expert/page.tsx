import Link from "next/link";
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listExpertKits, listExpertRequests } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import {
  EmptyState,
  MigrationNotice,
  PageHeader,
  SectionCard,
  StatCard,
  StatusChip,
  formatDate,
} from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExpertOverviewPage() {
  const identity = await requirePortalPage("expert");
  const expert = identity.expert!;
  const firstName = expert.fullName.split(" ")[0] || "there";

  let requests, kits;
  try {
    [requests, kits] = await Promise.all([listExpertRequests(expert.id), listExpertKits(expert.id)]);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Expert portal" title={`Welcome, ${firstName}`} />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  const awaiting = requests.filter((r) => r.status === "assigned");
  const answered = requests.filter((r) => r.status === "answered" || r.status === "closed");
  const urgent = awaiting.filter((r) => r.urgency === "urgent");
  const published = kits.filter((k) => k.status === "published");

  return (
    <Box>
      <PageHeader
        eyebrow="Network expert"
        title={`Welcome, ${firstName}`}
        description="Members ask; you answer in writing. Everything routed to you shows up here."
        action={
          <Button component={Link} href="/expert/requests" variant="contained">
            Open the queue
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Awaiting you" value={awaiting.length} hint="Needs an action plan" href="/expert/requests" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Urgent" value={urgent.length} hint="Next business day" href="/expert/requests" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Answered" value={answered.length} hint="All time" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Published kits" value={published.length} hint="In the library" href="/expert/kits" />
        </Grid>
      </Grid>

      <SectionCard
        title="Waiting on you"
        padded={awaiting.length === 0}
        action={
          <Button component={Link} href="/expert/requests" size="small">
            View all
          </Button>
        }
      >
        {awaiting.length === 0 ? (
          <EmptyState
            title="Queue is clear"
            description="Nothing is waiting on you right now. We'll email you the moment a member question is routed your way."
          />
        ) : (
          <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
            {awaiting.slice(0, 6).map((r) => (
              <Box
                key={r.id}
                component={Link}
                href={`/expert/requests/${r.id}`}
                sx={{
                  display: "block",
                  px: 3,
                  py: 2,
                  textDecoration: "none",
                  color: "inherit",
                  "&:hover": { bgcolor: "rgba(217,168,75,0.05)" },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: "0.92rem" }} noWrap>
                      {r.subject}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                      {r.category ? `${r.category} · ` : ""}
                      Routed {formatDate(r.assigned_at)}
                    </Typography>
                  </Box>
                  {r.urgency === "urgent" ? <StatusChip status="urgent" /> : <StatusChip status={r.status} />}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Box>
  );
}
