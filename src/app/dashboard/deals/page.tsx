import { Box, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listPublishedDeals } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { EmptyState, MigrationNotice, PageHeader, SectionCard, formatDate } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberDealsPage() {
  await requirePortalPage("member");

  let deals;
  try {
    deals = await listPublishedDeals();
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Member benefits" title="Vendor deals" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Member benefits"
        title="Vendor deals"
        description="Member-only pricing from partners our team has vetted. Every deal here is curated, never an algorithm's pick."
      />

      {deals.length === 0 ? (
        <SectionCard padded>
          <EmptyState
            title="No deals live yet"
            description="Partner offers appear here as soon as they're approved. We're onboarding the first cohort now."
          />
        </SectionCard>
      ) : (
        <Grid container spacing={2}>
          {deals.map((d) => (
            <Grid key={d.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: "20px",
                  p: 3,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.25,
                }}
              >
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
                    {d.company_name}
                  </Typography>
                  {d.category && (
                    <Chip
                      label={d.category}
                      size="small"
                      sx={{ fontSize: "0.66rem", height: 20, bgcolor: "rgba(10,19,32,0.05)" }}
                    />
                  )}
                </Stack>

                <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", lineHeight: 1.25 }}>
                  {d.title}
                </Typography>

                {d.description && (
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {d.description}
                  </Typography>
                )}

                {d.deal_terms && (
                  <Box
                    sx={{
                      mt: 0.5,
                      p: 1.75,
                      borderRadius: "12px",
                      bgcolor: "rgba(217,168,75,0.1)",
                      border: "1px solid rgba(217,168,75,0.3)",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.64rem",
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "#7A5C10",
                        mb: 0.5,
                      }}
                    >
                      Member deal
                    </Typography>
                    <Typography sx={{ fontSize: "0.87rem", fontWeight: 600, color: "text.primary" }}>
                      {d.deal_terms}
                    </Typography>
                  </Box>
                )}

                {d.redemption_note && (
                  <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                    {d.redemption_note}
                  </Typography>
                )}

                <Box sx={{ flex: 1 }} />

                <Stack direction="row" spacing={1} sx={{ alignItems: "center", pt: 0.5 }}>
                  {d.redemption_url && (
                    <Button
                      component="a"
                      href={d.redemption_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="contained"
                      size="small"
                    >
                      Claim this deal
                    </Button>
                  )}
                  <Typography variant="body2" sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                    Live since {formatDate(d.published_at)}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
