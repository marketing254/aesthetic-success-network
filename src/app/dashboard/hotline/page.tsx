import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listMemberRequests } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import {
  EmptyState,
  MigrationNotice,
  PageHeader,
  SectionCard,
  StatusChip,
  formatDate,
} from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberHotlinePage() {
  const identity = await requirePortalPage("member");
  const member = identity.member!;

  let requests;
  try {
    requests = await listMemberRequests(member.id);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Expert Hotline" title="Your questions" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Expert Hotline"
        title="Your questions"
        description="Every question gets routed to the right expert and comes back as a written action plan within 2–3 business days."
        action={
          <Button component={Link} href="/dashboard/hotline/new" variant="contained">
            New question
          </Button>
        }
      />

      <SectionCard padded={requests.length === 0}>
        {requests.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description="Ask your first question — pricing, staffing, marketing, compliance, anything about running the practice."
            actionLabel="Ask the Hotline"
            actionHref="/dashboard/hotline/new"
          />
        ) : (
          <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
            {requests.map((r) => (
              <Box
                key={r.id}
                component={Link}
                href={`/dashboard/hotline/${r.id}`}
                sx={{
                  display: "block",
                  px: 3,
                  py: 2.25,
                  textDecoration: "none",
                  color: "inherit",
                  "&:hover": { bgcolor: "rgba(217,168,75,0.05)" },
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.4 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.95rem" }}>{r.subject}</Typography>
                      {r.urgency === "urgent" && <StatusChip status="urgent" />}
                    </Stack>
                    <Typography variant="body2" sx={{ fontSize: "0.79rem" }}>
                      {r.category ? `${r.category} · ` : ""}
                      Asked {formatDate(r.created_at)}
                      {r.answered_at ? ` · Answered ${formatDate(r.answered_at)}` : ""}
                    </Typography>
                  </Box>
                  <StatusChip status={r.status} />
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Box>
  );
}
