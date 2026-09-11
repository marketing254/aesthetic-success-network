import Link from "next/link";
import { Avatar, Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listMemberExperts, listSavedItemIds } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { EmptyState, MigrationNotice, PageHeader } from "@/components/portal/ui";
import SaveButton from "@/components/portal/SaveButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberExpertsPage() {
  const identity = await requirePortalPage("member");
  const member = identity.member!;

  let experts, savedIds;
  try {
    [experts, savedIds] = await Promise.all([listMemberExperts(), listSavedItemIds(member.id, "expert")]);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Network experts" title="Meet the experts" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Network experts"
        title="Meet the experts behind your kits"
        description="Every kit and Hotline answer traces back to a real, vetted practitioner. Save the ones you want to keep an eye on."
      />

      {experts.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: "20px", p: 3 }}>
          <EmptyState title="No experts published yet" description="Check back soon." />
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {experts.map((e) => (
            <Grid key={e.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper
                variant="outlined"
                sx={{
                  position: "relative",
                  borderRadius: "20px",
                  p: 2.5,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  textDecoration: "none",
                  transition: "border-color .2s, transform .2s",
                  "&:hover": { borderColor: "rgba(217,168,75,0.6)", transform: "translateY(-2px)" },
                }}
                component={Link}
                href={`/dashboard/experts/${e.id}`}
              >
                <Box sx={{ position: "absolute", top: 10, right: 10 }}>
                  <SaveButton itemType="expert" itemId={e.id} initialSaved={savedIds.has(e.id)} />
                </Box>
                <Avatar src={e.headshotUrl ?? undefined} sx={{ width: 52, height: 52 }}>
                  {e.name[0]}
                </Avatar>
                <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "text.primary" }}>
                  {e.name}
                </Typography>
                {e.company && (
                  <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                    {e.company}
                  </Typography>
                )}
                {e.topics && (
                  <Typography variant="body2" sx={{ fontSize: "0.82rem" }} noWrap>
                    {e.topics}
                  </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                {e.kitCount > 0 && (
                  <Chip
                    label={`${e.kitCount} ${e.kitCount === 1 ? "kit" : "kits"}`}
                    size="small"
                    sx={{ alignSelf: "flex-start", fontSize: "0.68rem", bgcolor: "rgba(10,19,32,0.05)" }}
                  />
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
