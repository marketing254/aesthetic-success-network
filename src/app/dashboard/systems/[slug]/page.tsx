import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Chip, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { requirePortalPage } from "@/lib/auth/portal";
import { getPublishedSop } from "@/lib/portal/data";
import { RichText, SectionCard, formatDate } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberSystemSopPage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePortalPage("member");
  const { slug } = await params;

  const sop = await getPublishedSop(slug);
  if (!sop) notFound();

  return (
    <Box>
      <Box
        component={Link}
        href="/dashboard/systems"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, textDecoration: "none", color: "text.secondary", fontSize: "0.85rem", fontWeight: 600, mb: 3 }}
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> All systems &amp; SOPs
      </Box>

      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 1 }}>
            {sop.category && (
              <Chip label={sop.category} size="small" sx={{ fontSize: "0.66rem", height: 20, bgcolor: "rgba(10,19,32,0.05)" }} />
            )}
            <Typography variant="body2" sx={{ fontSize: "0.76rem" }}>
              {formatDate(sop.published_at)}
            </Typography>
          </Stack>
          <Typography variant="h2" sx={{ fontSize: { xs: "1.75rem", md: "2.1rem" } }}>
            {sop.title}
          </Typography>
          {sop.expert_name && (
            <Typography variant="body2" sx={{ mt: 0.75 }}>
              Contributed by {sop.expert_name}
            </Typography>
          )}
          {sop.summary && (
            <Typography sx={{ mt: 1.5, fontSize: "0.98rem" }}>{sop.summary}</Typography>
          )}
        </Box>

        <SectionCard>
          <RichText text={sop.content} />
        </SectionCard>
      </Stack>
    </Box>
  );
}
