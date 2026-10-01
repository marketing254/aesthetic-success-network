"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import { roleLabel } from "@/lib/jobs/constants";
import { daysUntil, formatPay, postedAgo } from "@/lib/jobs/format";
import { useLiveRefresh } from "@/lib/jobs/useLiveRefresh";
import type { JobPayUnitValue, JobStatus } from "@/lib/supabase/types";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

type MyJob = {
  id: string;
  slug: string;
  practice_name: string;
  role: string;
  role_other: string | null;
  employment_type: string;
  location: string;
  workplace: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: JobPayUnitValue;
  status: JobStatus;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  expires_at: string | null;
  filled_at: string | null;
  renewal_count: number;
  view_count: number;
  application_count: number;
  promoted_facebook_at: string | null;
  promoted_email_at: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<JobStatus, { label: string; fg: string; bg: string }> = {
  draft: { label: "Draft", fg: "#5C6770", bg: "#EFEAE0" },
  pending_review: { label: "In review", fg: "#8A6100", bg: "#FBF0D6" },
  live: { label: "Live", fg: "#1B5E20", bg: "#E4F1E4" },
  rejected: { label: "Needs a change", fg: "#B3261E", bg: "#FBE6E4" },
  expired: { label: "Expired", fg: "#5C6770", bg: "#EFEAE0" },
  filled: { label: "Filled", fg: "#8A6100", bg: "#FBF0D6" },
};

type Filter = "all" | JobStatus;

/** Order the filter chips appear in. */
const FILTER_ORDER: Filter[] = ["all", "live", "pending_review", "rejected", "draft", "filled", "expired"];
const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  live: "Live",
  pending_review: "In review",
  rejected: "Needs a change",
  draft: "Drafts",
  filled: "Filled",
  expired: "Expired",
};

/** Live first, then anything that needs the member's attention, then the rest. */
const STATUS_RANK: Record<JobStatus, number> = {
  rejected: 0,
  live: 1,
  pending_review: 2,
  draft: 3,
  filled: 4,
  expired: 5,
};

/**
 * /dashboard/jobs — the member's own posts, in every state.
 *
 * One compact row per post so a practice with a dozen openings can still
 * see everything on one screen: role and location, pay, status, the
 * numbers that matter (views, applicants, days left), one primary action
 * and a menu for the rest. The list refreshes itself, so an approval
 * from the admin queue shows up here without a reload.
 */
export default function MyJobsPage() {
  return (
    <Suspense fallback={null}>
      <MyJobs />
    </Suspense>
  );
}

function MyJobs() {
  const params = useSearchParams();
  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/member/jobs", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { jobs?: MyJob[] };
      setJobs(body.jobs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load);

  // Flags set by the post form and the one-click renewal link.
  const arrivalNotice = useMemo(() => {
    const posted = params.get("posted");
    const renew = params.get("renew");
    const edited = params.get("edited");
    if (posted === "review") return "Sent for review. We'll email you as soon as it's live; this list updates on its own.";
    if (posted === "draft") return "Saved as a draft.";
    if (edited === "review")
      return "Saved and sent back for review. It's off the board until we approve it, usually the same day. The link stays the same.";
    if (edited === "saved") return "Changes saved.";
    if (renew === "ok") return "Renewed. Your post is live for another 30 days.";
    if (renew === "unavailable") return "That post can't be renewed. Post it again instead.";
    if (renew === "invalid") return "That renewal link has expired. Use Renew from the post's menu.";
    if (renew === "error") return "Something went wrong renewing that post. Try again from the post's menu.";
    return null;
  }, [params]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: jobs.length, live: 0, pending_review: 0, rejected: 0, draft: 0, filled: 0, expired: 0 };
    for (const j of jobs) c[j.status] += 1;
    return c;
  }, [jobs]);

  const visible = useMemo(() => {
    let list = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);
    if (q.trim()) {
      const lc = q.toLowerCase();
      list = list.filter(
        (j) =>
          roleLabel(j.role, j.role_other).toLowerCase().includes(lc) ||
          j.practice_name.toLowerCase().includes(lc) ||
          j.location.toLowerCase().includes(lc),
      );
    }
    return [...list].sort((a, b) => {
      const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (r !== 0) return r;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [jobs, filter, q]);

  const act = async (id: string, action: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/member/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(body.error ?? "That didn't work. Please try again.");
        return;
      }
      const done: Record<string, string> = {
        submit: "Sent for review. We'll email you as soon as it's live.",
        fill: "Marked as filled. It's off the board and applications are closed.",
        unfill: "Back on the board.",
        renew: "Renewed for another 30 days.",
      };
      setToast(done[action] ?? "Done.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const removeDraft = async (id: string) => {
    if (!window.confirm("Delete this draft? This can't be undone.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/member/jobs/${id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(body.error ?? "That didn't work. Please try again.");
        return;
      }
      setToast("Draft deleted.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const attention = counts.rejected + counts.pending_review;

  return (
    <Box sx={{ maxWidth: 1040, mx: "auto", py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "flex-end" }, justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.22em", color: INK_MUTED, textTransform: "uppercase", mb: 1 }}>
            Hiring
          </Typography>
          <Typography
            component="h1"
            sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.9rem", md: "2.4rem" }, fontWeight: 500, color: INK, lineHeight: 1.1, letterSpacing: "-0.02em" }}
          >
            My job posts
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/dashboard/jobs/new"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, alignSelf: { xs: "stretch", sm: "auto" } }}
        >
          Post a job
        </Button>
      </Stack>

      {arrivalNotice && !dismissed ? (
        <Alert severity="success" variant="outlined" onClose={() => setDismissed(true)} sx={{ mb: 2.5, py: 0.25, bgcolor: "#fff" }}>
          {arrivalNotice}
        </Alert>
      ) : null}

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress size={28} />
        </Stack>
      ) : jobs.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 2 }}>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
              {FILTER_ORDER.filter((f) => f === "all" || counts[f] > 0).map((f) => {
                const active = filter === f;
                const style = f === "all" ? null : STATUS_STYLE[f];
                return (
                  <Chip
                    key={f}
                    size="small"
                    label={`${FILTER_LABEL[f]} · ${counts[f]}`}
                    onClick={() => setFilter(f)}
                    sx={{
                      fontWeight: 600,
                      bgcolor: active ? INK : style ? style.bg : "#fff",
                      color: active ? "#fff" : style ? style.fg : INK_SOFT,
                      border: `1px solid ${active ? INK : LINE}`,
                      "&:hover": { bgcolor: active ? INK : "#F3EFE6" },
                    }}
                  />
                );
              })}
            </Stack>
            {jobs.length > 4 ? (
              <TextField
                size="small"
                placeholder="Search posts"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlinedIcon sx={{ fontSize: 18, color: INK_MUTED }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ minWidth: 220, "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: 2 } }}
              />
            ) : null}
          </Stack>

          {attention > 0 && filter === "all" ? (
            <Typography sx={{ fontSize: "0.82rem", color: INK_MUTED, mb: 1.5 }}>
              {counts.rejected > 0 ? `${counts.rejected} ${counts.rejected === 1 ? "post needs" : "posts need"} a change before it can go live. ` : ""}
              {counts.pending_review > 0 ? `${counts.pending_review} in review, usually approved the same day.` : ""}
            </Typography>
          ) : null}

          <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 3, bgcolor: "#fff", overflow: "hidden" }}>
            <Box
              sx={{
                display: { xs: "none", md: "grid" },
                gridTemplateColumns: "2.2fr 1.1fr 1fr 1.4fr 1.6fr",
                gap: 2,
                px: 2.5,
                py: 1.25,
                bgcolor: "#FAF7F1",
                borderBottom: `1px solid ${LINE}`,
              }}
            >
              {["Post", "Pay", "Status", "Activity", ""].map((h, i) => (
                <Typography key={i} sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: INK_MUTED }}>
                  {h}
                </Typography>
              ))}
            </Box>

            {visible.length === 0 ? (
              <Typography sx={{ color: INK_MUTED, py: 5, textAlign: "center", fontSize: "0.92rem" }}>
                {q ? `Nothing matches "${q}".` : "Nothing in this view."}
              </Typography>
            ) : (
              visible.map((job, i) => (
                <JobRow
                  key={job.id}
                  job={job}
                  last={i === visible.length - 1}
                  busy={busyId === job.id}
                  onAction={(action) => act(job.id, action)}
                  onDelete={() => removeDraft(job.id)}
                />
              ))
            )}
          </Box>
        </>
      )}

      <Snackbar open={!!toast} autoHideDuration={4500} onClose={() => setToast(null)} message={toast ?? ""} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Box>
  );
}

function JobRow({
  job,
  last,
  busy,
  onAction,
  onDelete,
}: {
  job: MyJob;
  last: boolean;
  busy: boolean;
  onAction: (action: string) => void;
  onDelete: () => void;
}) {
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const style = STATUS_STYLE[job.status];
  const left = job.status === "live" ? daysUntil(job.expires_at) : null;
  const promoted = !!job.promoted_facebook_at || !!job.promoted_email_at;
  const applicants = job.application_count ?? 0;

  // One primary action per state; everything else lives in the menu.
  const primary: { label: string; action: string; icon: React.ReactNode } | null =
    job.status === "live"
      ? { label: "Mark as filled", action: "fill", icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16 }} /> }
      : job.status === "draft"
        ? { label: "Submit for review", action: "submit", icon: <SendRoundedIcon sx={{ fontSize: 16 }} /> }
        : job.status === "rejected"
          ? { label: "Send again", action: "submit", icon: <SendRoundedIcon sx={{ fontSize: 16 }} /> }
          : job.status === "expired"
            ? { label: "Relist 30 days", action: "renew", icon: <AutorenewRoundedIcon sx={{ fontSize: 16 }} /> }
            : job.status === "filled"
              ? { label: "Reopen", action: "unfill", icon: <AutorenewRoundedIcon sx={{ fontSize: 16 }} /> }
              : null;

  const activity =
    job.status === "live" ? (
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
        <Tooltip title="Views">
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <VisibilityOutlinedIcon sx={{ fontSize: 16, color: INK_MUTED }} />
            <Typography sx={{ fontSize: "0.85rem", color: INK_SOFT }}>{job.view_count}</Typography>
          </Stack>
        </Tooltip>
        <Tooltip title="Applicants">
          <Button
            size="small"
            component={Link}
            href={`/dashboard/jobs/${job.id}/applicants`}
            startIcon={<GroupOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{ color: applicants > 0 ? GOLD : INK_SOFT, minWidth: 0, px: 0.5, fontWeight: applicants > 0 ? 700 : 500, fontSize: "0.85rem" }}
          >
            {applicants}
          </Button>
        </Tooltip>
        {left !== null ? (
          <Typography sx={{ fontSize: "0.78rem", color: left <= 5 ? "#8A6100" : INK_MUTED }}>
            {left <= 0 ? "Expires today" : `${left}d left`}
          </Typography>
        ) : null}
        <Typography sx={{ fontSize: "0.78rem", color: promoted ? GOLD : INK_MUTED }}>{promoted ? "Promoted" : "Promotion queued"}</Typography>
      </Stack>
    ) : job.status === "filled" ? (
      <Typography sx={{ fontSize: "0.82rem", color: INK_MUTED }}>
        {applicants} {applicants === 1 ? "applicant" : "applicants"} · filled {postedAgo(job.filled_at ?? job.created_at)}
      </Typography>
    ) : job.status === "pending_review" ? (
      <Typography sx={{ fontSize: "0.82rem", color: INK_MUTED }}>Submitted {postedAgo(job.submitted_at ?? job.created_at)}</Typography>
    ) : job.status === "rejected" ? (
      <Typography sx={{ fontSize: "0.82rem", color: "#B3261E" }} noWrap title={job.rejection_reason ?? undefined}>
        {job.rejection_reason ?? "See the email for what to change."}
      </Typography>
    ) : (
      <Typography sx={{ fontSize: "0.82rem", color: INK_MUTED }}>Saved {postedAgo(job.created_at)}</Typography>
    );

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr auto", md: "2.2fr 1.1fr 1fr 1.4fr 1.6fr" },
        alignItems: "center",
        gap: { xs: 1, md: 2 },
        px: { xs: 2, md: 2.5 },
        py: 1.5,
        borderBottom: last ? 0 : `1px solid ${LINE}`,
        bgcolor: job.status === "rejected" ? "#FFFBFA" : "transparent",
        "&:hover": { bgcolor: "#FCFAF6" },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: INK }} noWrap>
          {roleLabel(job.role, job.role_other)}
        </Typography>
        <Typography sx={{ color: INK_MUTED, fontSize: "0.8rem" }} noWrap>
          {job.practice_name} · {job.location}
        </Typography>
        <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
          <Chip label={style.label} size="small" sx={{ color: style.fg, bgcolor: style.bg, fontWeight: 600, height: 22, fontSize: "0.72rem" }} />
          <Typography sx={{ color: INK_MUTED, fontSize: "0.78rem" }}>{formatPay(job.pay_min, job.pay_max, job.pay_unit)}</Typography>
        </Box>
        <Box sx={{ display: { xs: "block", md: "none" }, mt: 0.5 }}>{activity}</Box>
      </Box>

      <Typography sx={{ display: { xs: "none", md: "block" }, color: INK_SOFT, fontSize: "0.85rem" }} noWrap>
        {formatPay(job.pay_min, job.pay_max, job.pay_unit)}
      </Typography>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Chip label={style.label} size="small" sx={{ color: style.fg, bgcolor: style.bg, fontWeight: 600, height: 24 }} />
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>{activity}</Box>

      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
        {primary ? (
          <Button
            size="small"
            variant={job.status === "rejected" || job.status === "draft" ? "contained" : "outlined"}
            disabled={busy}
            onClick={() => onAction(primary.action)}
            startIcon={primary.icon}
            sx={{
              whiteSpace: "nowrap",
              fontSize: "0.78rem",
              ...(job.status === "rejected" || job.status === "draft"
                ? { bgcolor: INK, "&:hover": { bgcolor: "#06182A" } }
                : { color: INK, borderColor: LINE, "&:hover": { borderColor: INK, bgcolor: "#F7F5F0" } }),
            }}
          >
            {primary.label}
          </Button>
        ) : null}
        <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} aria-label="More actions" sx={{ color: INK_SOFT }}>
          <MoreHorizRoundedIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
          {job.status === "live" || job.status === "filled" ? (
            <MenuItem component={Link} href={`/jobs/${job.slug}`} target="_blank" onClick={() => setMenuEl(null)}>
              <ListItemIcon><OpenInNewRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>View public page</ListItemText>
            </MenuItem>
          ) : null}
          {job.status === "live" || job.status === "filled" ? (
            <MenuItem component={Link} href={`/dashboard/jobs/${job.id}/applicants`} onClick={() => setMenuEl(null)}>
              <ListItemIcon><GroupOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Applicants ({applicants})</ListItemText>
            </MenuItem>
          ) : null}
          {job.status !== "expired" ? (
            <MenuItem component={Link} href={`/dashboard/jobs/${job.id}/edit`} onClick={() => setMenuEl(null)}>
              <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          ) : null}
          {job.status === "live" ? (
            <MenuItem disabled={busy} onClick={() => { setMenuEl(null); onAction("renew"); }}>
              <ListItemIcon><AutorenewRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Renew 30 days</ListItemText>
            </MenuItem>
          ) : null}
          {job.status === "draft" ? (
            <MenuItem disabled={busy} onClick={() => { setMenuEl(null); onDelete(); }} sx={{ color: "#B3261E" }}>
              <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" sx={{ color: "#B3261E" }} /></ListItemIcon>
              <ListItemText>Delete draft</ListItemText>
            </MenuItem>
          ) : null}
        </Menu>
      </Stack>
    </Box>
  );
}

function EmptyState() {
  return (
    <Box sx={{ border: `1px dashed ${LINE}`, borderRadius: 3, p: { xs: 4, md: 6 }, textAlign: "center", bgcolor: "#fff" }}>
      <WorkOutlineRoundedIcon sx={{ fontSize: 40, color: GOLD, mb: 1.5 }} />
      <Typography sx={{ fontWeight: 600, color: INK, fontSize: "1.1rem", mb: 1 }}>Hiring? Skip the paid job board</Typography>
      <Typography sx={{ color: INK_MUTED, maxWidth: 460, mx: "auto", lineHeight: 1.7, mb: 3 }}>
        Post your vacancy here and it gets its own public page, written so Google can list it as a job.
        It&apos;s part of your membership.
      </Typography>
      <Button component={Link} href="/dashboard/jobs/new" variant="contained" startIcon={<AddRoundedIcon />} sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" } }}>
        Post a job
      </Button>
    </Box>
  );
}
