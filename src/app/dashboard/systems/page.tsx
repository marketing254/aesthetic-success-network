import Link from "next/link";
import { Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listPublishedSops } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { EmptyState, MigrationNotice, PageHeader, SectionCard, formatDate } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /dashboard/systems — "Systems & SOPs".
 *
 * TD's Systems tab turned out to be a small, expert-approved library of
 * standard-operating-procedure documents members can run with their team
 * immediately — shorter and more prescriptive than an expert kit, and a
 * distinct content type from it. TD stores these as a hardcoded array
 * pointing at real uploaded PDFs in TD's own storage bucket, which ASN has
 * no equivalent assets for, so this ports as a real, admin-manageable
 * table (public.system_sops, 0026) seeded with original ASN content
 * instead of copying TD's files or its pdf.js viewer dependency.
 */
export default async function MemberSystemsPage() {
  await requirePortalPage("member");

  let sops;
  try {
    sops = await listPublishedSops();
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Operating playbooks" title="Systems & SOPs" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  const groups = new Map<string, typeof sops>();
  for (const s of sops) {
    const key = s.category ?? "General";
    const bucket = groups.get(key) ?? [];
    bucket.push(s);
    groups.set(key, bucket);
  }
  const categories = Array.from(groups.keys()).sort();

  return (
    <Box>
      <PageHeader
        eyebrow="Operating playbooks"
        title="Systems & SOPs"
        description="Short, run-it-today standard operating procedures your team can use immediately — scripts, checklists and handoffs, not full kits."
      />

      {sops.length === 0 ? (
        <SectionCard padded>
          <EmptyState title="No SOPs published yet" description="The first playbooks are being written now." />
        </SectionCard>
      ) : (
        <Stack spacing={4}>
          {categories.map((cat) => (
            <Box key={cat}>
              <Typography
                sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "text.secondary", mb: 1.5 }}
              >
                {cat}
              </Typography>
              <Grid container spacing={2}>
                {groups.get(cat)!.map((s) => (
                  <Grid key={s.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper
                      component={Link}
                      href={`/dashboard/systems/${s.slug}`}
                      variant="outlined"
                      sx={{
                        display: "block",
                        borderRadius: "16px",
                        p: 2.5,
                        height: "100%",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "border-color .2s, transform .2s",
                        "&:hover": { borderColor: "rgba(217,168,75,0.6)", transform: "translateY(-2px)" },
                      }}
                    >
                      {s.expert_name && (
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                          <Chip
                            label={s.expert_name}
                            size="small"
                            sx={{ fontSize: "0.64rem", height: 20, bgcolor: "rgba(217,168,75,0.14)", color: "#A87D2C" }}
                          />
                        </Stack>
                      )}
                      <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", lineHeight: 1.25 }}>
                        {s.title}
                      </Typography>
                      {s.summary && (
                        <Typography variant="body2" sx={{ fontSize: "0.82rem", mt: 0.5 }}>
                          {s.summary}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ fontSize: "0.72rem", mt: 1.5 }}>
                        {formatDate(s.published_at)}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
