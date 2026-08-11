import { Box } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listPartnerDeals } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { MigrationNotice, PageHeader } from "@/components/portal/ui";
import DealsManager, { type DealRow } from "./DealsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerDealsPage() {
  const identity = await requirePortalPage("partner");
  const partner = identity.partner!;

  let deals: DealRow[];
  try {
    deals = (await listPartnerDeals(partner.id)) as unknown as DealRow[];
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Member offers" title="My deals" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Member offers"
        title="My deals"
        description="Draft freely; submit when you're ready. Our team publishes the ones that are a genuine fit for members."
      />
      <DealsManager initialDeals={deals} />
    </Box>
  );
}
