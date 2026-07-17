import { Box, Chip, Stack, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errMessage } from "@/lib/errMessage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AuditRow = {
  kind: "review" | "auth";
  action: string;
  target: string;
  actor: string;
  note: string | null;
  created_at: string;
};

const TARGET_LABEL: Record<string, string> = {
  waitlist_signup: "Waitlist",
  expert_application: "Expert app",
  partner_application: "Partner app",
  member: "Member",
  admin_user: "Admin team",
};

async function loadRows(): Promise<{ rows: AuditRow[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const [reviews, auth] = await Promise.all([
      supabase
        .from("review_actions")
        .select("target_type, target_id, action, note, admin_email, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("auth_audit")
        .select("event, email, user_type, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (reviews.error) throw reviews.error;

    const rows: AuditRow[] = [
      ...(reviews.data ?? []).map((r) => ({
        kind: "review" as const,
        action: r.action as string,
        target: TARGET_LABEL[r.target_type as string] ?? (r.target_type as string),
        actor: r.admin_email as string,
        note: (r.note as string | null) ?? null,
        created_at: r.created_at as string,
      })),
      ...(auth.data ?? []).map((r) => ({
        kind: "auth" as const,
        action: r.event as string,
        target: `Sign-in (${(r.user_type as string | null) ?? "admin"})`,
        actor: (r.email as string | null) ?? "—",
        note: null,
        created_at: r.created_at as string,
      })),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: errMessage(err) };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminAuditLogPage() {
  const { rows, error } = await loadRows();

  return (
    <Stack spacing={3.5}>
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          SYSTEM
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Audit log
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 640 }}>
          Every admin state change and sign-in, newest first. This is the source of truth for who
          did what, when.
        </Typography>
      </Box>

      {error && (
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
            The audit tables aren&apos;t available yet.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run <code>supabase/migrations/0006_members_and_audit.sql</code> in the Supabase SQL
            editor, then refresh. Detail: {error}
          </Typography>
        </Box>
      )}

      {!error && (
        <Box
          sx={{
            borderRadius: "20px",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "common.white",
            overflow: "hidden",
          }}
        >
          {rows.length === 0 ? (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Admin actions and sign-ins will appear here as they happen.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  "& th": {
                    textAlign: "left",
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "text.secondary",
                    fontWeight: 700,
                    px: 2.5,
                    py: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: "rgba(247,245,240,0.6)",
                  },
                  "& td": {
                    px: 2.5,
                    py: 1.6,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    fontSize: "0.86rem",
                    verticalAlign: "top",
                  },
                  "& tr:last-child td": { borderBottom: "none" },
                }}
              >
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th">When</Box>
                    <Box component="th">Area</Box>
                    <Box component="th">Action</Box>
                    <Box component="th">By</Box>
                    <Box component="th">Note</Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {rows.map((row, i) => (
                    <Box component="tr" key={i}>
                      <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {formatDate(row.created_at)}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Chip
                          label={row.target}
                          size="small"
                          sx={{
                            fontSize: "0.68rem",
                            height: 22,
                            bgcolor:
                              row.kind === "auth" ? "rgba(84,113,138,0.14)" : "rgba(217,168,75,0.14)",
                            color: row.kind === "auth" ? "#33475C" : "#7A5B17",
                          }}
                        />
                      </Box>
                      <Box component="td">
                        <Typography sx={{ fontWeight: 600, fontSize: "0.84rem" }}>
                          {row.action}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {row.actor}
                        </Typography>
                      </Box>
                      <Box component="td" sx={{ maxWidth: 280 }}>
                        <Typography
                          variant="body2"
                          sx={{ color: row.note ? "text.secondary" : "text.disabled", fontSize: "0.78rem" }}
                        >
                          {row.note ?? ""}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Stack>
  );
}
