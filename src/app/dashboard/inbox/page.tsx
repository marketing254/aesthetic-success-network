import Link from "next/link";
import { Box, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listMemberAnnouncements, listMemberRequests } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { EmptyState, MigrationNotice, PageHeader, SectionCard, StatusChip, formatDateTime } from "@/components/portal/ui";
import AssistantWidget from "./AssistantWidget";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /dashboard/inbox — a unified notification feed.
 *
 * TD's inbox is fed entirely by its AI assistant's escalations — a
 * feature that's explicitly out of scope this phase (needs an
 * OPENAI_API_KEY the team hasn't approved yet). With that feeder gone,
 * an inbox with nothing but hotline history would just duplicate
 * /dashboard/hotline, so this repurposes it as the member-facing side
 * of the admin Broadcast tool (0022, announcements) plus a quick
 * pointer at recently-answered Hotline questions — the "member in-app
 * notifications system" that 0022's own migration note flagged as
 * Phase 3 scope.
 */
export default async function MemberInboxPage() {
  const identity = await requirePortalPage("member");
  const member = identity.member!;

  let announcements, requests;
  try {
    [announcements, requests] = await Promise.all([listMemberAnnouncements(), listMemberRequests(member.id)]);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Inbox" title="Updates" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  const recentlyAnswered = requests.filter((r) => r.status === "answered" || r.status === "closed").slice(0, 5);

  return (
    <Box>
      <PageHeader eyebrow="Inbox" title="Updates" description="Announcements from the ASN team, plus a quick look at anything the Hotline just answered." />

      <Stack spacing={3}>
        <AssistantWidget />

        <SectionCard title="Hotline activity" padded={recentlyAnswered.length === 0}>
          {recentlyAnswered.length === 0 ? (
            <EmptyState
              title="No answered questions yet"
              description="Ask the Hotline a question and we'll surface the answer here as soon as an expert responds."
              actionLabel="Ask the Hotline"
              actionHref="/dashboard/hotline/new"
            />
          ) : (
            <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
              {recentlyAnswered.map((r) => (
                <Box
                  key={r.id}
                  component={Link}
                  href={`/dashboard/hotline/${r.id}`}
                  sx={{ display: "block", px: 3, py: 2, textDecoration: "none", color: "inherit", "&:hover": { bgcolor: "rgba(217,168,75,0.05)" } }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.92rem" }}>{r.subject}</Typography>
                      <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                        Answered {formatDateTime(r.answered_at)}
                      </Typography>
                    </Box>
                    <StatusChip status={r.status} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>

        <SectionCard title="Announcements" padded={announcements.length === 0}>
          {announcements.length === 0 ? (
            <EmptyState title="Nothing here yet" description="Team announcements will show up here as they're sent." />
          ) : (
            <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
              {announcements.map((a) => (
                <Box key={a.id} sx={{ px: 3, py: 2.25 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{a.title}</Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
                      {formatDateTime(a.sent_at ?? a.created_at)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontSize: "0.88rem", whiteSpace: "pre-line" }}>
                    {a.body}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>
      </Stack>
    </Box>
  );
}
