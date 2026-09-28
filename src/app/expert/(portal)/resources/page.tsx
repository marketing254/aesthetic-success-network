"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { EmptyState, PageHeader, SectionCard } from "@/components/vendor/PortalUI";

const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";

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
      <Typography sx={{ fontSize: "0.875rem", color: MUTED, mt: -2 }}>
        To request a new kit, email{" "}
        <Box
          component="a"
          href="mailto:experts@aestheticsuccessnetwork.com"
          sx={{ color: NAVY, textDecoration: "none", fontWeight: 500, "&:hover": { textDecoration: "underline" } }}
        >
          experts@aestheticsuccessnetwork.com
        </Box>
        .
      </Typography>

      {error && (
        <Box sx={{ p: 2, bgcolor: "#FEE2E2", color: "#991B1B", borderRadius: "6px", fontSize: "0.875rem" }}>
          {error}
        </Box>
      )}

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={24} />
        </Stack>
      ) : byTopic.size === 0 ? (
        <EmptyState
          title="Nothing live yet"
          body="When the team publishes a kit tagged with your name, it'll appear here. Member inquiries on those kits will land in your Inquiries inbox."
        />
      ) : (
        <Stack spacing={3}>
          {Array.from(byTopic.values()).map((topic) => (
            <SectionCard
              key={topic.topic_slug}
              title={topic.topic_title}
              subtitle="Kit"
              action={<Chip label={`${topic.items.length} resource${topic.items.length === 1 ? "" : "s"}`} size="small" />}
              padding="none"
            >
              <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
                {topic.items.map((r) => (
                  <Stack
                    key={r.id}
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 1.5, "&:hover": { bgcolor: "#F9FAFB" } }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.25 }}>
                        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK }} noWrap>
                          {r.title}
                        </Typography>
                        <StatusChip status={r.is_published ? "published" : r.submission_status} />
                      </Stack>
                      <Typography sx={{ fontSize: "0.8125rem", color: MUTED }}>
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
                          color: NAVY,
                          fontSize: "0.875rem",
                          fontWeight: 500,
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

function StatusChip({ status }: { status: string }) {
  const color: "success" | "warning" | "default" =
    status === "published" || status === "approved"
      ? "success"
      : status === "draft" || status === "pending_review"
        ? "warning"
        : "default";
  return <Chip label={status.replaceAll("_", " ")} size="small" color={color} />;
}
