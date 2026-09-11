import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Box, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import { requirePortalPage } from "@/lib/auth/portal";
import { getMemberPartner, listSavedItemIds } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { EmptyState, MigrationNotice, PageHeader, SectionCard, formatDate } from "@/components/portal/ui";
import SaveButton from "@/components/portal/SaveButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberPartnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requirePortalPage("member");
  const member = identity.member!;
  const { id } = await params;

  let result, savedIds;
  try {
    [result, savedIds] = await Promise.all([getMemberPartner(id), listSavedItemIds(member.id, "partner")]);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Network partners" title="Partner profile" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }
  if (!result) notFound();
  const { partner, deals } = result;

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 3.5 }}>
        <Avatar src={partner.logoUrl ?? undefined} variant="rounded" sx={{ width: 64, height: 64 }}>
          {partner.name[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: "#A87D2C", fontWeight: 700 }}>
            Network partner
          </Typography>
          <Typography variant="h2" sx={{ fontSize: { xs: "1.6rem", md: "2rem" } }}>
            {partner.name}
          </Typography>
          {partner.category && <Chip label={partner.category} size="small" sx={{ mt: 0.5, fontSize: "0.68rem" }} />}
        </Box>
        <SaveButton itemType="partner" itemId={partner.id} initialSaved={savedIds.has(partner.id)} />
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="About">
            <Stack spacing={2}>
              {partner.description && (
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", fontSize: "0.95rem" }}>
                  {partner.description}
                </Typography>
              )}
              {partner.memberDeal && (
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(217,168,75,0.08)", border: "1px solid rgba(217,168,75,0.3)" }}>
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A87D2C", mb: 0.5 }}>
                    Member deal
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.9rem" }}>
                    {partner.memberDeal}
                  </Typography>
                </Box>
              )}
              <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
                {partner.bookingLink && (
                  <Button
                    component="a"
                    href={partner.bookingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    size="small"
                    endIcon={<LaunchRoundedIcon sx={{ fontSize: 15 }} />}
                  >
                    Book / contact
                  </Button>
                )}
                {partner.website && (
                  <Button
                    component="a"
                    href={partner.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    size="small"
                  >
                    Visit website
                  </Button>
                )}
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title={`Deals from ${partner.name}`} padded={deals.length === 0}>
            {deals.length === 0 ? (
              <EmptyState title="No live deals" description="Check back — this partner rotates offers regularly." />
            ) : (
              <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
                {deals.map((d) => (
                  <Box key={d.id} sx={{ px: 3, py: 1.75 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: "0.88rem" }}>{d.title}</Typography>
                    {d.deal_terms && (
                      <Typography variant="body2" sx={{ fontSize: "0.78rem" }}>
                        {d.deal_terms}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ fontSize: "0.72rem", mt: 0.5 }}>
                      {formatDate(d.published_at)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <Button component={Link} href="/dashboard/deals" size="small">
          View all vendor deals →
        </Button>
      </Box>
    </Box>
  );
}
