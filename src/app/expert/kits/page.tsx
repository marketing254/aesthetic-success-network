import { Box } from "@mui/material";
import { requirePortalPage } from "@/lib/auth/portal";
import { listExpertKits } from "@/lib/portal/data";
import { errMessage } from "@/lib/errMessage";
import { MigrationNotice, PageHeader } from "@/components/portal/ui";
import KitsManager, { type KitRow } from "./KitsManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExpertKitsPage() {
  const identity = await requirePortalPage("expert");
  const expert = identity.expert!;

  let kits: KitRow[];
  try {
    kits = (await listExpertKits(expert.id)) as unknown as KitRow[];
  } catch (err) {
    return (
      <Box>
        <PageHeader eyebrow="Expert kits" title="My kits" />
        <MigrationNotice detail={errMessage(err)} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Expert kits"
        title="My kits"
        description="Playbooks, scripts and checklists for members. Published kits appear in every member's library immediately."
      />
      <KitsManager initialKits={kits} />
    </Box>
  );
}
