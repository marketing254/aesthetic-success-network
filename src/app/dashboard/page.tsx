import Link from "next/link";
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listMemberRequests, listPublishedDeals, listPublishedKits } from "@/lib/portal/data";
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

export default async function MemberDashboardPage() {
  const identity = await requirePortalPage("member");
  const member = identity.member!;

  let requests, deals, kits;
  try {
    [requests, deals, kits] = await Promise.all([
      listMemberRequests(member.id),
      listPublishedDeals(),
      listPublishedKits(),
    ]);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Member portal" title={`Welcome back, ${member.firstName}`} />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  const open = requests.filter((r) => r.status === "submitted" || r.status === "assigned");
  const answered = requests.filter((r) => r.status === "answered");
  const recent = requests.slice(0, 5);

  return (
    <Box>
      <PageHeader
        eyebrow={`${member.tier} member`}
        title={`Welcome back, ${member.firstName}`}
        description={
          member.practiceName
            ? `${member.practiceName} · Ask the Hotline anything about running your practice — you'll get a written action plan in 2–3 business days.`
            : "Ask the Hotline anything about running your practice — you'll get a written action plan in 2–3 business days."
        }
        action={
          <Button component={Link} href="/dashboard/hotline/new" variant="contained">
            Ask the Hotline
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Open questions" value={open.length} hint="In the queue" href="/dashboard/hotline" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Action plans"
            value={answered.length}
            hint="Ready to read"
            href="/dashboard/hotline"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Vendor deals" value={deals.length} hint="Member-only" href="/dashboard/deals" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Expert kits" value={kits.length} hint="In the library" href="/dashboard/kits" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard
            title="Your recent questions"
            padded={recent.length === 0}
            action={
              <Button component={Link} href="/dashboard/hotline" size="small">
                View all
              </Button>
            }
          >
            {recent.length === 0 ? (
              <EmptyState
                title="No questions yet"
                description="The Expert Hotline is the core of your membership. Ask anything — pricing, staffing, marketing, compliance — and get a written plan back."
                actionLabel="Ask your first question"
                actionHref="/dashboard/hotline/new"
              />
            ) : (
              <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
                {recent.map((r) => (
                  <Box
                    key={r.id}
                    component={Link}
                    href={`/dashboard/hotline/${r.id}`}
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
                          Asked {formatDate(r.created_at)}
                        </Typography>
                      </Box>
                      <StatusChip status={r.status} />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <SectionCard title="Latest expert kits" padded={kits.length === 0}>
              {kits.length === 0 ? (
                <EmptyState title="No kits published yet" description="New kits land weekly." />
              ) : (
                <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
                  {kits.slice(0, 4).map((k) => (
                    <Box key={k.id} sx={{ px: 3, py: 1.75 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.88rem" }}>{k.title}</Typography>
                      <Typography variant="body2" sx={{ fontSize: "0.76rem" }}>
                        {k.expert_name}
                        {k.category ? ` · ${k.category}` : ""}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard title="Newest vendor deals" padded={deals.length === 0}>
              {deals.length === 0 ? (
                <EmptyState title="No deals live yet" description="Partner offers appear here once approved." />
              ) : (
                <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
                  {deals.slice(0, 4).map((d) => (
                    <Box key={d.id} sx={{ px: 3, py: 1.75 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.88rem" }}>{d.title}</Typography>
                      <Typography variant="body2" sx={{ fontSize: "0.76rem" }}>
                        {d.company_name}
                        {d.category ? ` · ${d.category}` : ""}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
