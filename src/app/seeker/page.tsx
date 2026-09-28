"use client";

import NextLink from "next/link";
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import SeekerShell from "@/components/jobs/SeekerShell";
import { applicationStatusApplicantLabel, applicationStatusTone, roleLabel } from "@/lib/jobs/constants";
import { jobOf, useSeekerApplications } from "@/lib/jobs/seekerApplications";

/**
 * /seeker — the job seeker's overview.
 *
 * What a candidate wants to know in one glance: how many applications
 * are out, which ones moved, and where to find more jobs. Separate from
 * the member portal on purpose — see SeekerShell.
 */

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

const TONE_COLOR: Record<string, string> = { neutral: INK_MUTED, positive: "#1B6B4A", closed: "#8A3A3A" };

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SeekerHomePage() {
  const { rows, seeker, err } = useSeekerApplications("/seeker");

  const total = rows?.length ?? 0;
  const waiting = rows?.filter((r) => r.status === "submitted" || r.status === "viewed").length ?? 0;
  const shortlisted = rows?.filter((r) => r.status === "shortlisted").length ?? 0;
  const hired = rows?.filter((r) => r.status === "hired").length ?? 0;
  const closed = rows?.filter((r) => r.status === "not_selected").length ?? 0;
  const recent = rows?.slice(0, 5) ?? [];

  return (
    <SeekerShell email={seeker?.email}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { md: "flex-end" }, mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", color: INK_MUTED, textTransform: "uppercase", mb: 0.75 }}>
            Overview
          </Typography>
          <Typography component="h1" sx={{ fontSize: { xs: "1.7rem", md: "2.1rem" }, fontWeight: 700, color: INK, lineHeight: 1.15 }}>
            {seeker?.first_name ? `Hi ${seeker.first_name}` : "Your applications"}
          </Typography>
          <Typography sx={{ color: INK_MUTED, mt: 0.75, maxWidth: 560 }}>
            Practices reply to you directly by email. When a practice reviews or shortlists you, the status updates here on its own.
          </Typography>
        </Box>
        <Button component={NextLink} href="/jobs" variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, alignSelf: { xs: "stretch", md: "auto" } }}>
          Browse jobs
        </Button>
      </Stack>

      {err ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {err}
        </Alert>
      ) : null}

      {rows === null && !err ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 4 }}>
          <CircularProgress size={18} sx={{ color: GOLD }} />
          <Typography sx={{ color: INK_MUTED }}>Loading…</Typography>
        </Stack>
      ) : null}

      {rows !== null ? (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.5, mb: 3.5 }}>
            <Stat label="Applications sent" value={total} />
            <Stat label="Awaiting a reply" value={waiting} />
            <Stat label="Shortlisted" value={shortlisted} tone="positive" />
            <Stat label={hired > 0 ? "Hired" : "Not selected"} value={hired > 0 ? hired : closed} tone={hired > 0 ? "positive" : "muted"} />
          </Box>

          <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#fff", overflow: "hidden" }}>
            <Stack direction="row" sx={{ px: 2.5, py: 1.5, alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${LINE}` }}>
              <Typography sx={{ fontWeight: 700, color: INK }}>Recent applications</Typography>
              {total > 0 ? (
                <Button component={NextLink} href="/seeker/applications" size="small" sx={{ color: GOLD, textTransform: "none", fontWeight: 600 }}>
                  See all {total}
                </Button>
              ) : null}
            </Stack>

            {recent.length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <Typography sx={{ color: INK, fontWeight: 600, mb: 0.5 }}>You haven&apos;t applied for anything yet</Typography>
                <Typography sx={{ color: INK_MUTED, fontSize: "0.9rem" }}>Everything you apply for shows up here with its status.</Typography>
              </Box>
            ) : (
              recent.map((row, i) => {
                const job = jobOf(row);
                const tone = applicationStatusTone(row.status);
                return (
                  <Stack
                    key={row.id}
                    direction="row"
                    spacing={2}
                    sx={{ px: 2.5, py: 1.5, alignItems: "center", justifyContent: "space-between", borderBottom: i === recent.length - 1 ? 0 : `1px solid ${LINE}` }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, color: INK, fontSize: "0.95rem" }} noWrap>
                        {job ? roleLabel(job.role, job.role_other) : "This job has been removed"}
                      </Typography>
                      <Typography sx={{ color: INK_MUTED, fontSize: "0.8rem" }} noWrap>
                        {job ? `${job.practice_name} · ${job.location} · ` : ""}applied {shortDate(row.created_at)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={applicationStatusApplicantLabel(row.status)}
                      sx={{ bgcolor: "transparent", border: `1px solid ${LINE}`, color: TONE_COLOR[tone] ?? INK_MUTED, fontWeight: 600, flexShrink: 0 }}
                    />
                  </Stack>
                );
              })
            )}
          </Box>

          <Typography sx={{ fontSize: "0.82rem", color: INK_SOFT, mt: 3 }}>
            A practice sees your name, email, phone, message and CV. We never share anything else, and a status of &ldquo;Submitted&rdquo; simply means
            the practice hasn&apos;t updated it yet.
          </Typography>
        </>
      ) : null}
    </SeekerShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "positive" | "muted" }) {
  const color = tone === "positive" ? "#1B6B4A" : tone === "muted" ? INK_MUTED : INK;
  return (
    <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#fff", px: 2, py: 1.75 }}>
      <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, color, lineHeight: 1.1 }}>{value}</Typography>
      <Typography sx={{ fontSize: "0.75rem", color: INK_MUTED, mt: 0.5 }}>{label}</Typography>
    </Box>
  );
}
