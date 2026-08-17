import Link from "next/link";
import { Box, Chip, Grid, Stack, Typography } from "@mui/material";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { countRows } from "@/lib/supabase/counts";
import { errMessage } from "@/lib/errMessage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Overview = {
  waitlistTotal: number;
  waitlist24h: number;
  expertsTotal: number;
  expertsPending: number;
  partnersTotal: number;
  partnersPending: number;
  recent: {
    kind: "waitlist" | "expert" | "partner";
    name: string;
    email: string;
    detail: string | null;
    created_at: string;
  }[];
  error: string | null;
};

async function loadOverview(): Promise<Overview> {
  try {
    const supabase = getSupabaseAdmin();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const PENDING = ["new", "in_review"];
    // The four headline figures are header-only COUNTs (no rows on the
    // wire); only the "Latest activity" feed actually fetches rows, and
    // it's capped at 5 per source.
    const [
      waitlistTotal,
      waitlist24h,
      expertsTotal,
      expertsPending,
      partnersTotal,
      partnersPending,
      wlRecent,
      xpRecent,
      ptRecent,
    ] = await Promise.all([
      countRows(supabase, "waitlist_signups"),
      countRows(supabase, "waitlist_signups", { gte: { created_at: dayAgo } }),
      countRows(supabase, "expert_applications"),
      countRows(supabase, "expert_applications", { in: { status: PENDING } }),
      countRows(supabase, "partner_applications"),
      countRows(supabase, "partner_applications", { in: { status: PENDING } }),
      supabase
        .from("waitlist_signups")
        .select("first_name, last_name, email, practice_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("expert_applications")
        .select("full_name, email, topics, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("partner_applications")
        .select("company_name, contact_name, contact_email, category, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const recent: Overview["recent"] = [
      ...(wlRecent.data ?? []).map((r) => ({
        kind: "waitlist" as const,
        name: `${r.first_name} ${r.last_name}`,
        email: r.email as string,
        detail: (r.practice_name as string | null) ?? null,
        created_at: r.created_at as string,
      })),
      ...(xpRecent.data ?? []).map((r) => ({
        kind: "expert" as const,
        name: r.full_name as string,
        email: r.email as string,
        detail: (r.topics as string | null) ?? null,
        created_at: r.created_at as string,
      })),
      ...(ptRecent.data ?? []).map((r) => ({
        kind: "partner" as const,
        name: `${r.company_name} (${r.contact_name})`,
        email: r.contact_email as string,
        detail: (r.category as string | null) ?? null,
        created_at: r.created_at as string,
      })),
    ]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 8);

    return {
      waitlistTotal,
      waitlist24h,
      expertsTotal,
      expertsPending,
      partnersTotal,
      partnersPending,
      recent,
      error: null,
    };
  } catch (err) {
    return {
      waitlistTotal: 0,
      waitlist24h: 0,
      expertsTotal: 0,
      expertsPending: 0,
      partnersTotal: 0,
      partnersPending: 0,
      recent: [],
      error: errMessage(err),
    };
  }
}

const KIND_LABEL = { waitlist: "Waitlist", expert: "Expert", partner: "Partner" } as const;
const KIND_COLOR = {
  waitlist: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
  expert: { bg: "rgba(84,113,138,0.14)", fg: "#33475C" },
  partner: { bg: "rgba(46,138,87,0.12)", fg: "#1F5C39" },
} as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminDashboardPage() {
  const o = await loadOverview();

  const cards = [
    { label: "Waitlist signups", value: o.waitlistTotal, href: "/admin/waitlist", accent: false },
    { label: "Last 24 hours", value: o.waitlist24h, href: "/admin/waitlist", accent: true },
    {
      label: "Expert applications",
      value: o.expertsTotal,
      sub: `${o.expertsPending} to review`,
      href: "/admin/experts",
      accent: false,
    },
    {
      label: "Partner applications",
      value: o.partnersTotal,
      sub: `${o.partnersPending} to review`,
      href: "/admin/partners",
      accent: false,
    },
  ];

  return (
    <Stack spacing={3.5}>
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          LAUNCH PHASE
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Dashboard
        </Typography>
        {o.error && (
          <Box
            sx={{
              mt: 2,
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
              Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              in <code>.env.local</code>, run the migrations in <code>supabase/migrations/</code>,
              then restart. See <code>supabase/README.md</code>.
            </Typography>
            <Typography variant="body2" sx={{ color: "text.disabled", mt: 1.5, fontSize: "0.78rem" }}>
              Detail: {o.error}
            </Typography>
          </Box>
        )}
      </Box>

      <Grid container spacing={2}>
        {cards.map((card) => (
          <Grid key={card.label} size={{ xs: 6, md: 3 }}>
            <Box
              component={Link}
              href={card.href}
              sx={{
                display: "block",
                textDecoration: "none",
                p: 2.25,
                borderRadius: "16px",
                border: "1px solid",
                borderColor: card.accent ? "rgba(217,168,75,0.4)" : "divider",
                bgcolor: card.accent ? "rgba(217,168,75,0.05)" : "common.white",
                transition: "border-color .2s ease",
                "&:hover": { borderColor: "rgba(217,168,75,0.6)" },
              }}
            >
              <Typography variant="overline" sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                {card.label}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.8rem", md: "2.1rem" },
                  lineHeight: 1,
                  color: "text.primary",
                  mt: 0.75,
                }}
              >
                {card.value.toLocaleString("en-US")}
              </Typography>
              {card.sub && (
                <Typography variant="body2" sx={{ mt: 0.5, fontSize: "0.74rem", color: "#A87D2C" }}>
                  {card.sub}
                </Typography>
              )}
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box
        sx={{
          borderRadius: "20px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography sx={{ fontWeight: 600 }}>Latest activity</Typography>
        </Box>
        {o.recent.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Signups and applications will appear here as they come in.
            </Typography>
          </Box>
        ) : (
          <Box>
            {o.recent.map((r, i) => (
              <Stack
                key={`${r.email}-${i}`}
                direction="row"
                spacing={2}
                sx={{
                  px: 3,
                  py: 1.75,
                  alignItems: "center",
                  borderBottom: i < o.recent.length - 1 ? "1px solid" : "none",
                  borderColor: "divider",
                }}
              >
                <Chip
                  label={KIND_LABEL[r.kind]}
                  size="small"
                  sx={{
                    fontSize: "0.68rem",
                    height: 22,
                    bgcolor: KIND_COLOR[r.kind].bg,
                    color: KIND_COLOR[r.kind].fg,
                    minWidth: 74,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.88rem" }} noWrap>
                    {r.name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.76rem", color: "text.secondary" }} noWrap>
                    {r.email}
                    {r.detail ? ` · ${r.detail}` : ""}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontSize: "0.76rem", color: "text.secondary" }}>
                  {formatDate(r.created_at)}
                </Typography>
              </Stack>
            ))}
          </Box>
        )}
      </Box>
    </Stack>
  );
}
