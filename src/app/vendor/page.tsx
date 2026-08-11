import Link from "next/link";
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listPartnerDeals } from "@/lib/portal/data";
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

export default async function PartnerOverviewPage() {
  const identity = await requirePortalPage("partner");
  const partner = identity.partner!;

  let deals;
  try {
    deals = await listPartnerDeals(partner.id);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Partner portal" title={partner.companyName} />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  const published = deals.filter((d) => d.status === "published");
  const inReview = deals.filter((d) => d.status === "pending_review");
  const drafts = deals.filter((d) => d.status === "draft");

  return (
    <Box>
      <PageHeader
        eyebrow="Vetted partner"
        title={partner.companyName}
        description="Publish member-only offers. Our team reviews each one before it goes live — that curation is what members are paying for."
        action={
          <Button component={Link} href="/vendor/deals" variant="contained">
            Manage deals
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Live to members" value={published.length} hint="Published" href="/vendor/deals" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="In review" value={inReview.length} hint="With our team" href="/vendor/deals" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Drafts" value={drafts.length} hint="Not submitted" href="/vendor/deals" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Total deals" value={deals.length} hint="All time" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard
            title="Your deals"
            padded={deals.length === 0}
            action={
              <Button component={Link} href="/vendor/deals" size="small">
                Manage
              </Button>
            }
          >
            {deals.length === 0 ? (
              <EmptyState
                title="No deals yet"
                description="Add your member offer and submit it for review. Most are approved within two business days."
                actionLabel="Create your first deal"
                actionHref="/vendor/deals"
              />
            ) : (
              <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
                {deals.slice(0, 6).map((d) => (
                  <Stack
                    key={d.id}
                    direction="row"
                    spacing={1.5}
                    sx={{ px: 3, py: 2, alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.92rem" }} noWrap>
                        {d.title}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                        {d.category ? `${d.category} · ` : ""}
                        Updated {formatDate(d.updated_at)}
                      </Typography>
                    </Box>
                    <StatusChip status={d.status} />
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title="How review works">
            <Stack spacing={1.75}>
              {[
                ["1. Draft it", "Save as many drafts as you like — members never see them."],
                ["2. Submit for review", "Our team checks the offer is real, clear and member-worthy."],
                ["3. We publish", "Approved deals appear in every member's Vendor deals tab."],
                ["4. Edit anytime", "Editing a live deal pulls it back into review so nothing changes under members' feet."],
              ].map(([title, body]) => (
                <Box key={title}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.87rem" }}>{title}</Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                    {body}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
