import Link from "next/link";
import { Box, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listExpertRequests } from "@/lib/portal/data";
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

export default async function ExpertRequestsPage() {
  const identity = await requirePortalPage("expert");
  const expert = identity.expert!;

  let requests;
  try {
    requests = await listExpertRequests(expert.id);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Expert Hotline" title="Your queue" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  // Open work first, then history — urgent floats to the top of each group.
  const rank = (s: string) => (s === "assigned" ? 0 : s === "answered" ? 1 : 2);
  const sorted = [...requests].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      Number(b.urgency === "urgent") - Number(a.urgency === "urgent") ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <Box>
      <PageHeader
        eyebrow="Expert Hotline"
        title="Your queue"
        description="Requests our team has routed to you. Open one to write the action plan."
      />

      <SectionCard padded={sorted.length === 0}>
        {sorted.length === 0 ? (
          <EmptyState
            title="Nothing routed to you yet"
            description="When a member question matches your expertise, it lands here and we email you."
          />
        ) : (
          <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
            {sorted.map((r) => (
              <Box
                key={r.id}
                component={Link}
                href={`/expert/requests/${r.id}`}
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
                    <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", mb: 0.4 }}>
                      {r.subject}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.79rem" }}>
                      {r.category ? `${r.category} · ` : ""}
                      Asked {formatDate(r.created_at)}
                      {r.assigned_at ? ` · Routed ${formatDate(r.assigned_at)}` : ""}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    {r.urgency === "urgent" && <StatusChip status="urgent" />}
                    <StatusChip status={r.status} />
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Box>
  );
}
