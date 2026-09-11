import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import ResourcesTable, { type ResourceRow } from "./ResourcesTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadRows(): Promise<{ rows: ResourceRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("expert_kits")
      .select(
        "id, expert_id, expert_name, title, category, summary, content, resource_url, status, published_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { rows: (data ?? []) as ResourceRow[], error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

export default async function AdminResourcesPage() {
  const { rows, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          RESOURCES
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Expert kits
        </Typography>
        <Box
          sx={{
            p: 3,
            borderRadius: "20px",
            border: "1px solid",
            borderColor: "error.light",
            bgcolor: "rgba(220,60,60,0.04)",
          }}
        >
          <Typography sx={{ color: "error.main", fontWeight: 600, mb: 1 }}>
            The expert kits table isn&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0008_portals.sql</code> in the Supabase SQL editor, then
            refresh. Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Stack spacing={3.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
            RESOURCES
          </Typography>
          <Typography
            variant="h2"
            sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}
          >
            Expert kits
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
            Downloadable frameworks and guides authored by approved experts, published to the
            member-facing Resources library.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/admin/resources/new"
          variant="contained"
          startIcon={<AddOutlinedIcon />}
        >
          New resource
        </Button>
      </Stack>

      <ResourcesTable initialRows={rows} />
    </Stack>
  );
}
