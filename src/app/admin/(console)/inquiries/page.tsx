import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";
import InquiriesTable, { type InquiryRow } from "./InquiriesTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const INQUIRY_COLUMNS =
  "id, expert_kit_id, member_id, name, email, question, status, admin_note, resolved_by, resolved_at, created_at, updated_at";

async function loadRows(): Promise<{ rows: InquiryRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("resource_inquiries")
      .select(INQUIRY_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const rows = data ?? [];
    const kitIds = Array.from(
      new Set(rows.map((r) => r.expert_kit_id).filter((id): id is string => Boolean(id))),
    );

    let kitTitles: Record<string, string> = {};
    if (kitIds.length > 0) {
      const { data: kits, error: kitsError } = await supabase
        .from("expert_kits")
        .select("id, title")
        .in("id", kitIds);
      if (kitsError) throw kitsError;
      kitTitles = Object.fromEntries((kits ?? []).map((k) => [k.id as string, k.title as string]));
    }

    const merged = rows.map((r) => ({
      ...r,
      kit_title: r.expert_kit_id ? (kitTitles[r.expert_kit_id as string] ?? null) : null,
    })) as InquiryRow[];

    return { rows: merged, error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

export default async function AdminInquiriesPage() {
  const { rows, error } = await loadRows();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          INQUIRIES
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Resource inquiries
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
            The resource inquiries table isn&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0021_resource_inquiries.sql</code> in the Supabase SQL
            editor, then refresh. Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <InquiriesTable initialRows={rows} />;
}
