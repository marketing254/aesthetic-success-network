import { Box, Stack, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import ResourceForm, { type ExpertOption } from "../ResourceForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadExperts(): Promise<{ experts: ExpertOption[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("expert_applications")
      .select("id, full_name, company")
      .eq("status", "approved")
      .order("full_name", { ascending: true });
    if (error) throw error;
    return { experts: (data ?? []) as ExpertOption[], error: null };
  } catch (err) {
    return { experts: [], error: errMessage(err) };
  }
}

export default async function NewResourcePage() {
  const { experts, error } = await loadExperts();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          RESOURCES
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          New expert kit
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
          Publish a downloadable framework or guide, credited to an approved expert.
        </Typography>
      </Box>

      {error && (
        <Typography variant="body2" sx={{ color: "error.main" }}>
          Could not load approved experts: {error}
        </Typography>
      )}

      <ResourceForm experts={experts} />
    </Stack>
  );
}
