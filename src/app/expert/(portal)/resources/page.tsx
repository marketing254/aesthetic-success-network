"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { CP } from "@/components/shared/CommunityPortalShell";
import { EP } from "@/components/shared/TopNavPortalShell";
import { EmptyState, ListDivider, PageHeader, SectionCard, TagPill, portalText } from "@/components/vendor/PortalUI";

type PublishedResource = {
  id: string;
  topic_slug: string;
  topic_title: string;
  title: string;
  kind: string;
  category: string | null;
  position: number;
  is_published: boolean;
  submission_status: string;
  created_at: string;
  thumbnail_url: string | null;
};

/**
 * Expert resources view (read-only).
 *
 * Experts no longer upload resources directly — the admin/content team
 * publishes resources on their behalf, tagging the originating expert.
 * Anything in the `resources` table with `originating_expert_id = me`
 * shows up here so the expert can see what's live in their voice.
 */
export default function ExpertResourcesPage() {
  const [rows, setRows] = useState<PublishedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/expert/resources", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setError("Couldn't load your resources right now.");
          return;
        }
        const body = (await res.json()) as { resources?: PublishedResource[] };
        if (active) setRows(body.resources ?? []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Realtime — pick up new admin uploads without a refresh.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("expert-resources-view")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resources" },
        () => {
          fetch("/api/expert/resources", { cache: "no-store" })
            .then((r) => r.json())
            .then((b: { resources?: PublishedResource[] }) => setRows(b.resources ?? []))
            .catch(() => {});
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  // Group by topic for cleaner browsing.
  const byTopic = new Map<string, { topic_title: string; topic_slug: string; items: PublishedResource[] }>();
  for (const r of rows) {
    const cur = byTopic.get(r.topic_slug) ?? {
      topic_title: r.topic_title,
      topic_slug: r.topic_slug,
      items: [],
    };
    cur.items.push(r);
    byTopic.set(r.topic_slug, cur);
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Your library"
        subtitle="The ASN content team produces and publishes your kits (videos, action guides, worksheets) and tags them to your name. Anything live in the member library that originated from you shows up here."
      />
      <Typography sx={{ ...portalText.meta, mt: -2 }}>
        To request a new kit, email{" "}
        <Box
          component="a"
          href="mailto:experts@aestheticsuccessnetwork.com"
          sx={{ color: EP.bronze, textDecoration: "none", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}
        >
          experts@aestheticsuccessnetwork.com
        </Box>
        .
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={24} />
        </Stack>
      ) : byTopic.size === 0 ? (
        <EmptyState
          icon={LibraryBooksOutlinedIcon}
          title="Nothing live yet"
          body="When the team publishes a kit tagged with your name, it will appear here. Member inquiries on those kits will land in your Inquiries inbox."
        />
      ) : (
        <Stack spacing={3}>
          {Array.from(byTopic.values()).map((topic) => (
            <SectionCard
              key={topic.topic_slug}
              title={topic.topic_title}
              subtitle="Kit"
              action={<TagPill label={`${topic.items.length} resource${topic.items.length === 1 ? "" : "s"}`} />}
              padding="none"
            >
              <Stack divider={<ListDivider />}>
                {topic.items.map((r) => (
                  <Stack
                    key={r.id}
                    direction="row"
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                      minHeight: 56,
                      px: 3,
                      py: 1.5,
                      transition: "background-color 120ms ease",
                      "&:hover": { bgcolor: EP.bronzeTint },
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5, mb: 0.25 }}>
                        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: CP.ink }} noWrap>
                          {r.title}
                        </Typography>
                        <StatusChip status={r.is_published ? "published" : r.submission_status} />
                      </Stack>
                      <Typography sx={portalText.meta}>
                        {r.kind.replaceAll("_", " ")} {r.category ? `· ${r.category}` : ""}
                      </Typography>
                    </Box>
                    {r.is_published && (
                      <Box
                        component="a"
                        href={`/dashboard/resources/${r.topic_slug}`}
                        target="_blank"
                        rel="noopener"
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          color: EP.bronze,
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          textDecoration: "none",
                          flexShrink: 0,
                          ml: 2,
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        View <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                      </Box>
                    )}
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** Green for live, amber for in-progress, gray for anything else. */
function StatusChip({ status }: { status: string }) {
  const tone: "green" | "gold" | "neutral" =
    status === "published" || status === "approved"
      ? "green"
      : status === "draft" || status === "pending_review"
        ? "gold"
        : "neutral";
  return <TagPill label={status.replaceAll("_", " ")} tone={tone} size="sm" />;
}
