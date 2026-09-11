import { notFound } from "next/navigation";
import { Box, Stack, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import ResourceForm, { type ExpertOption, type ResourceFormInitial } from "../../ResourceForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let resource: ResourceFormInitial | null = null;
  let experts: ExpertOption[] = [];
  let error: string | null = null;

  try {
    const supabase = getSupabaseAdmin();

    const [{ data: row, error: rowError }, { data: expertRows, error: expertError }] =
      await Promise.all([
        supabase
          .from("expert_kits")
          .select("id, expert_id, title, category, summary, content, resource_url, status")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("expert_applications")
          .select("id, full_name, company")
          .eq("status", "approved")
          .order("full_name", { ascending: true }),
      ]);
    if (rowError) throw rowError;
    if (expertError) throw expertError;
    resource = (row as ResourceFormInitial | null) ?? null;
    experts = (expertRows ?? []) as ExpertOption[];
  } catch (err) {
    error = errMessage(err);
  }

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          RESOURCES
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Edit resource
        </Typography>
        <Typography sx={{ color: "error.main" }}>Could not load this resource: {error}</Typography>
      </Box>
    );
  }

  if (!resource) return notFound();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          RESOURCES
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Edit resource
        </Typography>
      </Box>

      <ResourceForm experts={experts} initial={resource} />
    </Stack>
  );
}
