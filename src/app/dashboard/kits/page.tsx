import { Box, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listPublishedKits } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import {
  EmptyState,
  MigrationNotice,
  PageHeader,
  RichText,
  SectionCard,
  formatDate,
} from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberKitsPage() {
  await requirePortalPage("member");

  let kits;
  try {
    kits = await listPublishedKits();
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Member benefits" title="Expert kits" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  const [featured, ...rest] = kits;

  return (
    <Box>
      <PageHeader
        eyebrow="Member benefits"
        title="Expert kits"
        description="Playbooks, scripts and checklists from the network's experts. New kits land weekly."
      />

      {kits.length === 0 ? (
        <SectionCard padded>
          <EmptyState
            title="No kits published yet"
            description="The first kits are being written now. You'll see them here — and we'll email you when they land."
          />
        </SectionCard>
      ) : (
        <Stack spacing={2}>
          {/* Newest kit gets the full read inline. */}
          <SectionCard title="Latest kit">
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#A87D2C",
                  }}
                >
                  {featured!.expert_name}
                </Typography>
                {featured!.category && (
                  <Chip
                    label={featured!.category}
                    size="small"
                    sx={{ fontSize: "0.66rem", height: 20, bgcolor: "rgba(10,19,32,0.05)" }}
                  />
                )}
                <Typography variant="body2" sx={{ fontSize: "0.72rem" }}>
                  {formatDate(featured!.published_at)}
                </Typography>
              </Stack>
              <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.65rem", lineHeight: 1.2 }}>
                {featured!.title}
              </Typography>
              {featured!.summary && (
                <Typography variant="body1" sx={{ fontSize: "0.95rem" }}>
                  {featured!.summary}
                </Typography>
              )}
              {featured!.content && (
                <Box sx={{ pt: 1 }}>
                  <RichText text={featured!.content} />
                </Box>
              )}
              {featured!.resource_url && (
                <Box sx={{ pt: 1 }}>
                  <Button
                    component="a"
                    href={featured!.resource_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    size="small"
                  >
                    Open the resource
                  </Button>
                </Box>
              )}
            </Stack>
          </SectionCard>

          {rest.length > 0 && (
            <Grid container spacing={2}>
              {rest.map((k) => (
                <Grid key={k.id} size={{ xs: 12, md: 6, lg: 4 }}>
                  <Paper
                    variant="outlined"
                    sx={{ borderRadius: "20px", p: 3, height: "100%", display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Typography
                        sx={{
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "#A87D2C",
                        }}
                      >
                        {k.expert_name}
                      </Typography>
                      {k.category && (
                        <Chip
                          label={k.category}
                          size="small"
                          sx={{ fontSize: "0.64rem", height: 20, bgcolor: "rgba(10,19,32,0.05)" }}
                        />
                      )}
                    </Stack>
                    <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", lineHeight: 1.25 }}>
                      {k.title}
                    </Typography>
                    {k.summary && (
                      <Typography variant="body2" sx={{ fontSize: "0.84rem" }}>
                        {k.summary}
                      </Typography>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", pt: 0.5 }}>
                      {k.resource_url && (
                        <Button
                          component="a"
                          href={k.resource_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="outlined"
                          size="small"
                        >
                          Open resource
                        </Button>
                      )}
                      <Typography variant="body2" sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                        {formatDate(k.published_at)}
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      )}
    </Box>
  );
}
