"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import JobPostForm, {
  jobRowToFormValues,
  type JobFormValues,
} from "@/components/jobs/JobPostForm";
import { roleLabel } from "@/lib/jobs/constants";
import type { JobStatus } from "@/lib/supabase/types";

const INK = "#0A1A2F";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";

type EditableJob = {
  id: string;
  slug: string;
  status: JobStatus;
  role: string;
  role_other: string | null;
  rejection_reason: string | null;
  practice_name: string;
  employment_type: string;
  location: string;
  workplace: string;
  // Nullable as of 0061 — banner posts only, see JobPostsRow.
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: string;
  description: string | null;
  requirements: string | null;
  apply_email: string | null;
  apply_url: string | null;
  start_date: string | null;
  start_flexible: boolean;
};

/**
 * /dashboard/jobs/[id]/edit — the member changes their own post.
 *
 * Without this page a draft was a dead end (savable, never re-openable)
 * and a rejected post could never be corrected — the rejection email
 * told a member what to fix with nowhere to fix it. Both are now the
 * same screen.
 *
 * The one rule this page has to make visible: editing something the
 * public can already see sends it BACK to review, because an approved
 * post that can be silently rewritten defeats the publish gate. The URL
 * does NOT change, because we promoted that link to the Facebook group
 * and Google has it indexed. The API enforces both; the banner here is
 * so the member isn't surprised by it.
 */
export default function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [job, setJob] = useState<EditableJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch-on-mount with a cancellation guard: the member can hit Back
  // while this is in flight, and a late setState on an unmounted form is
  // a warning nobody will ever chase down.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/member/jobs/${id}`, { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(
            res.status === 404
              ? "We couldn't find that post."
              : "We couldn't load that post. Please try again.",
          );
          return;
        }
        const body = (await res.json()) as { job?: EditableJob };
        if (!cancelled && body.job) setJob(body.job);
      } catch {
        if (!cancelled) setLoadError("We couldn't load that post. Please check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = async (v: JobFormValues) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/member/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", ...v }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
      if (!res.ok) {
        setError(body.error ?? "That didn't save. Please try again.");
        return;
      }
      // "review" only when the API actually moved it there, so a draft
      // edit doesn't claim it was sent to the queue.
      router.push(
        `/dashboard/jobs?edited=${body.status === "pending_review" ? "review" : "saved"}`,
      );
    } catch {
      setError("That didn't save. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 10 }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }

  if (loadError || !job) {
    return (
      <Box sx={{ maxWidth: 780, mx: "auto", py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError ?? "We couldn't find that post."}
        </Alert>
        <Button component={Link} href="/dashboard/jobs" startIcon={<ArrowBackRoundedIcon />}>
          My job posts
        </Button>
      </Box>
    );
  }

  // Expired posts are blocked by the API too — renewing first is what
  // gives the post a live window to be edited into.
  const isExpired = job.status === "expired";
  const wasPublic = job.status === "live" || job.status === "filled";

  return (
    <Box sx={{ maxWidth: 780, mx: "auto", py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Button
        component={Link}
        href="/dashboard/jobs"
        startIcon={<ArrowBackRoundedIcon />}
        sx={{ color: INK_MUTED, mb: 2 }}
      >
        My job posts
      </Button>

      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: GOLD,
            textTransform: "uppercase",
          }}
        >
          Edit post
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "1.9rem", md: "2.4rem" },
            fontWeight: 500,
            color: INK,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {roleLabel(job.role, job.role_other)}
        </Typography>
      </Stack>

      {isExpired ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          This post has expired. Relist it for 30 days from{" "}
          <Link href="/dashboard/jobs" style={{ color: "inherit" }}>
            My job posts
          </Link>{" "}
          and then edit it.
        </Alert>
      ) : null}

      {job.status === "rejected" && job.rejection_reason ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>Why it came back:</strong> {job.rejection_reason}
          <br />
          Make the change here, then send it for review again from your posts list.
        </Alert>
      ) : null}

      {wasPublic ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          This post is public. Saving a change sends it back for review, so it comes off the board
          until we approve it again, usually the same day. Its web address stays the same, so any
          link already shared keeps working.
        </Alert>
      ) : null}

      {!isExpired ? (
        <JobPostForm
          initial={jobRowToFormValues(job)}
          submitLabel={wasPublic ? "Save and send for review" : "Save changes"}
          onSubmit={save}
          busy={busy}
          error={error}
        />
      ) : null}
    </Box>
  );
}
