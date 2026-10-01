"use client";

import NextLink from "next/link";
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import SeekerShell from "@/components/jobs/SeekerShell";
import { applicationStatusApplicantLabel, applicationStatusTone, roleLabel } from "@/lib/jobs/constants";
import { jobOf, useSeekerApplications } from "@/lib/jobs/seekerApplications";

/**
 * /seeker/applications — every application, with the honest status.
 *
 * This page is the return half of the bargain. We asked people to
 * register instead of firing off an anonymous email, and the reason we
 * gave them was that they could see where their applications got to.
 * A practice that hasn't touched an application shows as "Submitted",
 * not as anything implying progress that hasn't happened.
 */

const INK = "#0A1A2F";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

const TONE_COLOR: Record<string, string> = { neutral: INK_MUTED, positive: "#1B6B4A", closed: "#8A3A3A" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SeekerApplicationsPage() {
  const { rows, seeker, err } = useSeekerApplications("/seeker/applications");

  return (
    <SeekerShell email={seeker?.email}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" }, mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", color: INK_MUTED, textTransform: "uppercase", mb: 0.75 }}>
            Applications
          </Typography>
          <Typography component="h1" sx={{ fontSize: { xs: "1.7rem", md: "2.1rem" }, fontWeight: 700, color: INK, lineHeight: 1.15 }}>
            My applications
          </Typography>
          <Typography sx={{ color: INK_MUTED, mt: 0.75 }}>Statuses update here as practices review them. No need to refresh.</Typography>
        </Box>
        {rows && rows.length > 0 ? (
          <Typography sx={{ fontSize: "0.85rem", color: INK_MUTED }}>{rows.length} {rows.length === 1 ? "application" : "applications"}</Typography>
        ) : null}
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

      {rows !== null && rows.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center", border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#fff" }}>
          <Typography sx={{ color: INK, fontWeight: 600, mb: 1 }}>You haven&apos;t applied for anything yet</Typography>
          <Typography sx={{ color: INK_MUTED, mb: 3 }}>Everything you apply for shows up here.</Typography>
          <Button component={NextLink} href="/jobs" variant="contained" sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, px: 4 }}>
            Browse jobs
          </Button>
        </Box>
      ) : null}

      {rows && rows.length > 0 ? (
        <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#fff", overflow: "hidden" }}>
          <Box
            sx={{
              display: { xs: "none", md: "grid" },
              gridTemplateColumns: "2fr 1fr 1.3fr 1fr",
              gap: 2,
              px: 2.5,
              py: 1.25,
              bgcolor: "#FAF7F1",
              borderBottom: `1px solid ${LINE}`,
            }}
          >
            {["Job", "Applied", "Status", "Updated"].map((h) => (
              <Typography key={h} sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_MUTED }}>
                {h}
              </Typography>
            ))}
          </Box>
          {rows.map((row, i) => {
            const job = jobOf(row);
            const tone = applicationStatusTone(row.status);
            return (
              <Box
                key={row.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1.3fr 1fr" },
                  gap: { xs: 0.75, md: 2 },
                  px: 2.5,
                  py: 1.75,
                  alignItems: "center",
                  borderBottom: i === rows.length - 1 ? 0 : `1px solid ${LINE}`,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, color: INK, fontSize: "0.98rem" }} noWrap>
                    {job ? (
                      <NextLink href={`/jobs/${job.slug}`} style={{ color: INK, textDecoration: "none" }}>
                        {roleLabel(job.role, job.role_other)}
                      </NextLink>
                    ) : (
                      "This job has been removed"
                    )}
                  </Typography>
                  {job ? (
                    <Typography sx={{ color: INK_MUTED, fontSize: "0.82rem" }} noWrap>
                      {job.practice_name} · {job.location}
                    </Typography>
                  ) : null}
                  {row.cv_filename ? (
                    <Typography sx={{ color: INK_MUTED, fontSize: "0.78rem" }} noWrap>
                      CV: {row.cv_filename}
                    </Typography>
                  ) : null}
                  {!row.delivered_at ? (
                    <Typography sx={{ color: "#8A3A3A", fontSize: "0.8rem", mt: 0.25 }}>We&apos;re still delivering this one to the practice.</Typography>
                  ) : null}
                  {job?.status === "filled" ? (
                    <Typography sx={{ color: INK_MUTED, fontSize: "0.8rem", mt: 0.25 }}>This role has since been filled.</Typography>
                  ) : null}
                </Box>
                <Typography sx={{ fontSize: "0.85rem", color: INK_MUTED }}>
                  <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>Applied </Box>
                  {formatDate(row.created_at)}
                </Typography>
                <Box>
                  <Chip
                    size="small"
                    label={applicationStatusApplicantLabel(row.status)}
                    sx={{ bgcolor: "transparent", border: `1px solid ${LINE}`, color: TONE_COLOR[tone] ?? INK_MUTED, fontWeight: 600 }}
                  />
                </Box>
                <Typography sx={{ fontSize: "0.82rem", color: INK_MUTED, display: { xs: "none", md: "block" } }}>
                  {row.status_changed_at ? formatDate(row.status_changed_at) : ""}
                </Typography>
              </Box>
            );
          })}
        </Box>
      ) : null}
    </SeekerShell>
  );
}
