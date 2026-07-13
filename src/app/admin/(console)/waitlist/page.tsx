import { Box, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import WaitlistTable, { type WaitlistRow, type Counts } from "./WaitlistTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadData(): Promise<{ rows: WaitlistRow[]; counts: Counts; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const [rowsRes, countsRes] = await Promise.all([
      supabase
        .from("waitlist_signups")
        .select(
          "id, email, first_name, last_name, phone, practice_name, practice_role, locations, challenge, source, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("waitlist_counts").select("*").single(),
    ]);

    if (rowsRes.error) throw rowsRes.error;

    return {
      rows: (rowsRes.data ?? []) as WaitlistRow[],
      counts: (countsRes.data ?? { total: 0, last_24h: 0, last_7d: 0 }) as Counts,
      error: null,
    };
  } catch (err) {
    return {
      rows: [],
      counts: { total: 0, last_24h: 0, last_7d: 0 },
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default async function AdminWaitlistPage() {
  const { rows, counts, error } = await loadData();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          WAITLIST
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Launch waitlist
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
            Supabase isn&apos;t configured yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in
            <code> .env.local</code>, run the migrations in <code>supabase/migrations/</code>, then
            restart the dev server. See <code>supabase/README.md</code>.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.disabled", mt: 1.5, fontSize: "0.78rem" }}>
            Detail: {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return <WaitlistTable initialRows={rows} initialCounts={counts} />;
}
