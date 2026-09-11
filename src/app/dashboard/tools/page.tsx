import { Box, Stack, Typography } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { PageHeader, SectionCard } from "@/components/portal/ui";
import Calculator from "@/components/site/Calculator";
import MarginCalculator from "@/components/site/MarginCalculator";
import ConversionCalculator from "@/components/site/ConversionCalculator";

export const dynamic = "force-dynamic";

/**
 * /dashboard/tools — member-gated home for the calculators.
 *
 * TD's member tools are static per-tool HTML files served through an
 * iframe (dental-specific content ASN doesn't have). ASN's public site
 * already has three real, interactive calculators built for aesthetic
 * practices — this page is those same components, member-gated and
 * given a permanent home in the portal instead of scrolling sections on
 * the marketing site. Nothing is saved server-side (matches TD: "runs
 * in your browser, nothing is sent").
 */
export default async function MemberToolsPage() {
  await requirePortalPage("member");

  return (
    <Box>
      <PageHeader
        eyebrow="Free tools"
        title="Run the numbers"
        description="The same calculators from the public site, gated here for quick access. Nothing you enter is saved or sent — it's all client-side."
      />

      <Stack spacing={3}>
        <SectionCard title="Membership ROI">
          <Typography variant="body2" sx={{ mb: 2 }}>
            If the vendor deals alone don&rsquo;t clear the membership cost, that&rsquo;s worth knowing.
          </Typography>
          <Calculator />
        </SectionCard>

        <SectionCard title="Injectable margin">
          <Typography variant="body2" sx={{ mb: 2 }}>
            Plug in your real cost and price per unit to see profit and margin per treatment.
          </Typography>
          <MarginCalculator />
        </SectionCard>

        <SectionCard title="Consult conversion">
          <Typography variant="body2" sx={{ mb: 2 }}>
            See the monthly and annual revenue impact of lifting your same-day close rate.
          </Typography>
          <ConversionCalculator />
        </SectionCard>
      </Stack>
    </Box>
  );
}
