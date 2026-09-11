import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Box, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import { requirePortalPage } from "@/lib/auth/portal";
import { getMemberExpert, listSavedItemIds } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { EmptyState, MigrationNotice, PageHeader, SectionCard, formatDate } from "@/components/portal/ui";
import SaveButton from "@/components/portal/SaveButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberExpertProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requirePortalPage("member");
  const member = identity.member!;
  const { id } = await params;

  let result, savedIds;
  try {
    [result, savedIds] = await Promise.all([getMemberExpert(id), listSavedItemIds(member.id, "expert")]);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Network experts" title="Expert profile" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }
  if (!result) notFound();
  const { expert, kits } = result;

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 3.5 }}>
        <Avatar src={expert.headshotUrl ?? undefined} sx={{ width: 64, height: 64 }}>
          {expert.name[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: "#A87D2C", fontWeight: 700 }}>
            Network expert
          </Typography>
          <Typography variant="h2" sx={{ fontSize: { xs: "1.6rem", md: "2rem" } }}>
            {expert.name}
          </Typography>
          {expert.company && (
            <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
              {expert.company}
            </Typography>
          )}
        </Box>
        <SaveButton itemType="expert" itemId={expert.id} initialSaved={savedIds.has(expert.id)} />
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard title="About">
            <Stack spacing={2}>
              {expert.topics && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                  {expert.topics
                    .split(/[,\n;]+/)
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (
                      <Chip key={t} label={t} size="small" sx={{ fontSize: "0.7rem" }} />
                    ))}
                </Stack>
              )}
              {expert.bio && (
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", fontSize: "0.95rem" }}>
                  {expert.bio}
                </Typography>
              )}
              <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
                {expert.bookingLink && (
                  <Button
                    component="a"
                    href={expert.bookingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    size="small"
                    endIcon={<LaunchRoundedIcon sx={{ fontSize: 15 }} />}
                  >
                    Book a call
                  </Button>
                )}
                {expert.website && (
                  <Button
                    component="a"
                    href={expert.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    size="small"
                  >
                    Visit website
                  </Button>
                )}
                <Button component={Link} href="/dashboard/hotline/new" variant="outlined" size="small">
                  Ask the Hotline
                </Button>
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title={`Kits from ${expert.name}`} padded={kits.length === 0}>
            {kits.length === 0 ? (
              <EmptyState title="No kits yet" description="This expert hasn't published a kit." />
            ) : (
              <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
                {kits.map((k) => (
                  <Box
                    key={k.id}
                    component={Link}
                    href={`/dashboard/resources/${k.id}`}
                    sx={{ display: "block", px: 3, py: 1.75, textDecoration: "none", color: "inherit", "&:hover": { bgcolor: "rgba(217,168,75,0.05)" } }}
                  >
                    <Typography sx={{ fontWeight: 600, fontSize: "0.88rem" }}>{k.title}</Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.76rem" }}>
                      {k.category ? `${k.category} · ` : ""}
                      {formatDate(k.published_at)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
