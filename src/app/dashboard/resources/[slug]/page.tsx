"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import SlideshowOutlinedIcon from "@mui/icons-material/SlideshowOutlined";
import HeadphonesOutlinedIcon from "@mui/icons-material/HeadphonesOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import StickyNote2OutlinedIcon from "@mui/icons-material/StickyNote2Outlined";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import type { SvgIconComponent } from "@mui/icons-material";
import { visualForTopic } from "@/components/member/topicVisuals";
import { InlineTag, editorialText, ink } from "@/components/member/Editorial";
import { BookCoachingCard } from "@/components/member/BookCoachingCard";
import FeedbackDialog from "@/components/member/FeedbackDialog";
import ResourceInquiries from "@/components/member/ResourceInquiries";

type Progress = {
  last_viewed_at: string | null;
  completed_at: string | null;
  watch_seconds: number;
};

type ResourceItem = {
  id: string;
  topic_slug: string;
  topic_title: string;
  topic_summary: string | null;
  category: string | null;
  portal_card_url: string | null;
  resource_card_url: string | null;
  title: string;
  description: string | null;
  kind: string;
  storage_path: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  duration_label: string | null;
  position: number;
  is_free: boolean;
  kit_type?: "standard" | "book_club" | null;
  book_club_payload?: {
    shorts?: { index: number; principle: string; public_url: string | null }[];
    has_infographic?: boolean;
  } | null;
  originating_expert_id?: string | null;
  progress: Progress | null;
};

type RouteParams = Promise<{ slug: string }>;

const KIND_META: Record<
  string,
  {
    icon: SvgIconComponent;
    defaultMeta: string;
    actionLabel: string;
    badge: string;
  }
> = {
  video_intro: { icon: OndemandVideoOutlinedIcon, defaultMeta: "Short intro video", actionLabel: "Watch", badge: "Video" },
  video_full: { icon: PlayArrowRoundedIcon, defaultMeta: "Full training session", actionLabel: "Watch", badge: "Training" },
  video_explainer: { icon: OndemandVideoOutlinedIcon, defaultMeta: "Explainer video", actionLabel: "Watch", badge: "Explainer" },
  video_trailer: { icon: OndemandVideoOutlinedIcon, defaultMeta: "Trailer", actionLabel: "Watch", badge: "Trailer" },
  audio: { icon: HeadphonesOutlinedIcon, defaultMeta: "Audio episode", actionLabel: "Listen", badge: "Audio" },
  action_guide: { icon: ListAltOutlinedIcon, defaultMeta: "PDF · the full reference", actionLabel: "Download", badge: "PDF" },
  checklist: { icon: ChecklistOutlinedIcon, defaultMeta: "PDF · set up → track → review", actionLabel: "Download", badge: "PDF" },
  key_takeaways: { icon: StickyNote2OutlinedIcon, defaultMeta: "PDF · the gist in 2 minutes", actionLabel: "Download", badge: "PDF" },
  worksheet: { icon: EditNoteOutlinedIcon, defaultMeta: "PDF · fillable", actionLabel: "Download", badge: "PDF" },
  slide_deck: { icon: SlideshowOutlinedIcon, defaultMeta: "Slide deck · flip through inline", actionLabel: "Open", badge: "Slides" },
  email_sequence: { icon: EmailOutlinedIcon, defaultMeta: "PDF · ready-to-send scripts", actionLabel: "Download", badge: "PDF" },
  // Book Club kinds — produced by the bulk importer.
  book_study_guide: { icon: ListAltOutlinedIcon, defaultMeta: "PDF · full study guide", actionLabel: "Download", badge: "PDF" },
  discussion_questions: { icon: EditNoteOutlinedIcon, defaultMeta: "PDF · discussion prompts", actionLabel: "Download", badge: "PDF" },
  infographic: { icon: SlideshowOutlinedIcon, defaultMeta: "PDF · one-page visual summary", actionLabel: "Download", badge: "PDF" },
  infographic_image: { icon: SlideshowOutlinedIcon, defaultMeta: "PNG · printable visual summary", actionLabel: "Download", badge: "Image" },
  video_short: { icon: PlayArrowRoundedIcon, defaultMeta: "Key principle · 9×16 short", actionLabel: "Watch", badge: "Short" },
  // Landscape 16×9 extras from the newer expert kits. They play in the
  // normal wide player alongside the training video — only video_short
  // belongs in the vertical shorts rail.
  video_spotlight: { icon: PlayArrowRoundedIcon, defaultMeta: "The expert's signature answer", actionLabel: "Watch", badge: "Spotlight" },
  video_highlight: { icon: PlayArrowRoundedIcon, defaultMeta: "Key moment · 16×9", actionLabel: "Watch", badge: "Highlight" },
  other: { icon: InsertDriveFileOutlinedIcon, defaultMeta: "File", actionLabel: "Open", badge: "File" },
};

function isVideo(kind: string): boolean {
  return kind.startsWith("video_") || kind === "audio";
}

/**
 * Kinds that always render as PDF in the inline iframe (regardless of
 * mime_type), kept for resources that the upload pipeline classifies into
 * one of these even when the file extension is missing or weird.
 */
const PDF_KINDS = new Set([
  "action_guide",
  "checklist",
  "key_takeaways",
  "worksheet",
  "email_sequence",
  // Book Club PDF kinds — so they preview inline even if mime_type is unset.
  "book_study_guide",
  "discussion_questions",
  "infographic",
]);

/**
 * Any application/pdf file previews inline, regardless of its kind.
 * (Wall Poster.pdf is kind='other' but is still a PDF; we want it to render.)
 */
function isPdf(r: { kind: string; mime_type: string | null }): boolean {
  return PDF_KINDS.has(r.kind) || r.mime_type === "application/pdf";
}

/**
 * Image resources (e.g. the Book Club infographic PNG) preview inline as
 * a plain <img>, so they don't fall through to the "can't preview" panel.
 */
function isImage(r: { kind: string; mime_type: string | null }): boolean {
  return r.kind === "infographic_image" || (r.mime_type?.startsWith("image/") ?? false);
}

/**
 * .pptx files used to render through Microsoft Office Online's public
 * embed viewer, which is slow and shows MS chrome. We now always prefer
 * the matching PDF (every kit ships both); the .pptx stays in the
 * curriculum as a download for members who want an editable copy.
 */
function isOffice(_r: { kind: string; mime_type: string | null }): boolean {
  return false;
}

/**
 * Anything we can show inline in the player canvas (with the right iframe).
 */
function isPreviewable(r: { kind: string; mime_type: string | null }): boolean {
  return isPdf(r) || isOffice(r) || isImage(r);
}

/**
 * Build the iframe src for a previewable file. Native browser PDF reader,
 * fitted to page width with the toolbar on so members can flip slides,
 * fullscreen, and download from inside the viewer.
 */
function previewSrc(_r: { kind: string; mime_type: string | null }, url: string): string {
  return `${url}#view=FitH&toolbar=1&navpanes=0`;
}

// Note: progress is now tracked OPTIMISTICALLY inside the page component
// so the local `resources` array reflects the change immediately. This
// powers the live progress bar AND lets the 50% feedback prompt fire
// without a page refresh.

export default function ResourceKitDetailPage({ params }: { params: RouteParams }) {
  const { slug } = use(params);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Book Club shorts play inline in their own compact card (not the big
  // 16:9 player) — this tracks which short is currently expanded/playing.
  const [activeShortId, setActiveShortId] = useState<string | null>(null);
  // The kit's originating expert (attributed kits): face + scheduler for
  // the "Go deeper" card.
  //   undefined → still resolving (card NOT rendered — prevents the
  //               "house card flashes first, then the real expert" swap)
  //   null      → house kit, no attributed expert → card uses the house scheduler (if configured)
  const [kitExpert, setKitExpert] = useState<{
    name: string;
    headshot_url: string | null;
    booking_link: string | null;
    specialty: string | null;
    company_name: string | null;
  } | null | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * Marks a resource as viewed (or completed) AND updates local state so
   * the progress bar + 50% feedback prompt react instantly. Without the
   * local mirror, the user had to refresh to see progress at all because
   * the React state stayed at the values fetched on mount.
   */
  // Attributed kit → load its expert's public info (face, scheduler) so
  // the "Go deeper" card features them instead of the default coach.
  const originatingExpertId = resources.find((r) => r.originating_expert_id)?.originating_expert_id ?? null;
  useEffect(() => {
    // Resources still loading → we don't know the kit's owner yet. Stay
    // "undefined" so the card doesn't render a default face it will swap.
    if (loading) return;
    if (!originatingExpertId) {
      setKitExpert(null); // house kit, no attributed expert
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/member/experts/${originatingExpertId}`, { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setKitExpert(null); // lookup failed → default coach, no swap later
          return;
        }
        const body = (await res.json()) as {
          expert?: { name: string; headshot_url: string | null; booking_link: string | null; specialty: string | null; company_name: string | null };
        };
        if (!active) return;
        if (body.expert) {
          setKitExpert({
            name: body.expert.name,
            headshot_url: body.expert.headshot_url,
            booking_link: body.expert.booking_link,
            specialty: body.expert.specialty,
            company_name: body.expert.company_name,
          });
        } else {
          setKitExpert(null);
        }
      } catch {
        if (active) setKitExpert(null); // card falls back to the default coach
      }
    })();
    return () => {
      active = false;
    };
  }, [originatingExpertId, loading]);

  const markProgress = useCallback(async (resourceId: string, action: "view" | "complete") => {
    const now = new Date().toISOString();
    setResources((prev) =>
      prev.map((r) => {
        if (r.id !== resourceId) return r;
        const previousProgress: Progress = r.progress ?? {
          last_viewed_at: null,
          completed_at: null,
          watch_seconds: 0,
        };
        return {
          ...r,
          progress: {
            last_viewed_at: previousProgress.last_viewed_at ?? now,
            completed_at:
              action === "complete"
                ? (previousProgress.completed_at ?? now)
                : previousProgress.completed_at,
            watch_seconds: previousProgress.watch_seconds,
          },
        };
      }),
    );
    try {
      await fetch(`/api/member/resources/${resourceId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    } catch {
      /* silent — optimistic state already reflects the intent */
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/member/resources?topic_slug=${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        if (!active) return;
        if (!res.ok) {
          setResources([]);
          return;
        }
        const body = (await res.json()) as { resources: ResourceItem[] };
        if (!active) return;
        setResources(body.resources ?? []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const visual = visualForTopic(slug);
  const TopicIcon = visual.icon;

  const orderedResources = useMemo(() => {
    const order = [
      // Main training first — same as a standard kit.
      "video_intro",
      "video_full",
      // The expert's signature answer sits right behind the training
      // video, then the individual highlight moments.
      "video_spotlight",
      "video_highlight",
      "video_explainer",
      "video_trailer",
      "audio",
      // Visual summaries / slides.
      "infographic",
      "infographic_image",
      "slide_deck",
      // Guides & written resources.
      "book_study_guide",
      "action_guide",
      "checklist",
      "key_takeaways",
      "discussion_questions",
      "worksheet",
      "email_sequence",
      // Short-form clips last so they never lead the kit.
      "video_short",
      "other",
    ];
    return [...resources].sort((a, b) => {
      const ai = order.indexOf(a.kind);
      const bi = order.indexOf(b.kind);
      if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return a.position - b.position;
    });
  }, [resources]);

  // Book Club "shorts" live in their own reel below the player, so they're
  // excluded from the big-player video list and the curriculum list.
  const videos = useMemo(
    () => orderedResources.filter((r) => isVideo(r.kind) && r.kind !== "video_short"),
    [orderedResources],
  );
  const downloads = useMemo(() => orderedResources.filter((r) => !isVideo(r.kind)), [orderedResources]);
  const curriculumResources = useMemo(
    () => orderedResources.filter((r) => r.kind !== "video_short"),
    [orderedResources],
  );

  // Derive the active resource. When the user hasn't picked anything explicitly
  // (activeId === null), fall back to the first playable video so the player
  // has something to show as soon as the kit loads.
  const fallbackActiveId = useMemo(() => {
    const firstVideo = videos.find((v) => v.external_url) ?? videos[0];
    return firstVideo?.id ?? null;
  }, [videos]);
  const effectiveActiveId = activeId ?? fallbackActiveId;
  const activeResource = useMemo(
    () => orderedResources.find((r) => r.id === effectiveActiveId) ?? null,
    [orderedResources, effectiveActiveId],
  );

  const topicTitle = resources[0]?.topic_title ?? "Kit";
  const topicSummary = resources[0]?.topic_summary ?? null;
  const isFree = resources.length > 0 && resources.every((r) => r.is_free);
  const viewedCount = resources.filter((r) => r.progress?.last_viewed_at).length;
  const progressPct = resources.length > 0 ? Math.round((viewedCount / resources.length) * 100) : 0;
  const kitType = resources[0]?.kit_type ?? "standard";
  const isBookClub = kitType === "book_club";
  // Pull the named principle shorts out of the resource list for the
  // dedicated reel render. They still show in the curriculum below.
  const shortResources = resources.filter((r) => r.kind === "video_short");

  // Mid-kit feedback prompt — fires once when the member crosses 50%
  // and we haven't already shown / submitted in this session.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackChecked = useRef(false);
  useEffect(() => {
    if (feedbackChecked.current) return;
    if (resources.length === 0) return;
    if (progressPct < 50) return;
    const slug = resources[0]?.topic_slug;
    if (!slug) return;
    // Already submitted or dismissed this session — skip.
    try {
      if (sessionStorage.getItem(`feedback_done:${slug}`) === "1") return;
      if (sessionStorage.getItem(`feedback_dismissed:${slug}`) === "1") return;
    } catch { /* private mode etc, proceed */ }
    feedbackChecked.current = true;
    // Confirm server-side that the feedback hasn't already been recorded
    // (different session, different device). Only pop if no row.
    (async () => {
      try {
        const res = await fetch(
          `/api/member/resources/feedback?topic_slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { submitted?: boolean };
        if (!body.submitted) setFeedbackOpen(true);
      } catch { /* best-effort */ }
    })();
  }, [progressPct, resources]);

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress size={22} sx={{ color: "var(--gold)" }} />
      </Stack>
    );
  }

  if (resources.length === 0) {
    return (
      <Stack spacing={2.5}>
        <BackLink />
        <Box
          sx={{
            py: 6,
            textAlign: "center",
            borderTop: "1px solid var(--paper-rule)",
            borderBottom: "1px solid var(--paper-rule)",
          }}
        >
          <Typography sx={{ ...editorialText.heading, mb: 0.5 }}>Kit not found</Typography>
          <Typography sx={editorialText.meta}>
            This kit isn&apos;t published yet, or the URL is wrong.
          </Typography>
        </Box>
      </Stack>
    );
  }

  const playLesson = (r: ResourceItem) => {
    setActiveId(r.id);
    void markProgress(r.id, "view");
    requestAnimationFrame(() => {
      if (videoRef.current) {
        videoRef.current.load();
        void videoRef.current.play().catch(() => {});
      }
    });
  };

  return (
    <Box sx={{ color: ink.primary }}>
      <BackLink />

      {/* Header — title + tags + progress meter (one balanced row) */}
      <Box sx={{ pb: 2.5, mb: 3, borderBottom: "1px solid var(--ink-rule)" }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { md: "flex-end" } }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap", rowGap: 0.5 }}>
              <Typography sx={editorialText.eyebrow}>
                {isBookClub ? "Book club kit" : "Kit"}
              </Typography>
              {isBookClub && (
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 18,
                    px: 0.85,
                    borderRadius: 0.5,
                    bgcolor: "rgba(110,51,70,0.12)",
                    color: "#6E3346",
                    fontSize: "0.58rem",
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Book Club
                </Box>
              )}
              {isFree && <InlineTag label="Free" tone="leaf" />}
            </Stack>
            <Typography component="h1" sx={editorialText.display}>
              {topicTitle}
            </Typography>
            {topicSummary && (
              <Typography sx={{ ...editorialText.body, mt: 1, maxWidth: 620 }}>
                {topicSummary}
              </Typography>
            )}
          </Box>
          <Box sx={{ flexShrink: 0, minWidth: 160 }}>
            <Typography sx={{ ...editorialText.eyebrow, mb: 0.75 }}>Your progress</Typography>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 140,
                  height: 3,
                  bgcolor: "var(--paper-rule)",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    height: "100%",
                    width: `${progressPct}%`,
                    bgcolor: "var(--leaf)",
                    transition: "width var(--dur-slow) var(--ease-out)",
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: ink.primary }}>
                {viewedCount}/{resources.length}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* PLAYER + CURRICULUM — Udemy-style balanced split */}
      <Grid container spacing={{ xs: 3, lg: 4 }}>
        {/* Player column */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box>
            <Box
              sx={{
                position: "relative",
                ...(activeResource &&
                isPreviewable(activeResource) &&
                activeResource.external_url
                  ? { height: { xs: 520, md: 720 } }
                  : { aspectRatio: "16 / 9" }),
                bgcolor: "var(--ink)",
                backgroundImage:
                  activeResource &&
                  (isVideo(activeResource.kind) || isPreviewable(activeResource))
                    ? "none"
                    : visual.gradient,
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                borderRadius: 1,
              }}
            >
              {activeResource && isVideo(activeResource.kind) && activeResource.external_url ? (
                <video
                  ref={videoRef}
                  src={activeResource.external_url}
                  controls
                  playsInline
                  onPlay={() => void markProgress(activeResource.id, "view")}
                  onEnded={() => void markProgress(activeResource.id, "complete")}
                  style={{ width: "100%", height: "100%", display: "block", background: "#000" }}
                />
              ) : activeResource && isImage(activeResource) && activeResource.external_url ? (
                <Box
                  component="img"
                  src={activeResource.external_url}
                  alt={activeResource.title}
                  onLoad={() => void markProgress(activeResource.id, "view")}
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    bgcolor: "#FFFFFF",
                  }}
                />
              ) : activeResource &&
                isPreviewable(activeResource) &&
                activeResource.external_url ? (
                <Box
                  component="iframe"
                  // key forces a remount when switching between previewable lessons,
                  // so the iframe loads the new URL even if React would otherwise reuse it.
                  key={activeResource.id}
                  src={previewSrc(activeResource, activeResource.external_url)}
                  title={activeResource.title}
                  onLoad={() => void markProgress(activeResource.id, "view")}
                  sx={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    bgcolor: "#FFFFFF",
                  }}
                />
              ) : (
                <Stack
                  spacing={1.5}
                  sx={{ alignItems: "center", color: "var(--paper)", textAlign: "center", px: 3 }}
                >
                  <TopicIcon sx={{ fontSize: 56, color: visual.iconColor, opacity: 0.95 }} />
                  <Typography
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.05rem",
                      color: "var(--paper)",
                      lineHeight: 1.2,
                    }}
                  >
                    {activeResource ? activeResource.title : "Pick a lesson to begin"}
                  </Typography>
                  {activeResource &&
                    !isVideo(activeResource.kind) &&
                    !isPreviewable(activeResource) && (
                      <>
                        <Typography
                          sx={{
                            fontSize: "0.78rem",
                            color: "rgba(255,255,255,0.7)",
                            maxWidth: 320,
                          }}
                        >
                          {activeResource.title.toLowerCase().includes("powerpoint") ||
                          activeResource.mime_type?.includes("presentation")
                            ? "This is the editable PowerPoint copy. Download it to customize the slides."
                            : "This file format can't be previewed inline. Download it to view."}
                        </Typography>
                        {activeResource.external_url && (
                          <Button
                            component="a"
                            href={activeResource.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="contained"
                            startIcon={<DownloadOutlinedIcon sx={{ fontSize: 17 }} />}
                            onClick={() => void markProgress(activeResource.id, "view")}
                            sx={{
                              mt: 1,
                              textTransform: "none",
                              fontWeight: 700,
                              borderRadius: 999,
                              bgcolor: "rgba(217,168,75,0.9)",
                              color: "#0A1A2F",
                              "&:hover": { bgcolor: "#F0C16E" },
                            }}
                          >
                            Download {activeResource.title}
                          </Button>
                        )}
                      </>
                    )}
                </Stack>
              )}
            </Box>

            {/* Active lesson meta + actions */}
            {activeResource && (
              <Box sx={{ pt: 2 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
                  <InlineTag
                    label={KIND_META[activeResource.kind]?.badge ?? "Item"}
                    tone="ink"
                  />
                  {activeResource.duration_label && (
                    <Typography sx={editorialText.meta}>{activeResource.duration_label}</Typography>
                  )}
                  {activeResource.progress?.completed_at && (
                    <Stack direction="row" spacing={0.4} sx={{ alignItems: "center" }}>
                      <CheckCircleRoundedIcon sx={{ fontSize: 14, color: "var(--leaf)" }} />
                      <Typography sx={{ fontSize: "0.7rem", color: "var(--leaf)", fontWeight: 700 }}>
                        Completed
                      </Typography>
                    </Stack>
                  )}
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 1.25, sm: 2 }}
                  sx={{ alignItems: { sm: "flex-start" }, justifyContent: "space-between" }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ ...editorialText.heading, mb: 0.5 }}>
                      {activeResource.title}
                    </Typography>
                    {activeResource.description && (
                      <Typography sx={editorialText.body}>{activeResource.description}</Typography>
                    )}
                  </Box>
                  {/* Action buttons — for any non-video item that has a URL */}
                  {!isVideo(activeResource.kind) && activeResource.external_url && (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ flexShrink: 0, flexWrap: "wrap", rowGap: 1 }}
                    >
                      {isPreviewable(activeResource) && (
                        <Button
                          component="a"
                          href={activeResource.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="outlined"
                          size="small"
                          disableElevation
                          startIcon={<OpenInNewOutlinedIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            borderColor: "var(--paper-rule)",
                            color: "var(--ink)",
                            textTransform: "none",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            borderRadius: 0.5,
                            px: 1.5,
                            py: 0.6,
                            "&:hover": {
                              borderColor: "var(--gold)",
                              bgcolor: "color-mix(in oklch, var(--gold) 6%, transparent)",
                            },
                            "&:focus-visible": {
                              outline: "2px solid var(--gold)",
                              outlineOffset: 2,
                            },
                          }}
                        >
                          Open in new tab
                        </Button>
                      )}
                      <Button
                        component="a"
                        href={activeResource.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        onClick={() => void markProgress(activeResource.id, "view")}
                        variant="contained"
                        size="small"
                        disableElevation
                        startIcon={<DownloadOutlinedIcon sx={{ fontSize: 14 }} />}
                        sx={{
                          bgcolor: "var(--ink)",
                          color: "var(--paper)",
                          textTransform: "none",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          borderRadius: 0.5,
                          px: 1.5,
                          py: 0.6,
                          "&:hover": {
                            bgcolor: "color-mix(in oklch, var(--ink) 90%, white)",
                          },
                          "&:focus-visible": {
                            outline: "2px solid var(--gold)",
                            outlineOffset: 2,
                          },
                        }}
                      >
                        Download
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Box>
            )}
          </Box>
        </Grid>

        {/* Curriculum column */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 0.5 }}>
              <Typography sx={editorialText.eyebrow}>Curriculum</Typography>
              <Box
                aria-hidden
                sx={{ flex: 1, height: "1px", bgcolor: "var(--paper-rule)" }}
              />
            </Stack>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 1.5 }}
            >
              <Typography sx={editorialText.heading}>
                {curriculumResources.length} {curriculumResources.length === 1 ? "item" : "items"}
              </Typography>
              <Typography sx={editorialText.meta}>
                {videos.length} video{videos.length === 1 ? "" : "s"} · {downloads.length} file
                {downloads.length === 1 ? "" : "s"}
              </Typography>
            </Stack>

            <Box>
              {curriculumResources.map((r, idx) => (
                <CurriculumRow
                  key={r.id}
                  index={idx + 1}
                  resource={r}
                  active={r.id === effectiveActiveId}
                  onSelect={() => {
                    if (isVideo(r.kind) && r.external_url) {
                      playLesson(r);
                    } else if (r.external_url && !isPreviewable(r)) {
                      // Non-previewable file (e.g. the editable .pptx slide
                      // deck) — download it directly instead of parking the
                      // player on a "can't preview" dead end.
                      void markProgress(r.id, "view");
                      window.open(r.external_url, "_blank", "noopener,noreferrer");
                    } else if (r.external_url) {
                      setActiveId(r.id);
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Key Principles reel — any kit that ships 9×16 shorts (Book Club
          AND expert kits). Compact horizontal strip; each short plays
          inline in its own card (not the big player). */}
      {shortResources.length > 0 && (
        <Box sx={{ mb: 3.5 }}>
          <Box sx={{ mb: 1.25 }}>
            <Typography sx={{ ...editorialText.eyebrow, color: "#6E3346" }}>
              Key principles
            </Typography>
            <Typography
              sx={{
                fontFamily: "var(--font-display)",
                fontSize: { xs: "1.05rem", md: "1.2rem" },
                fontWeight: 500,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                mt: 0.25,
              }}
            >
              {shortResources.length} quick ideas from {isBookClub ? "the book" : "this kit"}
            </Typography>
          </Box>
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              overflowX: "auto",
              pb: 1,
              scrollbarWidth: "thin",
              "&::-webkit-scrollbar": { height: 6 },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(110,51,70,0.25)",
                borderRadius: 3,
              },
            }}
          >
            {shortResources.map((s, i) => {
              const playing = activeShortId === s.id && !!s.external_url;
              const open = () => {
                if (!playing && s.external_url) {
                  setActiveShortId(s.id);
                  void markProgress(s.id, "view");
                }
              };
              return (
                <Box key={s.id} sx={{ flex: "0 0 auto", width: { xs: 168, sm: 196, md: 216 } }}>
                  <Box
                    role={playing ? undefined : "button"}
                    tabIndex={playing ? -1 : 0}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (!playing && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        open();
                      }
                    }}
                    sx={{
                      position: "relative",
                      aspectRatio: "9 / 16",
                      borderRadius: 1.5,
                      overflow: "hidden",
                      cursor: playing ? "default" : "pointer",
                      bgcolor: "#0A1A2F",
                      backgroundImage: playing
                        ? "none"
                        : "linear-gradient(160deg, #14334A 0%, #0A2236 100%)",
                      border: "1px solid var(--paper-rule)",
                      transition: "transform 180ms ease, border-color 180ms ease",
                      "&:hover": playing
                        ? {}
                        : { transform: "translateY(-2px)", borderColor: "#6E3346" },
                      "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 2 },
                    }}
                  >
                    {playing ? (
                      <video
                        src={s.external_url ?? undefined}
                        controls
                        autoPlay
                        playsInline
                        onPlay={() => void markProgress(s.id, "view")}
                        onEnded={() => void markProgress(s.id, "complete")}
                        style={{
                          width: "100%",
                          height: "100%",
                          // "contain", never "cover": the element keeps its
                          // CSS in native fullscreen, and cover would crop a
                          // 9:16 short in half on a 16:9 screen when the
                          // member hits the make-larger control.
                          objectFit: "contain",
                          background: "#000",
                          display: "block",
                        }}
                      />
                    ) : (
                      <>
                        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: "50%",
                              bgcolor: "rgba(217,168,75,0.9)",
                              color: "#0A1A2F",
                              display: "grid",
                              placeItems: "center",
                              boxShadow: "0 8px 20px -8px rgba(217,168,75,0.6)",
                            }}
                          >
                            <PlayArrowRoundedIcon sx={{ fontSize: 28 }} />
                          </Box>
                        </Box>
                        <Typography
                          sx={{
                            position: "absolute",
                            top: 8,
                            left: 10,
                            fontSize: "0.62rem",
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            color: "#F0C16E",
                            textTransform: "uppercase",
                          }}
                        >
                          {i + 1}
                        </Typography>
                        {s.progress?.completed_at && (
                          <Box
                            sx={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              height: 17,
                              px: 0.75,
                              borderRadius: 0.5,
                              bgcolor: "rgba(34,108,78,0.9)",
                              color: "#FFFFFF",
                              fontSize: "0.56rem",
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            Done
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      color: "var(--ink)",
                      lineHeight: 1.25,
                      mt: 0.75,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {s.title}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Discussion thread — collapsed by default. Anchored to the kit's
          primary (first) resource so all questions about this kit roll
          up to one thread. The originating expert (resources.originating_
          expert_id) is notified on every new inquiry and reply. */}
      {resources[0] && (
        <ResourceInquiries
          resourceId={resources[0].id}
          resourceTitle={topicTitle}
        />
      )}

      {/* 1-on-1 coaching booking — every kit page surfaces this. Rendered
          only once the kit's expert is RESOLVED (undefined = still
          loading), so the card never shows a default face and swaps. */}
      {kitExpert !== undefined && (
        <Box sx={{ mt: { xs: 4, lg: 5 } }}>
          <BookCoachingCard topicTitle={topicTitle} expert={kitExpert} />
        </Box>
      )}

      {/* Mid-kit feedback — fires once at 50% (see effect above). */}
      <FeedbackDialog
        open={feedbackOpen}
        topicSlug={resources[0]?.topic_slug ?? ""}
        topicTitle={topicTitle}
        progressPct={progressPct}
        onClose={() => setFeedbackOpen(false)}
      />
    </Box>
  );
}

function BackLink() {
  return (
    <Box
      component={Link}
      href="/dashboard/resources"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        mb: 2,
        fontSize: "0.74rem",
        letterSpacing: "0.06em",
        color: ink.fade,
        textDecoration: "none",
        transition: "color var(--dur-fast) var(--ease-out)",
        "&:hover": { color: ink.primary },
        "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 2 },
      }}
    >
      <ArrowBackIcon sx={{ fontSize: 13 }} /> All kits
    </Box>
  );
}

function CurriculumRow({
  index,
  resource,
  active,
  onSelect,
}: {
  index: number;
  resource: ResourceItem;
  active: boolean;
  onSelect: () => void;
}) {
  const k = KIND_META[resource.kind] ?? KIND_META.other;
  const Icon = k.icon;
  const isVid = isVideo(resource.kind);
  const completed = !!resource.progress?.completed_at;
  const viewed = !!resource.progress?.last_viewed_at;
  const hasUrl = !!resource.external_url;

  return (
    <Box
      role="button"
      tabIndex={hasUrl ? 0 : -1}
      onClick={hasUrl ? onSelect : undefined}
      onKeyDown={(e) => {
        if (hasUrl && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        py: 1.25,
        px: active ? 1.25 : 0.25,
        cursor: hasUrl ? "pointer" : "default",
        bgcolor: active ? "color-mix(in oklch, var(--gold) 8%, transparent)" : "transparent",
        borderBottom: "1px solid var(--paper-rule)",
        borderLeft: active ? "2px solid var(--gold)" : "2px solid transparent",
        transition:
          "background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
        "&:hover": hasUrl
          ? {
              bgcolor: active
                ? "color-mix(in oklch, var(--gold) 12%, transparent)"
                : "color-mix(in oklch, var(--ink) 4%, transparent)",
            }
          : {},
        "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: -2 },
      }}
    >
      <Box
        sx={{
          minWidth: 22,
          height: 22,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          bgcolor: completed
            ? "var(--leaf)"
            : active
              ? "var(--ink)"
              : "color-mix(in oklch, var(--ink) 8%, transparent)",
          color: completed || active ? "var(--paper)" : ink.fade,
          fontSize: "0.66rem",
          fontWeight: 700,
        }}
      >
        {completed ? <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> : index}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.25 }}>
          <Icon sx={{ fontSize: 11, color: ink.fade }} />
          <Typography
            sx={{
              fontSize: "0.58rem",
              fontWeight: 700,
              color: ink.fade,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {k.badge}
          </Typography>
          {resource.duration_label && (
            <Typography sx={{ fontSize: "0.66rem", color: ink.fade }}>
              · {resource.duration_label}
            </Typography>
          )}
        </Stack>
        <Typography
          sx={{
            fontSize: "0.84rem",
            fontWeight: active ? 700 : 500,
            color: ink.primary,
            lineHeight: 1.3,
          }}
        >
          {resource.title}
        </Typography>
      </Box>
      {isVid ? (
        <PlayArrowRoundedIcon
          sx={{ fontSize: 16, color: active ? "var(--gold-deep)" : ink.fade, mt: 0.25 }}
        />
      ) : (
        <DownloadOutlinedIcon
          sx={{ fontSize: 13, color: viewed ? "var(--leaf)" : ink.fade, mt: 0.4 }}
        />
      )}
    </Box>
  );
}

