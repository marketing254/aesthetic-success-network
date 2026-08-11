import { Box, Grid, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { PageHeader, SectionCard } from "@/components/portal/ui";
import NewRequestForm from "./NewRequestForm";

export const dynamic = "force-dynamic";

export default async function NewHotlineRequestPage() {
  await requirePortalPage("member");

  return (
    <Box>
      <PageHeader
        eyebrow="Expert Hotline"
        title="Ask a question"
        description="One question per request keeps the action plan sharp. If you have two unrelated problems, submit them separately."
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <SectionCard>
            <NewRequestForm />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="What you'll get back">
            <Stack spacing={1.75}>
              {[
                ["A one-line answer", "The short version, up top, so you can act immediately."],
                ["A written action plan", "Concrete steps, in order, sized for the next two weeks."],
                ["From a vetted expert", "Matched to your question — not a generalist, not an algorithm."],
                ["Kept in your portal", "Every plan stays here. Revisit them any time."],
              ].map(([title, body]) => (
                <Box key={title}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.88rem" }}>{title}</Typography>
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
