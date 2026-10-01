"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import JobPostForm, { EMPTY_JOB_FORM, type JobFormValues } from "@/components/jobs/JobPostForm";
import { useCurrentMember } from "@/lib/hooks/useCurrentMember";

const INK = "#0A1A2F";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";

/**
 * /dashboard/jobs/new — post a vacancy.
 *
 * The page leads with what the member is actually buying: the post goes
 * to the ASN network and the jobs email, not just onto a
 * page. That is the product; the board is where the job lives.
 */
export default function NewJobPage() {
  const router = useRouter();
  const { member, loading } = useCurrentMember();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the member's own practice — editable, because the
  // person hiring may be posting for a second location.
  //
  // Derived rather than pushed into state by an effect: the form owns
  // its own values once mounted, so all this has to do is supply the
  // starting point. Setting state from an effect here would fight the
  // member's typing on every re-render.
  const initial = useMemo<JobFormValues>(
    () =>
      member
        ? {
            ...EMPTY_JOB_FORM,
            practice_name: member.practice_name ?? "",
            location: member.city ?? "",
            apply_email: member.email ?? "",
          }
        : EMPTY_JOB_FORM,
    [member],
  );

  const save = async (v: JobFormValues, draft: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/member/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, draft }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "That didn't save. Please try again.");
        return;
      }
      router.push(`/dashboard/jobs?posted=${draft ? "draft" : "review"}`);
    } catch {
      setError("That didn't save. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

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

      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: GOLD,
            textTransform: "uppercase",
          }}
        >
          Post a job
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
          Put your vacancy in front of the aesthetics world
        </Typography>
        <Typography sx={{ color: INK_MUTED, maxWidth: 620, lineHeight: 1.7 }}>
          Once it&apos;s approved your post gets its own public page, written so Google can list it as
          a job. Included in your membership.
        </Typography>
      </Stack>

      {/* Held back until the member fetch settles, so the form mounts
          once with its prefill already in place instead of remounting
          under someone who has started typing. */}
      {loading ? null : (
      <JobPostForm
        initial={initial}
        submitLabel="Submit for review"
        onSubmit={(v) => save(v, false)}
        onSaveDraft={(v) => save(v, true)}
        busy={busy}
        error={error}
      />
      )}
    </Box>
  );
}
