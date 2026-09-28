"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "@/lib/jobs/useLiveRefresh";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import {
  JOB_APPLICATION_STATUSES,
  applicationStatusLabel,
  applicationStatusTone,
  roleLabel,
} from "@/lib/jobs/constants";

/**
 * Who applied for one of my job posts.
 *
 * The status control here is the source of the applicant's "check your
 * progress" view. It defaults to Submitted and stays there until the
 * practice moves it — nothing on this page auto-advances, because a
 * status that moves on its own would be telling candidates something
 * that isn't true.
 *
 * CV links are signed URLs that expire in ten minutes. If someone leaves
 * this page open over lunch the links go stale; the live refresh mints
 * new ones. That is the intended trade — a CV is the most sensitive
 * thing the board stores and it should not sit behind a URL that works
 * forever once shared.
 */

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const GOLD_SOFT = "#FBF3E1";
const LINE = "#E6DDCF";

const TONE: Record<"neutral" | "positive" | "closed", { fg: string; bg: string }> = {
  neutral: { fg: INK_SOFT, bg: "#F3F1EC" },
  positive: { fg: "#1B6B4A", bg: "#E4F1E4" },
  closed: { fg: "#8A3A3A", bg: "#F8E5E5" },
};

const AVATAR_COLORS = ["#0E2A3D", "#1B6B4A", "#A07823", "#5B4B8A", "#8A3A3A", "#2F6F8F"];

type JobRef = {
  id: string;
  slug: string;
  practice_name: string;
  role: string;
  role_other: string | null;
};

type ApplicationRow = {
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
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function avatarColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function JobApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [job, setJob] = useState<JobRef | null>(null);
  const [rows, setRows] = useState<ApplicationRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/member/jobs/${id}/applications`, { cache: "no-store" });
      const body = (await res.json()) as {
        ok?: boolean;
        job?: JobRef;
        applications?: ApplicationRow[];
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Couldn't load applicants.");
        return;
      }
      setJob(body.job ?? null);
      setRows(body.applications ?? []);
    } catch {
      setErr("Couldn't reach the server. Check your connection and try again.");
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);
  useLiveRefresh(load);

  async function setStatus(applicationId: string, status: string) {
    setSavingId(applicationId);
    setErr(null);
    // Optimistic: the control should feel instant. A failure below
    // reloads from the server, so the UI can't stay wrong.
    setRows(
      (prev) =>
        prev?.map((r) => (r.id === applicationId ? { ...r, status } : r)) ?? prev,
    );
    try {
      const res = await fetch(`/api/member/jobs/${id}/applications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: applicationId, status }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setErr(body.error ?? "Couldn't update that status.");
        await load();
      } else {
        setToast(`Marked as ${applicationStatusLabel(status).toLowerCase()}. The applicant sees this.`);
      }
    } catch {
      setErr("Couldn't reach the server.");
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${what} copied`);
    } catch {
      setToast("Couldn't copy. Select it and copy manually.");
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows?.length ?? 0 };
    for (const s of JOB_APPLICATION_STATUSES) c[s.value] = 0;
    for (const r of rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!q || r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)),
    );
  }, [rows, filter, search]);

  const jobTitle = job ? roleLabel(job.role, job.role_other) : "";
  const mailSubject = job ? `Your application for ${jobTitle} at ${job.practice_name}` : "Your application";

  return (
    <Box sx={{ maxWidth: 1040, mx: "auto", py: { xs: 3, md: 4 }, px: { xs: 2, md: 0 } }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <Button
        component={NextLink}
        href="/dashboard/jobs"
        startIcon={<ArrowBackRoundedIcon />}
        sx={{ color: INK_MUTED, pl: 0, mb: 1.5, "&:hover": { bgcolor: "transparent", color: INK } }}
      >
        My job posts
      </Button>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" }, mb: 3 }}
      >
        <Box>
          <Typography
            sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: GOLD, mb: 0.5 }}
          >
            Applicants
          </Typography>
          <Typography component="h1" sx={{ fontSize: { xs: "1.6rem", md: "2rem" }, fontWeight: 700, color: INK, lineHeight: 1.15 }}>
            {job ? jobTitle : "Loading…"}
          </Typography>
          {job ? (
            <Typography sx={{ color: INK_MUTED, mt: 0.5 }}>{job.practice_name}</Typography>
          ) : null}
        </Box>
        {job ? (
          <Button
            href={`/jobs/${job.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{ color: INK, borderColor: LINE, bgcolor: "#fff", borderRadius: 2, whiteSpace: "nowrap", "&:hover": { borderColor: INK, bgcolor: "#fff" } }}
          >
            View public post
          </Button>
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
          <Typography sx={{ color: INK_MUTED }}>Loading applicants…</Typography>
        </Stack>
      ) : null}

      {rows !== null ? (
        <>
          {/* ── Summary tiles (click to filter) ──────────────────────── */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(6, minmax(0, 1fr))" },
              gap: 1.5,
              mb: 3,
            }}
          >
            <StatTile label="All" value={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
            {JOB_APPLICATION_STATUSES.map((s) => (
              <StatTile
                key={s.value}
                label={s.label}
                value={counts[s.value] ?? 0}
                tone={s.tone}
                active={filter === s.value}
                onClick={() => setFilter(filter === s.value ? "all" : s.value)}
              />
            ))}
          </Box>

          {rows.length === 0 ? (
            <Box
              sx={{ py: 7, px: 3, textAlign: "center", border: `1px dashed ${LINE}`, borderRadius: 3, bgcolor: "#fff" }}
            >
              <Typography sx={{ color: INK, fontWeight: 700, fontSize: "1.05rem", mb: 1 }}>
                Nobody has applied yet
              </Typography>
              <Typography sx={{ color: INK_MUTED, maxWidth: 420, mx: "auto", lineHeight: 1.7 }}>
                Applications land here the moment they arrive, and we email you each one. Share the
                public post link to bring in more candidates.
              </Typography>
            </Box>
          ) : (
            <>
              {/* ── Toolbar ─────────────────────────────────────────── */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
              >
                <Typography sx={{ color: INK_SOFT, fontSize: "0.92rem" }}>
                  Showing <strong>{visible.length}</strong> of {rows.length}
                  {filter !== "all" ? ` · ${applicationStatusLabel(filter)}` : ""}
                </Typography>
                <TextField
                  size="small"
                  placeholder="Search by name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ minWidth: { sm: 280 }, bgcolor: "#fff", "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon sx={{ fontSize: 18, color: INK_MUTED }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Stack>

              {visible.length === 0 ? (
                <Box sx={{ py: 5, textAlign: "center", border: `1px dashed ${LINE}`, borderRadius: 3, bgcolor: "#fff" }}>
                  <Typography sx={{ color: INK, fontWeight: 600, mb: 0.5 }}>No applicants match</Typography>
                  <Button
                    onClick={() => {
                      setFilter("all");
                      setSearch("");
                    }}
                    sx={{ color: GOLD }}
                  >
                    Clear filters
                  </Button>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {visible.map((row) => {
                    const tone = TONE[applicationStatusTone(row.status)];
                    const isOpen = expanded.has(row.id);
                    const longMessage = (row.message?.length ?? 0) > 220;
                    const saving = savingId === row.id;
                    return (
                      <Box
                        key={row.id}
                        sx={{
                          bgcolor: "#fff",
                          border: `1px solid ${LINE}`,
                          borderLeft: `4px solid ${row.status === "submitted" ? GOLD : tone.fg}`,
                          borderRadius: 3,
                          p: { xs: 2, md: 2.5 },
                          opacity: saving ? 0.7 : 1,
                          transition: "opacity 120ms",
                        }}
                      >
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
                            gap: { xs: 2, md: 3 },
                            alignItems: "start",
                          }}
                        >
                          {/* Identity + contact */}
                          <Stack direction="row" spacing={2} sx={{ minWidth: 0 }}>
                            <Box
                              aria-hidden
                              sx={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                flexShrink: 0,
                                bgcolor: avatarColor(row.email),
                                color: "#fff",
                                display: "grid",
                                placeItems: "center",
                                fontWeight: 700,
                                fontSize: "1rem",
                                letterSpacing: "0.02em",
                              }}
                            >
                              {initials(row.full_name)}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
                                <Typography sx={{ fontWeight: 700, color: INK, fontSize: "1.1rem", lineHeight: 1.2 }}>
                                  {row.full_name}
                                </Typography>
                                <StatusPill status={row.status} />
                              </Stack>
                              <Typography sx={{ color: INK_MUTED, fontSize: "0.85rem", mt: 0.4 }}>
                                Applied {formatDate(row.created_at)}
                                {row.status_changed_at && row.status !== "submitted"
                                  ? ` · ${applicationStatusLabel(row.status)} ${formatDate(row.status_changed_at)}`
                                  : ""}
                              </Typography>

                              <Stack direction="row" sx={{ mt: 1.25, flexWrap: "wrap", columnGap: 2, rowGap: 0.75, alignItems: "center" }}>
                                <ContactLine
                                  icon={<MailOutlineRoundedIcon sx={{ fontSize: 17 }} />}
                                  text={row.email}
                                  href={`mailto:${row.email}?subject=${encodeURIComponent(mailSubject)}`}
                                  onCopy={() => void copy(row.email, "Email")}
                                />
                                {row.phone ? (
                                  <ContactLine
                                    icon={<PhoneOutlinedIcon sx={{ fontSize: 17 }} />}
                                    text={row.phone}
                                    href={`tel:${row.phone.replace(/[^\d+]/g, "")}`}
                                    onCopy={() => void copy(row.phone ?? "", "Phone")}
                                  />
                                ) : null}
                              </Stack>

                              {row.message ? (
                                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "#FAF7F1", borderRadius: 2 }}>
                                  <Typography
                                    sx={{
                                      color: INK_SOFT,
                                      fontSize: "0.92rem",
                                      lineHeight: 1.65,
                                      whiteSpace: "pre-wrap",
                                      ...(longMessage && !isOpen
                                        ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }
                                        : {}),
                                    }}
                                  >
                                    {row.message}
                                  </Typography>
                                  {longMessage ? (
                                    <Button
                                      size="small"
                                      onClick={() =>
                                        setExpanded((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(row.id)) next.delete(row.id);
                                          else next.add(row.id);
                                          return next;
                                        })
                                      }
                                      sx={{ color: GOLD, px: 0, mt: 0.5, minWidth: 0 }}
                                    >
                                      {isOpen ? "Show less" : "Read full message"}
                                    </Button>
                                  ) : null}
                                </Box>
                              ) : null}

                              <Stack direction="row" spacing={1} sx={{ mt: 1.75, flexWrap: "wrap", rowGap: 1 }}>
                                {row.cv_url ? (
                                  <Button
                                    href={row.cv_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="contained"
                                    size="small"
                                    startIcon={<DownloadRoundedIcon />}
                                    sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, borderRadius: 2, textTransform: "none", maxWidth: 320 }}
                                  >
                                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {row.cv_filename ?? "Download CV"}
                                    </Box>
                                  </Button>
                                ) : (
                                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: INK_MUTED, fontSize: "0.85rem" }}>
                                    <DescriptionOutlinedIcon sx={{ fontSize: 17 }} />
                                    <span>No CV attached</span>
                                  </Stack>
                                )}
                                <Button
                                  href={`mailto:${row.email}?subject=${encodeURIComponent(mailSubject)}`}
                                  variant="outlined"
                                  size="small"
                                  startIcon={<MailOutlineRoundedIcon />}
                                  sx={{ color: INK, borderColor: LINE, borderRadius: 2, "&:hover": { borderColor: INK, bgcolor: "#fff" } }}
                                >
                                  Email candidate
                                </Button>
                              </Stack>
                            </Box>
                          </Stack>

                          {/* Status control */}
                          <Box sx={{ minWidth: { md: 260 } }}>
                            <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: INK_MUTED, mb: 0.75 }}>
                              Status
                            </Typography>
                            <ToggleButtonGroup
                              exclusive
                              size="small"
                              value={row.status}
                              disabled={saving}
                              onChange={(_, v: string | null) => {
                                if (v && v !== row.status) void setStatus(row.id, v);
                              }}
                              sx={{
                                flexWrap: "wrap",
                                gap: 0.75,
                                "& .MuiToggleButtonGroup-grouped": {
                                  border: `1px solid ${LINE} !important`,
                                  borderRadius: "999px !important",
                                  textTransform: "none",
                                  fontWeight: 600,
                                  fontSize: "0.8rem",
                                  px: 1.5,
                                  py: 0.5,
                                  color: INK_SOFT,
                                  bgcolor: "#fff",
                                },
                              }}
                            >
                              {JOB_APPLICATION_STATUSES.map((s) => {
                                const t = TONE[s.tone];
                                return (
                                  <ToggleButton
                                    key={s.value}
                                    value={s.value}
                                    sx={{
                                      "&.Mui-selected": {
                                        bgcolor: `${t.bg} !important`,
                                        color: `${t.fg} !important`,
                                        borderColor: `${t.fg} !important`,
                                      },
                                    }}
                                  >
                                    {s.label}
                                  </ToggleButton>
                                );
                              })}
                            </ToggleButtonGroup>
                            <Typography sx={{ color: INK_MUTED, fontSize: "0.78rem", mt: 1 }}>
                              The applicant sees this in their account.
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </>
          )}
        </>
      ) : null}

      <Snackbar
        open={toast !== null}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}

function StatTile({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "positive" | "closed";
  active: boolean;
  onClick: () => void;
}) {
  const t = tone ? TONE[tone] : null;
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        bgcolor: active ? GOLD_SOFT : "#fff",
        border: `1px solid ${active ? GOLD : LINE}`,
        borderRadius: 2.5,
        px: 1.75,
        py: 1.25,
        transition: "border-color 120ms, background-color 120ms",
        "&:hover": { borderColor: GOLD },
      }}
    >
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: t && value > 0 ? t.fg : INK, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: "0.78rem", color: INK_MUTED, mt: 0.5, fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

function StatusPill({ status }: { status: string }) {
  const t = TONE[applicationStatusTone(status)];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 1,
        py: 0.2,
        borderRadius: 999,
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        bgcolor: status === "submitted" ? GOLD_SOFT : t.bg,
        color: status === "submitted" ? GOLD : t.fg,
      }}
    >
      {status === "submitted" ? "New" : applicationStatusLabel(status)}
    </Box>
  );
}

function ContactLine({
  icon,
  text,
  href,
  onCopy,
}: {
  icon: React.ReactNode;
  text: string;
  href: string;
  onCopy: () => void;
}) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", minWidth: 0 }}>
      <Box component="span" sx={{ display: "inline-flex", color: INK_MUTED }}>
        {icon}
      </Box>
      <a
        href={href}
        style={{ color: INK_SOFT, textDecoration: "none", fontSize: "0.92rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {text}
      </a>
      <Tooltip title="Copy">
        <IconButton size="small" onClick={onCopy} aria-label={`Copy ${text}`} sx={{ color: INK_MUTED, p: 0.4 }}>
          <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
