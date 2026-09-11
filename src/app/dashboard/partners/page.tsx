import Link from "next/link";
import { Avatar, Box, Chip, Grid, Paper, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listMemberPartners, listSavedItemIds } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { EmptyState, MigrationNotice, PageHeader } from "@/components/portal/ui";
import SaveButton from "@/components/portal/SaveButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberPartnersPage() {
  const identity = await requirePortalPage("member");
  const member = identity.member!;

  let partners, savedIds;
  try {
    [partners, savedIds] = await Promise.all([listMemberPartners(), listSavedItemIds(member.id, "partner")]);
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Network partners" title="Vetted partners" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Network partners"
        title="Vendors vetted for aesthetic practices"
        description="Every partner here has an active member deal. Browse the directory, then check Vendor deals for the specific offer."
      />

      {partners.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: "20px", p: 3 }}>
          <EmptyState title="No partners published yet" description="Check back soon." />
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {partners.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
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
                href={`/dashboard/partners/${p.id}`}
              >
                <Box sx={{ position: "absolute", top: 10, right: 10 }}>
                  <SaveButton itemType="partner" itemId={p.id} initialSaved={savedIds.has(p.id)} />
                </Box>
                <Avatar src={p.logoUrl ?? undefined} variant="rounded" sx={{ width: 52, height: 52 }}>
                  {p.name[0]}
                </Avatar>
                <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "text.primary" }}>
                  {p.name}
                </Typography>
                {p.category && (
                  <Chip
                    label={p.category}
                    size="small"
                    sx={{ alignSelf: "flex-start", fontSize: "0.68rem", bgcolor: "rgba(10,19,32,0.05)" }}
                  />
                )}
                {p.description && (
                  <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                    {p.description}
                  </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                {p.dealCount > 0 && (
                  <Typography variant="body2" sx={{ fontSize: "0.76rem", color: "#A87D2C", fontWeight: 700 }}>
                    {p.dealCount} member {p.dealCount === 1 ? "deal" : "deals"}
                  </Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
