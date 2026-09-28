"use client";

import { useEffect, useState } from "react";
import { Box, Chip, CircularProgress, Collapse, Stack, Typography } from "@mui/material";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

type Member = {
  member_id: string;
  name: string;
  email: string | null;
  status: string | null;
  joined_at: string;
  converted: boolean;
  revenue_cents: number;
  currency: string | null;
};
type Row = {
  id: string;
  code: string;
  slug: string | null;
  active: boolean;
  created_at: string;
  owner: { kind: "expert" | "vendor"; id: string; name: string };
  signups: number;
  conversions: number;
  revenue_cents: number;
  currency: string | null;
  members: Member[];
};
type Totals = { signups: number; conversions: number; revenue_cents: number };

const INK = "#0A1320";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const LINE = "#E0DACE";
const GOLD = "#A07823";

function money(cents: number, currency: string | null): string {
  const cur = (currency || "usd").toUpperCase();
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format((cents || 0) / 100);
}
function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default function AdminReferralsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals>({ signups: 0, conversions: 0, revenue_cents: 0 });
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/referrals", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { codes: [], totals: { signups: 0, conversions: 0, revenue_cents: 0 } }))
      .then((body: { codes?: Row[]; totals?: Totals }) => {
        if (!active) return;
        setRows(body.codes ?? []);
        if (body.totals) setTotals(body.totals);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <Stack spacing={3.5} sx={{ maxWidth: 1100, mx: "auto" }}>
      <Box>
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", color: GOLD, textTransform: "uppercase", mb: 1 }}>
          Referrals
        </Typography>
        <Typography
          component="h1"
          sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.9rem", md: "2.4rem" }, fontWeight: 500, color: INK, lineHeight: 1.1, letterSpacing: "-0.02em", mb: 1 }}
        >
          Who&apos;s bringing members in
        </Typography>
        <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, lineHeight: 1.55, maxWidth: 680 }}>
          Every expert and company has a shareable link. This shows who they brought in, how many converted to paid, and how much those members have paid ASN. Click a row to see the exact members. Revenue is admin-only; experts and companies see counts, not dollars. The referral bonus is $50 per referred member, paid after their first payment.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
        <Tile label="Total signups" value={totals.signups.toLocaleString()} />
        <Tile label="Converted" value={totals.conversions.toLocaleString()} />
        <Tile label="Revenue attributed" value={money(totals.revenue_cents, "usd")} accent />
        <Tile label="Active links" value={String(rows.filter((r) => r.active).length)} />
      </Box>

      <Box sx={{ borderRadius: 3, border: `1px solid ${LINE}`, bgcolor: "#FFFFFF", overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${LINE}` }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>By expert / company</Typography>
        </Box>
        {loading ? (
          <Stack sx={{ alignItems: "center", py: 5 }}>
            <CircularProgress size={20} sx={{ color: GOLD }} />
          </Stack>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.92rem", color: INK_MUTED }}>
              No referral links yet. They&apos;re generated on first portal login.
            </Typography>
          </Box>
        ) : (
          <Stack divider={<Box sx={{ borderTop: "1px solid #F1EBDF" }} />}>
            {rows.map((r) => {
              const open = openId === r.id;
              return (
                <Box key={r.id}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    onClick={() => setOpenId(open ? null : r.id)}
                    sx={{ px: 2.5, py: 2, alignItems: { md: "center" }, justifyContent: "space-between", cursor: "pointer", "&:hover": { bgcolor: "#FCFBF7" } }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.85} sx={{ alignItems: "center", mb: 0.3 }}>
                        <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: INK_MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
                        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{r.owner.name}</Typography>
                        <Chip
                          label={r.owner.kind === "expert" ? "Expert" : "Company"}
                          size="small"
                          sx={{ bgcolor: r.owner.kind === "expert" ? "rgba(34,108,78,0.12)" : "rgba(110,51,70,0.12)", color: r.owner.kind === "expert" ? "#1F5C40" : "#6E3346", height: 18, fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}
                        />
                      </Stack>
                      <Typography sx={{ fontFamily: "var(--font-mono, ui-monospace, Menlo, monospace)", fontSize: "0.82rem", fontWeight: 600, color: GOLD, ml: 3.4 }}>
                        {r.slug ? `aestheticsuccessnetwork.com/${r.slug}` : r.code}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={2.5} sx={{ alignItems: "center" }}>
                      <Stat label="Signups" value={String(r.signups)} />
                      <Stat label="Converted" value={String(r.conversions)} />
                      <Stat label="Paid" value={money(r.revenue_cents, r.currency)} accent />
                      {r.active && <VerifiedRoundedIcon sx={{ fontSize: 18, color: "#1F5C40" }} />}
                    </Stack>
                  </Stack>

                  <Collapse in={open} unmountOnExit>
                    <Box sx={{ px: 2.5, pb: 2, ml: { md: 3.4 } }}>
                      {r.members.length === 0 ? (
                        <Typography sx={{ fontSize: "0.82rem", color: INK_MUTED, py: 1 }}>No members yet.</Typography>
                      ) : (
                        <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 2, overflow: "hidden" }}>
                          <Stack direction="row" sx={{ px: 1.75, py: 0.85, bgcolor: "#FBF8F1", borderBottom: `1px solid ${LINE}` }}>
                            <HCell flex={2}>Member</HCell>
                            <HCell flex={1}>Joined</HCell>
                            <HCell flex={1}>Status</HCell>
                            <HCell flex={1} right>Paid</HCell>
                          </Stack>
                          <Stack divider={<Box sx={{ borderTop: "1px solid #F1ECE1" }} />}>
                            {r.members.map((m) => (
                              <Stack key={m.member_id} direction="row" sx={{ px: 1.75, py: 1, alignItems: "center" }}>
                                <Box sx={{ flex: 2, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</Typography>
                                  {m.email && <Typography sx={{ fontSize: "0.72rem", color: INK_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</Typography>}
                                </Box>
                                <Box sx={{ flex: 1 }}><Typography sx={{ fontSize: "0.8rem", color: INK_SOFT }}>{shortDate(m.joined_at)}</Typography></Box>
                                <Box sx={{ flex: 1 }}>
                                  <Chip
                                    label={m.converted ? "Paid" : (m.status ?? "signed up")}
                                    size="small"
                                    sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, bgcolor: m.converted ? "rgba(34,108,78,0.12)" : "rgba(122,133,144,0.14)", color: m.converted ? "#1F5C40" : INK_MUTED }}
                                  />
                                </Box>
                                <Box sx={{ flex: 1, textAlign: "right" }}>
                                  <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: m.revenue_cents > 0 ? INK : INK_MUTED }}>
                                    {money(m.revenue_cents, m.currency)}
                                  </Typography>
                                </Box>
                              </Stack>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box sx={{ borderRadius: 2, border: `1px solid ${accent ? GOLD : LINE}`, bgcolor: accent ? "#FBF8F1" : "#FFFFFF", p: 2 }}>
      <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.16em", color: INK_MUTED, textTransform: "uppercase", mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.7rem", fontWeight: 600, color: accent ? GOLD : INK, lineHeight: 1 }}>{value}</Typography>
    </Box>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Box sx={{ textAlign: "center", minWidth: 60 }}>
      <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: INK_MUTED, textTransform: "uppercase" }}>{label}</Typography>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: accent ? GOLD : INK, lineHeight: 1.1, mt: 0.25 }}>{value}</Typography>
    </Box>
  );
}

function HCell({ children, flex, right }: { children: React.ReactNode; flex: number; right?: boolean }) {
  return (
    <Box sx={{ flex, textAlign: right ? "right" : "left" }}>
      <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", color: INK_MUTED, textTransform: "uppercase" }}>{children}</Typography>
    </Box>
  );
}
