"use client";

import { useEffect, useState } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { EmptyState, PageHeader, SectionCard, StatCard, portalText } from "@/components/vendor/PortalUI";

const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";
const HOVER = "#F9FAFB";

type AnalyticsRow = {
  id: string;
  topic_slug: string;
  topic_title: string;
  title: string;
  views_total: number;
  views_unique_members: number;
  inquiries_open: number;
  inquiries_answered: number;
  inquiries_total: number;
  feedback_count: number;
  feedback_avg: number | null;
};

type Headline = {
  views: number;
  members: number;
  inquiries: number;
  avgRating: number | null;
};

export default function VendorAnalyticsPage() {
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [headline, setHeadline] = useState<Headline>({ views: 0, members: 0, inquiries: 0, avgRating: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/vendor/analytics", { cache: "no-store" });
        if (!active || !res.ok) return;
        const body = (await res.json()) as { resources?: AnalyticsRow[]; headline?: Headline };
        if (active) {
          setRows(body.resources ?? []);
          if (body.headline) setHeadline(body.headline);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Analytics"
        subtitle="Views, unique members reached, member inquiries, and the average rating for each kit attributed to your name. Updated in near real-time."
      />

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={24} />
        </Stack>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing to show yet"
          body="When the team publishes a kit tagged with your name, the views, inquiries, and ratings will appear here."
        />
      ) : (
        <>
          {/* Headline tiles */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 3,
            }}
          >
            <StatCard icon={VisibilityRoundedIcon} label="Total views" value={headline.views.toLocaleString()} />
            <StatCard icon={PeopleAltRoundedIcon} label="Members reached" value={headline.members.toLocaleString()} />
            <StatCard icon={ChatBubbleOutlineRoundedIcon} label="Inquiries" value={headline.inquiries.toLocaleString()} />
            <StatCard
              icon={StarRoundedIcon}
              label="Avg rating"
              value={headline.avgRating === null ? "n/a" : headline.avgRating.toFixed(1)}
            />
          </Box>

          {/* Per-resource table */}
          <SectionCard title="By resource" padding="none">
            <Stack divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
              {rows.map((r) => (
                <Box key={r.id} sx={{ px: 3, py: 2, "&:hover": { bgcolor: HOVER } }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={portalText.meta}>{r.topic_title}</Typography>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK, lineHeight: 1.3, mt: 0.25 }}>
                        {r.title}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={3} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                      <Stat label="Views" value={r.views_total} />
                      <Stat label="Members" value={r.views_unique_members} />
                      <Stat
                        label="Inquiries"
                        value={r.inquiries_total}
                        sub={r.inquiries_open > 0 ? `${r.inquiries_open} open` : null}
                      />
                      <Stat
                        label="Rating"
                        value={r.feedback_avg === null ? "n/a" : r.feedback_avg.toFixed(1)}
                        sub={r.feedback_count > 0 ? `${r.feedback_count} response${r.feedback_count === 1 ? "" : "s"}` : null}
                      />
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
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        View kit <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                      </Box>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </>
      )}
    </Stack>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string | null }) {
  return (
    <Box sx={{ textAlign: "right", minWidth: 60 }}>
      <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: MUTED }}>{label}</Typography>
      <Typography
        sx={{ fontSize: "0.9375rem", fontWeight: 600, color: INK, lineHeight: 1.2, mt: 0.25, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </Typography>
      {sub && <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 0.25 }}>{sub}</Typography>}
    </Box>
  );
}
