"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { keyframes } from "@mui/system";
import type { SvgIconComponent } from "@mui/icons-material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";
import { useCurrentMember } from "@/lib/hooks/useCurrentMember";
import { KitCover } from "@/components/member/KitCover";
import { type Spotlight } from "@/components/member/SpotlightSection";
import {
  EditorialSection,
  MetricStrip,
  editorialText,
  ink,
} from "@/components/member/Editorial";

// Cinematic motion for the billboard-style dashboard: sections cascade in
// with a small stagger, and the hero backdrop drifts in a slow Ken Burns
// zoom. Both are disabled under prefers-reduced-motion.
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const kenBurns = keyframes`
  from { transform: scale(1.08); }
  to   { transform: scale(1.22); }
`;
// Spotlight showcase motion: twinkling gold sparkles and a shimmer sweep
// gliding across the dark card.
const twinkle = keyframes`
  0%, 100% { opacity: 0.15; transform: scale(0.75) rotate(0deg); }
  50%      { opacity: 0.95; transform: scale(1.2) rotate(18deg); }
`;
const shimmer = keyframes`
  from { transform: translateX(-130%) skewX(-12deg); }
  to   { transform: translateX(340%) skewX(-12deg); }
`;

type ResourceItem = {
  id: string;
  topic_slug: string;
  topic_title: string;
  topic_summary: string | null;
  category: string | null;
  portal_card_url: string | null;
  resource_card_url: string | null;
  title: string;
  kind: string;
  is_free: boolean;
  progress: { last_viewed_at: string | null; completed_at: string | null } | null;
};

type TopicCard = {
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  portalCardUrl: string | null;
  resourceCount: number;
  videoCount: number;
  viewedCount: number;
  completedCount: number;
  isFree: boolean;
  lastViewedAt: string | null;
};

function formatJoined(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  } catch {
    return iso.slice(0, 10);
  }
}

export default function DashboardHome() {
  const { member, viewedCount, loading } = useCurrentMember();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [accessRanks, setAccessRanks] = useState<Map<string, number> | null>(null);

  // Network-wide access counts per kit — makes the Top 5 rail rank by what
  // members ACTUALLY open once real usage exists (empty map until then).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/member/top-kits", { cache: "no-store" });
        if (!active || !res.ok) return;
        const body = (await res.json()) as { ranks?: { slug: string; views: number }[] };
        if (active) setAccessRanks(new Map((body.ranks ?? []).map((r) => [r.slug, r.views])));
      } catch {
        /* fall back to content-based ordering */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Network-wide spotlights (offers, events, news from experts + partners)
  // for the animated "What's new" carousel. Section hides when empty.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/member/spotlights", { cache: "no-store" });
        if (!active || !res.ok) return;
        const body = (await res.json()) as { spotlights?: Spotlight[] };
        if (active) setSpotlights(body.spotlights ?? []);
      } catch {
        /* carousel simply doesn't render */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/member/resources", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setResources([]);
          return;
        }
        const body = (await res.json()) as { resources: ResourceItem[] };
        if (!active) return;
        setResources(body.resources ?? []);
      } finally {
        if (active) setResourcesLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const topics: TopicCard[] = useMemo(() => {
    const map = new Map<string, TopicCard>();
    for (const r of resources) {
      const isVideo = r.kind.startsWith("video_") || r.kind === "audio";
      const existing = map.get(r.topic_slug);
      const viewed = !!r.progress?.last_viewed_at;
      const completed = !!r.progress?.completed_at;
      const lastViewed = r.progress?.last_viewed_at ?? null;
      if (existing) {
        existing.resourceCount += 1;
        if (isVideo) existing.videoCount += 1;
        if (viewed) existing.viewedCount += 1;
        if (completed) existing.completedCount += 1;
        if (!r.is_free) existing.isFree = false;
        if (lastViewed && (!existing.lastViewedAt || lastViewed > existing.lastViewedAt)) {
          existing.lastViewedAt = lastViewed;
        }
      } else {
        map.set(r.topic_slug, {
          slug: r.topic_slug,
          title: r.topic_title,
          summary: r.topic_summary,
          category: r.category,
          portalCardUrl: r.portal_card_url,
          resourceCount: 1,
          videoCount: isVideo ? 1 : 0,
          viewedCount: viewed ? 1 : 0,
          completedCount: completed ? 1 : 0,
          isFree: r.is_free,
          lastViewedAt: lastViewed,
        });
      }
    }
    return Array.from(map.values());
  }, [resources]);

  const completedKits = topics.filter((t) => t.completedCount === t.resourceCount && t.resourceCount > 0).length;
  const startedKits = topics.filter((t) => t.viewedCount > 0).length;
  // The single most-recently-touched kit that isn't already finished. This
  // powers the "Pick up where you left off" hero card so the next click is
  // never more than one tap away.
  const continueKit =
    topics
      .filter(
        (t) =>
          t.lastViewedAt &&
          !(t.completedCount === t.resourceCount && t.resourceCount > 0),
      )
      .sort((a, b) => (a.lastViewedAt! < b.lastViewedAt! ? 1 : -1))[0] ?? null;

  // "Top 5" rail — ranked by real network-wide access counts as soon as
  // members start opening resources (via /api/member/top-kits). Kits with
  // no views yet tie at zero and fall back to the content-based ordering
  // (most videos, then most resources), so the rail is meaningful from
  // day one and becomes truly dynamic on its own.
  const topFive = [...topics]
    .sort((a, b) => {
      const av = accessRanks?.get(a.slug) ?? 0;
      const bv = accessRanks?.get(b.slug) ?? 0;
      if (av !== bv) return bv - av;
      return b.videoCount - a.videoCount || b.resourceCount - a.resourceCount || a.title.localeCompare(b.title);
    })
    .slice(0, 5);

  // The kit the billboard hero features: the in-progress kit if there is
  // one, otherwise the richest kit so brand-new members still get artwork.
  const heroKit = continueKit ?? topFive[0] ?? topics[0] ?? null;

  // ONE actionable kit below the hero — the most recently opened kit that
  // isn't already the hero, else the best free starter. A single wide card
  // instead of a wall of tiles keeps the page breathable.
  const spotKit =
    [...topics]
      .filter((t) => t.slug !== heroKit?.slug)
      .sort((a, b) => {
        const av = a.lastViewedAt ?? "";
        const bv = b.lastViewedAt ?? "";
        if (av !== bv) return av < bv ? 1 : -1;
        if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
        return b.videoCount - a.videoCount;
      })[0] ?? null;

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress size={22} sx={{ color: "var(--gold)" }} />
      </Stack>
    );
  }

  const firstName = member?.first_name ?? "there";
  const memberSince = formatJoined(member?.joined_at ?? member?.activated_at ?? null);

  return (
    <Box sx={{ color: ink.primary }}>
      {/* Billboard hero — cinematic Netflix-style opener. Features the
          in-progress kit (or the richest kit for brand-new members) over a
          blurred, slowly-drifting blowup of its own artwork. */}
      <Reveal>
        <BillboardHero
          firstName={firstName}
          tierLabel={member?.tier === "founding" ? "Founding cohort" : "Member"}
          topic={heroKit}
          resuming={!!continueKit}
          standfirst={
            viewedCount === 0
              ? "Your founding-member library is open. Pick a kit and start with the training video, then work through the guide and templates at your own pace."
              : startedKits === topics.length
                ? "You have started every kit. Completed kits earn a check mark and stay in your library."
                : `You have opened ${startedKits} of ${topics.length} kits. Keep momentum: pick up where you left off, or start something new.`
          }
        />
      </Reveal>

      {/* Metric strip — replaces 4-card grid */}
      <Reveal delay={110}>
        <Box sx={{ my: 3 }}>
          <MetricStrip
            items={[
              {
                label: "Kits available",
                value: String(topics.length),
                meta: topics.length === 1 ? "in your library" : "available to you",
              },
              {
                label: "Resources viewed",
                value: String(viewedCount),
                meta: `${startedKits}/${topics.length} kits started`,
              },
              {
                label: "Kits completed",
                value: String(completedKits),
                meta: `${Math.max(topics.length - completedKits, 0)} to go`,
              },
              {
                label: "Member since",
                value: memberSince,
                meta: member?.tier === "founding" ? "Founding cohort" : "Member",
              },
            ]}
          />
        </Box>
      </Reveal>

      {/* One kit to act on — a single wide card (most recent, or the best
          free starter) instead of a rail of tiles, so the page breathes. */}
      <Reveal delay={200}>
      <EditorialSection
        eyebrow={spotKit?.lastViewedAt ? "Continue watching" : "Begin"}
        title={spotKit?.lastViewedAt ? "Your most recent kit" : "Start with this kit"}
        actions={<SeeAllLink href="/dashboard/resources" label="All kits" />}
      >
        {resourcesLoading ? (
          <Stack sx={{ alignItems: "center", py: 4 }}>
            <CircularProgress size={20} sx={{ color: "var(--gold)" }} />
          </Stack>
        ) : topics.length === 0 ? (
          <EmptyState />
        ) : spotKit ? (
          <RecentKitCard topic={spotKit} />
        ) : null}
      </EditorialSection>
      </Reveal>

      {/* Spotlight — network-wide news, events & offers on a dark gold
          showcase card with twinkling sparkles and a shimmer sweep. */}
      {spotlights.length > 0 && (
        <Reveal delay={270}>
          <EditorialSection
            eyebrow="Spotlight"
            title="What's new in the network"
            actions={<SeeAllLink href="/dashboard/partners" label="All partners" />}
          >
            <SpotlightShowcase spotlights={spotlights} />
          </EditorialSection>
        </Reveal>
      )}

      {/* Top 5 — ranked rail with the big Netflix-style numerals. */}
      {!resourcesLoading && topics.length >= 3 && (
        <Reveal delay={340}>
        <EditorialSection
          eyebrow="Trending"
          title="Top 5 in the network"
          actions={<SeeAllLink href="/dashboard/resources" label="All kits" />}
        >
          <KitRail>
            {topFive.map((t, i) => (
              <Stack
                key={t.slug}
                direction="row"
                sx={{ alignItems: "flex-end", flexShrink: 0, scrollSnapAlign: "start" }}
              >
                <Typography
                  aria-hidden
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: { xs: "6.5rem", sm: "8.5rem" },
                    fontWeight: 800,
                    lineHeight: 0.78,
                    // Solid gold-gradient fill (light top → deep base) with
                    // a thin edge and soft shadow so the numeral pops off
                    // the paper background instead of reading as an outline.
                    background: "linear-gradient(180deg, #F0C16E 0%, #D9A84B 45%, #A07823 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                    WebkitTextStroke: "1px rgba(122,91,18,0.35)",
                    filter: "drop-shadow(0 6px 14px rgba(160,120,35,0.35))",
                    mr: -2.25,
                    mb: 3.5,
                    zIndex: 1,
                    userSelect: "none",
                  }}
                >
                  {i + 1}
                </Typography>
                <Box sx={{ minWidth: { xs: 150, sm: 176 }, maxWidth: { xs: 150, sm: 176 }, position: "relative", zIndex: 2 }}>
                  <DashboardKitTile topic={t} />
                </Box>
              </Stack>
            ))}
          </KitRail>
        </EditorialSection>
        </Reveal>
      )}

      {/* Documents */}
      <Reveal delay={410}>
      <EditorialSection
        eyebrow="Reference"
        title="Agreements & policies"
        standfirst="What you signed, plus the policies that govern your membership."
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            borderTop: "1px solid var(--paper-rule)",
            borderBottom: "1px solid var(--paper-rule)",
          }}
        >
          <DocLink
            href="/agreement/member"
            icon={GavelOutlinedIcon}
            label="Member agreement"
            meta="What you signed at signup"
          />
          <DocLink
            href="/legal/refund"
            icon={RuleFolderOutlinedIcon}
            label="Refund & cancellation"
            meta="30-day money-back guarantee"
            borderLeft
          />
          <DocLink
            href="/legal/privacy"
            icon={PolicyOutlinedIcon}
            label="Privacy policy"
            meta="What we do with your data"
            borderLeft
          />
        </Box>
      </EditorialSection>
      </Reveal>

      {/* Help */}
      <Reveal delay={480}>
      <EditorialSection eyebrow="Support" title="Need a hand?" rule={false}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Typography sx={{ ...editorialText.body, maxWidth: 560 }}>
            Can&apos;t find what you&apos;re looking for, or have feedback on a kit? We read every email and usually reply within a business day.
          </Typography>
          <Box
            component="a"
            href="mailto:members@aestheticsuccessnetwork.com"
            sx={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "var(--gold-deep)",
              textDecoration: "none",
              borderBottom: "1px solid color-mix(in oklch, var(--gold) 40%, transparent)",
              pb: "1px",
              transition: "color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
              "&:hover": { color: "var(--ink)", borderBottomColor: "var(--ink)" },
            }}
          >
            members@aestheticsuccessnetwork.com →
          </Box>
        </Stack>
      </EditorialSection>
      </Reveal>
    </Box>
  );
}

/* --- removed: SubscriptionGate, ProcessingBanner, CheckoutCanceledNote ---
 * The /upgrade page now owns the paywall + post-Stripe processing flow.
 * Middleware guarantees only paid members reach /dashboard.
 */


function SeeAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        fontSize: "0.74rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--gold-deep)",
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        transition: "color var(--dur-fast) var(--ease-out)",
        "&:hover": { color: "var(--ink)" },
      }}
    >
      {label} <ArrowForwardIcon sx={{ fontSize: 12 }} />
    </Box>
  );
}

function EmptyState() {
  return (
    <Box
      sx={{
        py: 6,
        textAlign: "center",
        borderTop: "1px solid var(--paper-rule)",
        borderBottom: "1px solid var(--paper-rule)",
      }}
    >
      <Typography sx={{ ...editorialText.heading, mb: 0.5 }}>
        No kits published yet
      </Typography>
      <Typography sx={editorialText.meta}>
        Kits will appear here as soon as the ASN content team adds them.
      </Typography>
    </Box>
  );
}

function DocLink({
  href,
  icon: Icon,
  label,
  meta,
  borderLeft,
}: {
  href: string;
  icon: SvgIconComponent;
  label: string;
  meta: string;
  borderLeft?: boolean;
}) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        px: { xs: 1.5, md: 2.25 },
        py: 2,
        textDecoration: "none",
        color: "inherit",
        borderLeft: { md: borderLeft ? "1px solid var(--paper-rule)" : "none" },
        borderTop: {
          xs: borderLeft ? "1px solid var(--paper-rule)" : "none",
          md: "none",
        },
        transition: "background-color var(--dur-fast) var(--ease-out)",
        "&:hover": { bgcolor: "color-mix(in oklch, var(--gold) 6%, transparent)" },
        "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: -2 },
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 0.75,
          bgcolor: "color-mix(in oklch, var(--gold) 12%, transparent)",
          color: "var(--gold-deep)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 16 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontSize: "0.84rem", fontWeight: 600, color: ink.primary, lineHeight: 1.3, mb: 0.25 }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontSize: "0.72rem", color: ink.fade, lineHeight: 1.4 }}>
          {meta}
        </Typography>
      </Box>
      <ArrowForwardIcon sx={{ fontSize: 13, color: ink.fade, mt: 0.5, flexShrink: 0 }} />
    </Box>
  );
}

/** Netflix-style horizontal scroll rail: snap scrolling, hidden scrollbar,
 *  hover-zoom on the tiles inside, and chevron arrows that appear when the
 *  rail is hovered (always reachable by keyboard focus). */
function KitRail({ children }: { children: React.ReactNode }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const nudge = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: "smooth" });
  };
  const arrowSx = {
    position: "absolute",
    top: "38%",
    zIndex: 4,
    width: 36,
    height: 36,
    bgcolor: "#FFFFFF",
    border: "1px solid var(--paper-rule, rgba(14,42,61,0.12))",
    color: "var(--ink, #0A1A2F)",
    boxShadow: "0 8px 20px -8px rgba(10,26,47,0.35)",
    opacity: 0,
    transition: "opacity 200ms ease, border-color 200ms ease, color 200ms ease",
    "&:hover": { bgcolor: "#FFFFFF", borderColor: "var(--gold)", color: "var(--gold-deep)" },
    "&:focus-visible": { opacity: 1, outline: "2px solid var(--gold)", outlineOffset: 2 },
  } as const;
  return (
    <Box sx={{ position: "relative", "&:hover .rail-arrow": { opacity: 1 } }}>
      <Box
        ref={railRef}
        sx={{
          display: "flex",
          gap: { xs: 1.75, sm: 2.25 },
          overflowX: "auto",
          // Headroom above + around the tiles so the hover zoom never clips
          // against the scroll container's edges.
          pt: 1,
          mt: -1,
          pb: 1.5,
          px: 1,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          // No visible scrollbar — the hover arrows page the rail on
          // desktop and touch swipes handle it on mobile.
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
      >
        {children}
      </Box>
      <IconButton
        className="rail-arrow"
        aria-label="Scroll left"
        onClick={() => nudge(-1)}
        sx={{ ...arrowSx, left: -10 }}
      >
        <ChevronLeftRoundedIcon />
      </IconButton>
      <IconButton
        className="rail-arrow"
        aria-label="Scroll right"
        onClick={() => nudge(1)}
        sx={{ ...arrowSx, right: -10 }}
      >
        <ChevronRightRoundedIcon />
      </IconButton>
    </Box>
  );
}

function DashboardKitTile({ topic }: { topic: TopicCard }) {
  const progressPct =
    topic.resourceCount > 0
      ? Math.round((topic.viewedCount / topic.resourceCount) * 100)
      : 0;
  const completed = topic.completedCount === topic.resourceCount && topic.resourceCount > 0;
  const inProgress = topic.viewedCount > 0 && topic.viewedCount < topic.resourceCount;

  return (
    <Box
      component={Link}
      href={`/dashboard/resources/${topic.slug}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        position: "relative",
        transition: "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        "&:hover": { transform: "translateY(-4px) scale(1.04)", zIndex: 2 },
        "&:hover .tile-cover": {
          boxShadow: "0 18px 44px -18px rgba(10,26,47,0.55)",
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover": { transform: "none" },
        },
        "&:focus-visible": {
          outline: "2px solid var(--gold)",
          outlineOffset: 4,
          borderRadius: "4px",
        },
      }}
    >
      <Box
        className="tile-cover"
        sx={{ mb: 1.25, borderRadius: 1, transition: "box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <KitCover
          slug={topic.slug}
          title={topic.title}
          videoCount={topic.videoCount}
          resourceCount={topic.resourceCount}
          isFree={topic.isFree}
          completed={completed}
          inProgress={inProgress}
          progressPct={progressPct}
          portalCardUrl={topic.portalCardUrl}
        />
      </Box>
      <Box sx={{ mt: "auto" }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: completed ? "var(--leaf, #1F5C40)" : inProgress ? "var(--gold-deep)" : "var(--ink-fade)",
            }}
          >
            {completed ? "Complete" : inProgress ? `${progressPct}% complete` : "Not started"}
          </Typography>
          <Typography sx={{ ...editorialText.meta, fontSize: "0.7rem" }}>
            {topic.viewedCount}/{topic.resourceCount}
          </Typography>
        </Stack>
        <Box sx={{ height: 5, borderRadius: 999, bgcolor: "rgba(14,42,61,0.08)", overflow: "hidden" }}>
          <Box
            sx={{
              height: "100%",
              width: `${progressPct}%`,
              borderRadius: 999,
              bgcolor: completed ? "var(--leaf, #1F5C40)" : "var(--gold-deep, #A07823)",
              transition: "width 240ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

const SPOTLIGHT_KIND_LABEL: Record<Spotlight["kind"], string> = {
  feature: "Member offer",
  event: "Event",
  news: "News",
  update: "Update",
};

// Sparkle field for the showcase — fixed positions so render is stable,
// varied sizes/delays so the twinkle feels organic.
const SPARKLES = [
  { top: "14%", left: "6%", size: 14, delay: "0s" },
  { top: "68%", left: "12%", size: 10, delay: "1.1s" },
  { top: "22%", left: "88%", size: 18, delay: "0.5s" },
  { top: "74%", left: "80%", size: 12, delay: "1.7s" },
  { top: "10%", left: "55%", size: 10, delay: "2.2s" },
  { top: "60%", left: "45%", size: 8, delay: "0.8s" },
];

/** Dashboard-only spotlight showcase — a dark navy/gold billboard strip
 *  with twinkling sparkles and a shimmer sweep. One spotlight at a time,
 *  auto-rotating, with clickable dots. Distinct from the profile-page
 *  SpotlightSection carousel on purpose. */
function SpotlightShowcase({ spotlights }: { spotlights: Spotlight[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = spotlights.length;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % count), 4000);
    return () => window.clearInterval(id);
  }, [count, paused]);

  const go = (dir: 1 | -1) => setIdx((i) => (((i + dir) % count) + count) % count);

  const s = spotlights[idx % count]!;
  const dateLabel = s.event_date
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(s.event_date))
    : null;

  return (
    <Box
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={{
        position: "relative",
        borderRadius: 2.5,
        overflow: "hidden",
        isolation: "isolate",
        border: "1px solid rgba(217,168,75,0.4)",
        background: "linear-gradient(120deg, #0A1A2F 0%, #122A45 55%, #0A1A2F 100%)",
        color: "#FFFFFF",
        boxShadow: "0 20px 48px -28px rgba(10,26,47,0.6)",
      }}
    >
      {/* Gold glow + twinkling sparkles + shimmer sweep */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background:
            "radial-gradient(70% 90% at 88% 12%, rgba(217,168,75,0.24) 0%, transparent 55%), radial-gradient(50% 70% at 8% 90%, rgba(217,168,75,0.12) 0%, transparent 60%)",
        }}
      />
      {SPARKLES.map((sp, i) => (
        <AutoAwesomeRoundedIcon
          key={i}
          aria-hidden
          sx={{
            position: "absolute",
            top: sp.top,
            left: sp.left,
            fontSize: sp.size,
            color: "#F0C16E",
            zIndex: 0,
            opacity: 0.2,
            animation: `${twinkle} 2.8s ease-in-out infinite`,
            animationDelay: sp.delay,
            "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0.35 },
            pointerEvents: "none",
          }}
        />
      ))}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "34%",
          zIndex: 0,
          background:
            "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.05) 42%, rgba(217,168,75,0.14) 52%, transparent 65%)",
          animation: `${shimmer} 5.5s linear infinite`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          pointerEvents: "none",
        }}
      />

      {/* Rotating content — remounts per spotlight so it fades up in */}
      <Box
        key={s.id}
        sx={{
          position: "relative",
          zIndex: 1,
          py: { xs: 2.5, sm: 3 },
          // Extra horizontal room so the edge arrows never sit on the text.
          px: { xs: 2.5, sm: 5.5 },
          minHeight: 148,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { sm: "center" },
          gap: { xs: 1.75, sm: 3 },
          animation: `${fadeUp} 480ms cubic-bezier(0.16, 1, 0.3, 1) both`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap", gap: 0.75 }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                py: 0.3,
                borderRadius: 999,
                bgcolor: "rgba(217,168,75,0.16)",
                border: "1px solid rgba(217,168,75,0.45)",
                color: "#F0C16E",
                fontSize: "0.6rem",
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 11 }} />
              {SPOTLIGHT_KIND_LABEL[s.kind]}
            </Box>
            {dateLabel && (
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>
                {dateLabel}
              </Typography>
            )}
          </Stack>
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.15rem", md: "1.35rem" },
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              color: "#FFFFFF",
              mb: 0.5,
            }}
          >
            {s.title}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.84rem",
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.75)",
              maxWidth: 620,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {s.body}
          </Typography>
        </Box>
        {s.link_url && (
          <Button
            component="a"
            href={s.link_url}
            target="_blank"
            rel="noopener noreferrer"
            disableElevation
            sx={{
              bgcolor: "var(--gold, #D9A84B)",
              "&&": { color: "var(--ink, #0A1A2F)" },
              textTransform: "none",
              fontSize: "0.82rem",
              fontWeight: 800,
              borderRadius: 999,
              px: 2.25,
              py: 0.8,
              flexShrink: 0,
              alignSelf: { xs: "flex-start", sm: "center" },
              whiteSpace: "nowrap",
              transition: "background-color 200ms ease, transform 200ms ease",
              "&:hover": { bgcolor: "#E5BA63", transform: "translateY(-1px)" },
              "&:focus-visible": { outline: "2px solid #FFFFFF", outlineOffset: 2 },
            }}
          >
            {s.link_label ?? "Learn more"}
          </Button>
        )}
      </Box>

      {/* Small edge arrows — manual prev/next */}
      {count > 1 &&
        ([
          { dir: -1 as const, side: { left: 8 }, Icon: ChevronLeftRoundedIcon, label: "Previous spotlight" },
          { dir: 1 as const, side: { right: 8 }, Icon: ChevronRightRoundedIcon, label: "Next spotlight" },
        ].map(({ dir, side, Icon, label }) => (
          <IconButton
            key={label}
            aria-label={label}
            onClick={() => go(dir)}
            size="small"
            sx={{
              position: "absolute",
              ...side,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              width: 28,
              height: 28,
              color: "#FFFFFF",
              bgcolor: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.25)",
              opacity: 0.75,
              transition: "opacity 180ms ease, background-color 180ms ease, border-color 180ms ease",
              "&:hover": { opacity: 1, bgcolor: "rgba(217,168,75,0.25)", borderColor: "var(--gold)" },
              "&:focus-visible": { opacity: 1, outline: "2px solid var(--gold)", outlineOffset: 2 },
            }}
          >
            <Icon sx={{ fontSize: 18 }} />
          </IconButton>
        )))}

      {/* Dots */}
      {count > 1 && (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ position: "relative", zIndex: 1, justifyContent: "center", pb: 1.5, mt: -0.5 }}
        >
          {spotlights.map((sp, i) => (
            <Box
              key={sp.id}
              component="button"
              type="button"
              aria-label={`Show spotlight ${i + 1}`}
              onClick={() => setIdx(i)}
              sx={{
                all: "unset",
                cursor: "pointer",
                width: i === idx % count ? 18 : 6,
                height: 6,
                borderRadius: 999,
                bgcolor: i === idx % count ? "var(--gold, #D9A84B)" : "rgba(255,255,255,0.3)",
                transition: "width 240ms ease, background-color 240ms ease",
                "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 2 },
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

/** One wide, editorial card for a single kit — the most recently opened
 *  kit (with progress) or a recommended free starter. Replaces the old
 *  rail of tiles below the hero. */
function RecentKitCard({ topic }: { topic: TopicCard }) {
  const started = !!topic.lastViewedAt;
  const progressPct =
    topic.resourceCount > 0
      ? Math.round((topic.viewedCount / topic.resourceCount) * 100)
      : 0;
  return (
    <Box
      component={Link}
      href={`/dashboard/resources/${topic.slug}`}
      sx={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        maxWidth: 720,
        borderRadius: 2,
        border: "1px solid var(--paper-rule, rgba(14,42,61,0.08))",
        bgcolor: "#FFFFFF",
        overflow: "hidden",
        transition: "transform 280ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 280ms cubic-bezier(0.16, 1, 0.3, 1)",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0 20px 44px -24px rgba(14,42,61,0.45)",
        },
        "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 3 },
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 2, sm: 2.5 }}
        sx={{ p: { xs: 2, sm: 2.5 }, alignItems: { sm: "center" } }}
      >
        <Box sx={{ width: { xs: "100%", sm: 118 }, flexShrink: 0 }}>
          <KitCover
            slug={topic.slug}
            title={topic.title}
            videoCount={topic.videoCount}
            resourceCount={topic.resourceCount}
            isFree={topic.isFree}
            inProgress={started}
            progressPct={started ? progressPct : 0}
            portalCardUrl={topic.portalCardUrl}
            size="sm"
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.64rem",
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--gold-deep, #A07823)",
              mb: 0.5,
            }}
          >
            {started ? "Most recently opened" : topic.isFree ? "Free starter kit" : "Recommended kit"}
          </Typography>
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.15rem", md: "1.3rem" },
              fontWeight: 600,
              color: "var(--ink, #0A1A2F)",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              mb: 0.75,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {topic.title}
          </Typography>
          <Typography sx={{ fontSize: "0.76rem", color: "var(--ink-soft, #3B4A55)", fontWeight: 500 }}>
            {started
              ? `${topic.viewedCount} of ${topic.resourceCount} resources opened`
              : `${topic.resourceCount} resources · start with the training video`}
          </Typography>
          {started && (
            <Box sx={{ mt: 0.75, height: 5, borderRadius: 999, bgcolor: "rgba(14,42,61,0.08)", overflow: "hidden", maxWidth: 320 }}>
              <Box
                sx={{
                  height: "100%",
                  width: `${progressPct}%`,
                  borderRadius: 999,
                  bgcolor: "var(--gold-deep, #A07823)",
                }}
              />
            </Box>
          )}
        </Box>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            color: "var(--paper, #FBF8F1)",
            bgcolor: "var(--ink, #0A1A2F)",
            fontSize: "0.85rem",
            fontWeight: 700,
            borderRadius: 999,
            px: 2,
            py: 1,
            alignSelf: { xs: "stretch", sm: "center" },
            justifyContent: "center",
            flexShrink: 0,
            whiteSpace: "nowrap",
            transition: "background-color 200ms ease",
            "a:hover &": { bgcolor: "color-mix(in oklch, var(--ink) 88%, white)" },
          }}
        >
          {started ? "Continue" : "Start"} <ArrowForwardIcon sx={{ fontSize: 14 }} />
        </Box>
      </Stack>
    </Box>
  );
}

/** Staggered entrance wrapper — fades a section up as the page mounts. */
function Reveal({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        animation: `${fadeUp} 700ms cubic-bezier(0.16, 1, 0.3, 1) both`,
        animationDelay: `${delay}ms`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      {children}
    </Box>
  );
}

/** Cinematic billboard hero — dark navy stage with a blurred, slowly
 *  drifting blowup of the featured kit's artwork, the welcome folded into
 *  the eyebrow, a gold Resume CTA, and the sharp poster on the right. */
function BillboardHero({
  firstName,
  tierLabel,
  topic,
  resuming,
  standfirst,
}: {
  firstName: string;
  tierLabel: string;
  topic: TopicCard | null;
  resuming: boolean;
  standfirst: string;
}) {
  const progressPct =
    topic && topic.resourceCount > 0
      ? Math.round((topic.viewedCount / topic.resourceCount) * 100)
      : 0;
  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 2.5,
        overflow: "hidden",
        bgcolor: "var(--ink, #0A1A2F)",
        color: "#FFFFFF",
        isolation: "isolate",
        boxShadow: "0 24px 60px -32px rgba(10,26,47,0.55)",
      }}
    >
      {/* Blurred artwork backdrop, drifting in a slow Ken Burns zoom */}
      {topic?.portalCardUrl && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: -40,
            zIndex: 0,
            backgroundImage: `url("${topic.portalCardUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            filter: "blur(28px) saturate(1.15) brightness(0.6)",
            animation: `${kenBurns} 26s ease-in-out infinite alternate`,
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
              transform: "scale(1.12)",
            },
          }}
        />
      )}
      {/* Readability gradients — heavier on the text side, vignette at foot */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background:
            "linear-gradient(90deg, rgba(10,26,47,0.96) 0%, rgba(10,26,47,0.86) 44%, rgba(10,26,47,0.5) 100%), linear-gradient(180deg, rgba(10,26,47,0.2) 0%, transparent 40%, rgba(6,16,30,0.6) 100%)",
        }}
      />

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 3, md: 5 }}
        sx={{
          position: "relative",
          zIndex: 1,
          p: { xs: 2.5, sm: 3.5, md: 4.5 },
          alignItems: { md: "center" },
          minHeight: { md: 320 },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.66rem",
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--gold, #D9A84B)",
              mb: 1.25,
            }}
          >
            Member portal · {tierLabel}
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.9rem", sm: "2.3rem", md: "2.6rem" },
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              mb: 1.25,
              // Explicit — MUI Typography's default (slate text.primary)
              // otherwise wins over the hero's inherited white.
              color: "#FFFFFF",
              textShadow: "0 2px 12px rgba(0,0,0,0.35)",
            }}
          >
            Welcome back, {firstName}.
          </Typography>
          <Typography
            sx={{
              fontSize: "0.92rem",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.82)",
              maxWidth: 560,
            }}
          >
            {standfirst}
          </Typography>

          {topic && (
            <Box sx={{ mt: 3 }}>
              <Typography
                sx={{
                  fontSize: "0.64rem",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--gold, #D9A84B)",
                  mb: 0.5,
                }}
              >
                {resuming ? "Continue watching" : "Featured kit"}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.15rem", md: "1.35rem" },
                  fontWeight: 600,
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                  color: "#FFFFFF",
                  textShadow: "0 1px 8px rgba(0,0,0,0.3)",
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {topic.title}
              </Typography>
              {resuming && (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mt: 1, maxWidth: 380 }}>
                  <Box sx={{ flex: 1, height: 5, borderRadius: 999, bgcolor: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
                    <Box
                      sx={{
                        height: "100%",
                        width: `${progressPct}%`,
                        borderRadius: 999,
                        bgcolor: "var(--gold, #D9A84B)",
                        boxShadow: "0 0 10px rgba(217,168,75,0.65)",
                      }}
                    />
                  </Box>
                  <Typography
                    sx={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.8)",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {topic.viewedCount}/{topic.resourceCount} · {progressPct}%
                  </Typography>
                </Stack>
              )}
            </Box>
          )}

          <Stack direction="row" sx={{ mt: 3, flexWrap: "wrap", gap: 1.25 }}>
            {topic && (
              <Button
                component={Link}
                href={`/dashboard/resources/${topic.slug}`}
                disableElevation
                startIcon={<PlayArrowRoundedIcon />}
                sx={{
                  bgcolor: "var(--gold, #D9A84B)",
                  "&&": { color: "var(--ink, #0A1A2F)" },
                  textTransform: "none",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  borderRadius: 999,
                  px: 2.5,
                  py: 0.9,
                  transition: "background-color 200ms ease, transform 200ms ease",
                  "&:hover": { bgcolor: "#E5BA63", transform: "translateY(-1px)" },
                  "&:focus-visible": { outline: "2px solid #FFFFFF", outlineOffset: 2 },
                }}
              >
                {resuming ? "Resume" : "Start watching"}
              </Button>
            )}
            <Button
              component={Link}
              href="/dashboard/resources"
              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              sx={{
                // Doubled selector out-specifies the theme's MuiButton
                // override, which otherwise paints the label a dim slate.
                "&&": { color: "#FFFFFF" },
                "&& .MuiButton-endIcon": { color: "#FFFFFF" },
                textTransform: "none",
                fontSize: "0.88rem",
                fontWeight: 700,
                borderRadius: 999,
                px: 2.5,
                py: 0.9,
                bgcolor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.55)",
                transition: "border-color 200ms ease, background-color 200ms ease",
                "&:hover": { borderColor: "#FFFFFF", bgcolor: "rgba(255,255,255,0.16)" },
                "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 2 },
              }}
            >
              Browse library
            </Button>
          </Stack>
        </Box>

        {/* Sharp poster on the right — hidden on phones where the backdrop
            already carries the artwork. */}
        {topic && (
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              width: 210,
              flexShrink: 0,
              transform: "rotate(1.5deg)",
              transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1)",
              "&:hover": { transform: "rotate(0deg) scale(1.03)" },
              "@media (prefers-reduced-motion: reduce)": {
                transform: "none",
                "&:hover": { transform: "none" },
              },
            }}
          >
            <Box
              component={Link}
              href={`/dashboard/resources/${topic.slug}`}
              tabIndex={-1}
              aria-hidden
              sx={{
                display: "block",
                borderRadius: 1.5,
                overflow: "hidden",
                boxShadow: "0 30px 60px -22px rgba(0,0,0,0.75)",
              }}
            >
              <KitCover
                slug={topic.slug}
                title={topic.title}
                videoCount={topic.videoCount}
                resourceCount={topic.resourceCount}
                isFree={topic.isFree}
                inProgress={resuming}
                progressPct={resuming ? progressPct : 0}
                portalCardUrl={topic.portalCardUrl}
              />
            </Box>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
