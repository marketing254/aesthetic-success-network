"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FacebookOutlinedIcon from "@mui/icons-material/FacebookOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import JobPostForm, {
  jobRowToFormValues,
  type JobFormValues,
} from "@/components/jobs/JobPostForm";
import { applicationStatusLabel, applicationStatusTone, employmentLabel, roleLabel, workplaceLabel } from "@/lib/jobs/constants";
import { bannerPublicUrl, daysUntil, formatPay, postedAgo } from "@/lib/jobs/format";
import { useLiveRefresh } from "@/lib/jobs/useLiveRefresh";
import type { JobPayUnitValue, JobStatus } from "@/lib/supabase/types";

type AdminJob = {
  id: string;
  slug: string;
  practice_name: string;
  role: string;
  role_other: string | null;
  employment_type: string;
  location: string;
  workplace: string;
  // Nullable as of 0061 — banner posts only, see JobPostsRow.
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: JobPayUnitValue;
  description: string | null;
  requirements: string | null;
  post_format?: "detailed" | "banner" | null;
  banner_path?: string | null;
  banner_alt?: string | null;
  apply_email: string | null;
  apply_url: string | null;
  start_date: string | null;
  start_flexible: boolean;
  status: JobStatus;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  expires_at: string | null;
  view_count: number;
  application_count?: number | null;
  renewal_count: number;
  promoted_facebook_at: string | null;
  promoted_email_at: string | null;
  created_at: string;
  poster: { name: string; email: string; practice: string | null } | null;
};

type AdminApplication = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  cv_filename: string | null;
  cv_url: string | null;
  status: string;
  status_changed_at: string | null;
  delivered_at: string | null;
  delivery_error: string | null;
  copy_to_applicant: boolean;
  created_at: string;
  job: {
    id: string;
    slug: string;
    practice_name: string;
    role: string;
    role_other: string | null;
    location: string;
    status: string;
    apply_email: string | null;
    poster: { name: string; email: string } | null;
  } | null;
};

type AppStats = { total: number; undelivered: number; shortlisted: number; hired: number };

type Stats = {
  pending: number;
  live: number;
  filled: number;
  expired: number;
  liveThisMonth: number;
  totalViews: number;
  awaitingPromotion: number;
};

type FilterKey = "queue" | "pending_review" | "live" | "filled" | "expired" | "rejected" | "applications";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "queue", label: "Queue" },
  { key: "pending_review", label: "Pending" },
  { key: "live", label: "Live" },
  { key: "filled", label: "Filled" },
  { key: "expired", label: "Expired" },
  { key: "rejected", label: "Rejected" },
  { key: "applications", label: "Applications" },
];

/**
 * /admin/jobs — the publish gate and the promotion queue.
 *
 * The promotion is the product, so the queue is not an afterthought:
 * approving a post is half the job, and ticking it off the Facebook
 * group and the weekly email is the other half. Phase 1 does both
 * channels BY HAND — these buttons record that a person did it. There
 * is no Facebook API integration here and there shouldn't be yet.
 */
export default function AdminJobsPage() {
  const [filter, setFilter] = useState<FilterKey>("queue");
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminJob | null>(null);
  const [reason, setReason] = useState("");
  // "Ability to edit a post before approving (typos, missing pay,
  // formatting)" — straight from the spec's admin list. It reuses the
  // member's own form, so an admin can only save a shape that form
  // would have accepted.
  const [editing, setEditing] = useState<AdminJob | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [apps, setApps] = useState<AdminApplication[]>([]);
  const [appStats, setAppStats] = useState<AppStats | null>(null);
  const [appJobFilter, setAppJobFilter] = useState<string | null>(null);

  // The spinner is switched on by the tab handler rather than at the top
  // of `load`, so switching tabs doesn't push a synchronous state update
  // through the effect below. Same fetch-on-mount shape as every other
  // admin queue page (offers, members, experts).
  const load = useCallback(async () => {
    try {
      if (filter === "applications") {
        const qs = appJobFilter ? `?job=${appJobFilter}` : "";
        const res = await fetch(`/api/admin/jobs/applications${qs}`, { cache: "no-store" });
        const body = (await res.json()) as { applications?: AdminApplication[]; stats?: AppStats; error?: string };
        if (!res.ok || body.error) {
          setError(body.error ?? `Failed to load (${res.status})`);
          setApps([]);
          return;
        }
        setApps(body.applications ?? []);
        if (body.stats) setAppStats(body.stats);
        setError(null);
        return;
      }
      const qs = filter === "queue" ? "" : `?status=${filter}`;
      const [res, appRes] = await Promise.all([
        fetch(`/api/admin/jobs${qs}`, { cache: "no-store" }),
        fetch(`/api/admin/jobs/applications`, { cache: "no-store" }),
      ]);
      const body = (await res.json()) as { jobs?: AdminJob[]; stats?: Stats; error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        setJobs([]);
        return;
      }
      setJobs(body.jobs ?? []);
      if (body.stats) setStats(body.stats);
      const appBody = (await appRes.json().catch(() => ({}))) as { stats?: AppStats };
      if (appBody.stats) setAppStats(appBody.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [filter, appJobFilter]);

  useEffect(() => {
    void load();
  }, [load]);
  // A new submission or application shows up here without a reload.
  useLiveRefresh(load);

  const act = async (job: AdminJob, payload: Record<string, unknown>, okMessage: string) => {
    setActing(job.id);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(body.error ?? "That didn't work.");
        return false;
      }
      setToast(okMessage);
      await load();
      return true;
    } finally {
      setActing(null);
    }
  };

  const pending = useMemo(() => jobs.filter((j) => j.status === "pending_review"), [jobs]);
  const rest = useMemo(() => jobs.filter((j) => j.status !== "pending_review"), [jobs]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
        Job board
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 3, maxWidth: 640 }}>
        Nothing goes public without an approval here. Once a post is live, share it with the ASN
        network and the weekly jobs email, then tick both off. That promotion is what the
        member is actually paying for.
      </Typography>

      {stats ? (
        <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", rowGap: 2, mb: 3 }}>
          <Stat label="Pending review" value={stats.pending} highlight={stats.pending > 0} />
          <Stat
            label="Awaiting promotion"
            value={stats.awaitingPromotion}
            highlight={stats.awaitingPromotion > 0}
          />
          <Stat label="Live" value={stats.live} />
          <Stat label="Live this month" value={stats.liveThisMonth} />
          <Stat label="Filled" value={stats.filled} />
          <Stat label="Total views" value={stats.totalViews} />
          {appStats ? <Stat label="Applications" value={appStats.total} highlight={appStats.undelivered > 0} /> : null}
        </Stack>
      ) : null}

      <Tabs
        value={filter}
        onChange={(_, v: FilterKey) => {
          setLoading(true);
          setFilter(v);
        }}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress size={28} />
        </Stack>
      ) : filter === "applications" ? (
        <ApplicationsTable
          rows={apps}
          stats={appStats}
          jobFilter={appJobFilter}
          onClearJobFilter={() => {
            setLoading(true);
            setAppJobFilter(null);
          }}
        />
      ) : jobs.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>
          Nothing here.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {/* Pending always sits at the top of the default view — it's
              the only part of this screen that blocks a member. */}
          {[...pending, ...rest].map((job) => (
            <JobRow
              key={job.id}
              job={job}
              busy={acting === job.id}
              onApprove={() => act(job, { action: "approve" }, "Approved and the poster has been emailed.")}
              onReject={() => {
                setRejecting(job);
                setReason("");
              }}
              onPromote={(channel) =>
                act(job, { action: "promote", channel }, "Promotion updated.")
              }
              onExpire={() =>
                act(
                  job,
                  { action: "expire" },
                  job.status === "pending_review"
                    ? "Removed from the queue. The poster was not emailed."
                    : "Taken off the board.",
                )
              }
              onEdit={() => {
                setEditing(job);
                setEditError(null);
              }}
              onApplicants={() => {
                setLoading(true);
                setAppJobFilter(job.id);
                setFilter("applications");
              }}
            />
          ))}
        </Stack>
      )}

      <EditDialog
        job={editing}
        busy={acting === editing?.id}
        error={editError}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          if (!editing) return;
          setEditError(null);
          // Its own fetch rather than `act`, so a validation message
          // ("Pay range is required…") lands inside the dialog where the
          // field it refers to is, instead of in a toast behind it.
          setActing(editing.id);
          try {
            const res = await fetch(`/api/admin/jobs/${editing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "edit", ...values }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
              setEditError(body.error ?? "That didn't save.");
              return;
            }
            setEditing(null);
            setToast(
              editing.status === "pending_review"
                ? "Saved. Approve it when you're happy with it."
                : "Saved. The post stays live and keeps its web address.",
            );
            await load();
          } finally {
            setActing(null);
          }
        }}
      />

      <RejectDialog
        job={rejecting}
        reason={reason}
        setReason={setReason}
        busy={acting === rejecting?.id}
        onClose={() => setRejecting(null)}
        onConfirm={async () => {
          if (!rejecting) return;
          const ok = await act(
            rejecting,
            { action: "reject", reason },
            "Rejected. The poster has the reason by email.",
          );
          if (ok) setRejecting(null);
        }}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: highlight ? "warning.dark" : "text.primary",
          lineHeight: 1.1,
        }}
      >
        {value.toLocaleString()}
      </Typography>
      <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </Typography>
    </Box>
  );
}

function JobRow({
  job,
  busy,
  onApprove,
  onReject,
  onPromote,
  onExpire,
  onEdit,
  onApplicants,
}: {
  job: AdminJob;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onPromote: (channel: "facebook" | "email") => void;
  onExpire: () => void;
  onEdit: () => void;
  onApplicants: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isPending = job.status === "pending_review";
  const left = job.status === "live" ? daysUntil(job.expires_at) : null;
  const applicants = job.application_count ?? 0;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: isPending ? "warning.light" : "divider",
        bgcolor: isPending ? "#FFFDF6" : "background.paper",
        borderRadius: 2,
        p: 2,
      }}
    >
      <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
            <Typography sx={{ fontWeight: 600 }}>{roleLabel(job.role, job.role_other)}</Typography>
            <StatusChip status={job.status} />
          </Stack>
          <Typography sx={{ color: "text.secondary", fontSize: "0.9rem", mt: 0.25 }}>
            {job.practice_name} · {job.location} · {employmentLabel(job.employment_type)} ·{" "}
            {workplaceLabel(job.workplace)}
          </Typography>
          <Typography sx={{ fontSize: "0.9rem", mt: 0.75, fontWeight: 600 }}>
            {formatPay(job.pay_min, job.pay_max, job.pay_unit)}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.8rem", mt: 0.5 }}>
            {job.poster ? `${job.poster.name} · ${job.poster.email}` : "Poster not found"} ·{" "}
            {postedAgo(job.submitted_at ?? job.created_at)}
          </Typography>
        </Box>

        <Stack spacing={0.5} sx={{ alignItems: "flex-end", flexShrink: 0 }}>
          {job.status === "live" || job.status === "filled" || job.status === "expired" ? (
            <Button
              size="small"
              onClick={onApplicants}
              startIcon={<GroupOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ minWidth: 0, px: 0.75, fontWeight: applicants > 0 ? 700 : 500, color: applicants > 0 ? "warning.dark" : "text.secondary" }}
            >
              {applicants} {applicants === 1 ? "applicant" : "applicants"}
            </Button>
          ) : null}
          {job.status === "live" ? (
            <>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <VisibilityOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography sx={{ fontSize: "0.85rem" }}>{job.view_count}</Typography>
              </Stack>
              {left !== null ? (
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                  {left <= 0 ? "expires today" : `${left}d left`}
                </Typography>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Stack>

      {job.rejection_reason ? (
        <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
          {job.rejection_reason}
        </Alert>
      ) : null}

      <Button size="small" onClick={() => setOpen((v) => !v)} sx={{ mt: 1, pl: 0 }}>
        {open ? "Hide the post" : "Read the post"}
      </Button>

      {open ? (
        <Box sx={{ mt: 1, p: 2, bgcolor: "grey.50", borderRadius: 2 }}>
          {/* On a banner post the image IS the ad. Approving one without
              seeing it would make the review gate meaningless for
              exactly the posts where it matters most, an uploaded
              graphic is the one thing on this board we can't moderate by
              reading. */}
          {job.post_format === "banner" && job.banner_path ? (
            <Box sx={{ mb: 2 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerPublicUrl(job.banner_path) ?? ""}
                alt={job.banner_alt ?? "Job banner awaiting review"}
                style={{
                  width: "100%",
                  maxWidth: 520,
                  height: "auto",
                  display: "block",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.12)",
                }}
              />
              <Typography sx={{ mt: 0.75, fontSize: "0.8rem", color: "text.secondary" }}>
                Alt text: {job.banner_alt || <em>missing</em>}
              </Typography>
            </Box>
          ) : null}
          <Typography sx={{ whiteSpace: "pre-line", fontSize: "0.9rem", lineHeight: 1.7 }}>
            {job.description || <em>No description (banner post, left blank)</em>}
          </Typography>
          {job.requirements ? (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary", mb: 0.5 }}>
                What they&apos;re looking for
              </Typography>
              <Typography sx={{ whiteSpace: "pre-line", fontSize: "0.9rem", lineHeight: 1.7 }}>
                {job.requirements}
              </Typography>
            </>
          ) : null}
          <Divider sx={{ my: 1.5 }} />
          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
            Apply to: {job.apply_email ?? ""} {job.apply_url ? `· ${job.apply_url}` : ""}
            <br />
            Start: {job.start_flexible ? "Flexible" : (job.start_date ?? "Not specified")}
          </Typography>
        </Box>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 1 }}>
        {isPending ? (
          <>
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckRoundedIcon />}
              disabled={busy}
              onClick={onApprove}
            >
              Approve and publish
            </Button>
            {/* Fix the typo or the missing pay yourself rather than
                bouncing the post back over it, a rejection costs the
                member a day and costs us a listing. */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditOutlinedIcon />}
              disabled={busy}
              onClick={onEdit}
            >
              Edit before approving
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={<CloseRoundedIcon />}
              disabled={busy}
              onClick={onReject}
            >
              Reject
            </Button>
            {/* Silent removal, for spam that deserves no reply. Reject
                is the default because we never reject silently. */}
            <Button size="small" color="error" disabled={busy} onClick={onExpire}>
              Remove without emailing
            </Button>
          </>
        ) : null}

        {job.status === "live" ? (
          <>
            <Button
              size="small"
              startIcon={<EditOutlinedIcon />}
              disabled={busy}
              onClick={onEdit}
            >
              Edit
            </Button>
            {/* The promotion queue. Ticking these is the record that a
                human actually posted it to the group / the email. */}
            <Button
              size="small"
              variant={job.promoted_facebook_at ? "contained" : "outlined"}
              startIcon={<FacebookOutlinedIcon />}
              disabled={busy}
              onClick={() => onPromote("facebook")}
            >
              {job.promoted_facebook_at ? "Posted to group" : "Mark posted to group"}
            </Button>
            <Button
              size="small"
              variant={job.promoted_email_at ? "contained" : "outlined"}
              startIcon={<MailOutlineRoundedIcon />}
              disabled={busy}
              onClick={() => onPromote("email")}
            >
              {job.promoted_email_at ? "In jobs email" : "Mark sent in email"}
            </Button>
            <Button size="small" component={Link} href={`/jobs/${job.slug}`} target="_blank">
              Public page
            </Button>
            <Button size="small" color="error" disabled={busy} onClick={onExpire}>
              Take off the board
            </Button>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const APP_TONE: Record<string, "default" | "success" | "error"> = { neutral: "default", positive: "success", closed: "error" };

/**
 * Every application on the board. The admin does not set statuses —
 * the practice does, from its own applicants page — but this is where
 * the team can confirm an application exists, that the email to the
 * practice went out, and open the CV if a practice says it never
 * arrived.
 */
function ApplicationsTable({
  rows,
  stats,
  jobFilter,
  onClearJobFilter,
}: {
  rows: AdminApplication[];
  stats: AppStats | null;
  jobFilter: string | null;
  onClearJobFilter: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 1.5 }}>
        <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
          {jobFilter ? (
            <>
              Showing applications for one post.{" "}
              <Button size="small" onClick={onClearJobFilter} sx={{ textTransform: "none", p: 0, minWidth: 0 }}>
                Show all
              </Button>
            </>
          ) : stats ? (
            `${stats.total} total · ${stats.shortlisted} shortlisted · ${stats.hired} hired${stats.undelivered > 0 ? ` · ${stats.undelivered} not yet delivered to the practice` : ""}`
          ) : (
            ""
          )}
        </Typography>
      </Stack>

      {rows.length === 0 ? (
        <Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>No applications yet.</Typography>
      ) : (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", overflow: "hidden" }}>
          <Box
            sx={{
              display: { xs: "none", md: "grid" },
              gridTemplateColumns: "1.6fr 1.8fr 1fr 1fr 0.9fr 0.6fr",
              gap: 2,
              px: 2,
              py: 1,
              bgcolor: "grey.50",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            {["Applicant", "Job", "Applied", "Delivered", "Status", "CV"].map((h) => (
              <Typography key={h} sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary" }}>
                {h}
              </Typography>
            ))}
          </Box>
          {rows.map((a, i) => {
            const open = openId === a.id;
            return (
              <Box key={a.id} sx={{ borderBottom: i === rows.length - 1 ? 0 : 1, borderColor: "divider" }}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(open ? null : a.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(open ? null : a.id);
                    }
                  }}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1.6fr 1.8fr 1fr 1fr 0.9fr 0.6fr" },
                    gap: { xs: 0.5, md: 2 },
                    px: 2,
                    py: 1.5,
                    alignItems: "center",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "grey.50" },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: "0.9rem" }} noWrap>{a.full_name}</Typography>
                    <Typography sx={{ color: "text.secondary", fontSize: "0.78rem" }} noWrap>
                      {a.email}{a.phone ? ` · ${a.phone}` : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.88rem" }} noWrap>
                      {a.job ? roleLabel(a.job.role, a.job.role_other) : "Post removed"}
                    </Typography>
                    <Typography sx={{ color: "text.secondary", fontSize: "0.78rem" }} noWrap>
                      {a.job ? `${a.job.practice_name} · ${a.job.location}` : ""}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>{fmtDateTime(a.created_at)}</Typography>
                  <Box>
                    {a.delivered_at ? (
                      <Typography sx={{ fontSize: "0.82rem", color: "success.dark" }}>Emailed {fmtDateTime(a.delivered_at)}</Typography>
                    ) : (
                      <Typography sx={{ fontSize: "0.82rem", color: "error.main" }} title={a.delivery_error ?? undefined}>
                        Not delivered{a.delivery_error ? " · see details" : ""}
                      </Typography>
                    )}
                  </Box>
                  <Box>
                    <Chip size="small" label={applicationStatusLabel(a.status)} color={APP_TONE[applicationStatusTone(a.status)]} variant="outlined" sx={{ fontWeight: 600 }} />
                  </Box>
                  <Box onClick={(e) => e.stopPropagation()}>
                    {a.cv_url ? (
                      <Button size="small" component="a" href={a.cv_url} target="_blank" rel="noopener noreferrer" startIcon={<DownloadOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ minWidth: 0, px: 0.5 }}>
                        CV
                      </Button>
                    ) : (
                      <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>n/a</Typography>
                    )}
                  </Box>
                </Box>
                {open ? (
                  <Box sx={{ px: 2, pb: 2, pt: 0.5, bgcolor: "grey.50", fontSize: "0.85rem" }}>
                    <Stack spacing={0.5}>
                      {a.job ? (
                        <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
                          Sent to {a.job.apply_email ?? ""}
                          {a.job.poster ? ` (posted by ${a.job.poster.name || a.job.poster.email})` : ""}
                          {" · "}
                          <Link href={`/jobs/${a.job.slug}`} target="_blank" style={{ color: "inherit" }}>public page</Link>
                        </Typography>
                      ) : null}
                      <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
                        CV: {a.cv_filename ?? "none"} · Copy to applicant: {a.copy_to_applicant ? "yes" : "no"}
                        {a.status_changed_at ? ` · Status set ${fmtDateTime(a.status_changed_at)}` : ""}
                      </Typography>
                      {a.delivery_error ? (
                        <Alert severity="error" sx={{ py: 0.25 }}>Delivery error: {a.delivery_error}</Alert>
                      ) : null}
                      {a.message ? (
                        <Typography sx={{ fontSize: "0.88rem", whiteSpace: "pre-wrap", mt: 0.5, p: 1.5, bgcolor: "background.paper", borderRadius: 1, border: 1, borderColor: "divider" }}>
                          {a.message}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/**
 * Edit before approving — the spec's own words for why this exists:
 * "typos, missing pay, formatting".
 *
 * It renders the MEMBER's form, not an admin-only one. That is the point:
 * the same client checks and, behind them, the same validateJobInput()
 * on the server, so an admin cannot approve a post into a shape the
 * member's form would have refused. An edit-before-approve screen with
 * looser rules than the submit screen is just a slower way of publishing
 * a post with no pay range on it.
 *
 * Editing a LIVE post here does not send it back to review (an admin is
 * the review) and never moves the slug — that URL is already in the
 * Facebook group and indexed by Google.
 */
function EditDialog({
  job,
  busy,
  error,
  onClose,
  onSave,
}: {
  job: AdminJob | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: JobFormValues) => void;
}) {
  return (
    <Dialog open={!!job} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {job?.status === "pending_review" ? "Edit before approving" : "Edit this post"}
      </DialogTitle>
      <DialogContent dividers>
        {job ? (
          <>
            <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", mb: 2 }}>
              {job.poster?.name ?? "Unknown"} · {job.practice_name} ·{" "}
              <code>/jobs/{job.slug}</code>
              {job.status === "live" ? " · live now" : ""}
            </Typography>
            {job.status === "live" ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                This post is live. Saving updates the public page straight away and keeps the same
                web address, so the link already in the group keeps working.
              </Alert>
            ) : null}
            {/* keyed on the job id so opening a different post remounts
                the form with that post's values instead of keeping the
                previous one's state */}
            <JobPostForm
              key={job.id}
              initial={jobRowToFormValues(job)}
              submitLabel="Save changes"
              onSubmit={onSave}
              busy={busy}
              error={error}
            />
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function StatusChip({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; color: string; bg: string }> = {
    draft: { label: "Draft", color: "#5C6770", bg: "#F1EBDF" },
    pending_review: { label: "Pending", color: "#8A6100", bg: "#FBF0D6" },
    live: { label: "Live", color: "#1B5E20", bg: "#E4F1E4" },
    rejected: { label: "Rejected", color: "#B3261E", bg: "#FBE6E4" },
    expired: { label: "Expired", color: "#5C6770", bg: "#F1EBDF" },
    filled: { label: "Filled", color: "#8A6100", bg: "#FBF0D6" },
  };
  const s = map[status];
  return (
    <Chip
      label={s.label}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, height: 20, fontSize: "0.7rem" }}
    />
  );
}

/**
 * Rejection needs a reason before the button will fire. The member gets
 * this text verbatim by email, so the dialog says so — it changes how
 * people write it.
 */
function RejectDialog({
  job,
  reason,
  setReason,
  busy,
  onClose,
  onConfirm,
}: {
  job: AdminJob | null;
  reason: string;
  setReason: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!job} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Reject this post</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: "text.secondary", mb: 2, fontSize: "0.9rem" }}>
          {job ? `${roleLabel(job.role, job.role_other)} · ${job.practice_name}` : ""}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          helperText="Sent to the poster word for word. Tell them what to change so they can resubmit."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          disabled={busy || reason.trim().length < 5}
          onClick={onConfirm}
        >
          Reject and email
        </Button>
      </DialogActions>
    </Dialog>
  );
}
