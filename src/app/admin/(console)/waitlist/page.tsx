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
          "id, role, email, full_name, practice_name, phone, city_state, message, source, status, created_at, launch_email_sent_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("waitlist_counts").select("*").single(),
    ]);

    if (rowsRes.error) throw rowsRes.error;

    return {
      rows: (rowsRes.data ?? []) as WaitlistRow[],
      counts: (countsRes.data ?? { total: 0, members: 0, vendors: 0, last_24h: 0 }) as Counts,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      rows: [],
      counts: { total: 0, members: 0, vendors: 0, last_24h: 0 },
      error: message,
    };
  }
}

export default async function AdminWaitlistPage() {
  const { rows, counts, error } = await loadData();

  if (error) {
    return (
      <Box>
        <Typography variant="overline" sx={{ display: "block" }}>
          WAITLIST
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 2, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Launch waitlist
        </Typography>
        <Box
          sx={{
            p: 3,
            borderRadius: "18px",
            border: "1px solid",
            borderColor: "error.light",
            bgcolor: "rgba(140,29,29,0.04)",
          }}
        >
          <Typography sx={{ color: "error.main", fontWeight: 600, mb: 1 }}>
            Supabase isn&apos;t configured yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in
            <code> .env.local</code>, then restart the dev server. See <code>SUPABASE_SETUP_GUIDE.md</code> in the
            repo root for the 5-minute walkthrough.
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
