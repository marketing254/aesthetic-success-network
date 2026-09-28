"use client";

import { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import StarRoundedIcon from "@mui/icons-material/StarRounded";

type FeedbackRow = {
  id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  topic_slug: string;
  topic_title: string;
  rating: number;
  comment: string | null;
  progress_pct: number;
  created_at: string;
};

type Summary = {
  topic_slug: string;
  topic_title: string;
  count: number;
  average: number;
};

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/feedback", { cache: "no-store" });
        if (!active || !res.ok) return;
        const body = (await res.json()) as { feedback?: FeedbackRow[]; summary?: Summary[] };
        if (active) {
          setRows(body.feedback ?? []);
          setSummary(body.summary ?? []);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <Stack spacing={3.5} sx={{ maxWidth: 1100, mx: "auto" }}>
      <Box>
        <Typography
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "#7A5B17",
            textTransform: "uppercase",
            mb: 1,
          }}
        >
          Resource feedback
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "1.9rem", md: "2.4rem" },
            fontWeight: 500,
            color: "#0A1320",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            mb: 1,
          }}
        >
          What members think of each kit
        </Typography>
        <Typography sx={{ fontSize: "0.95rem", color: "#3B4A55", maxWidth: 620, lineHeight: 1.55 }}>
          Members are prompted for a 1–5 rating + optional comment when they cross 50% of a kit. Latest 500 responses shown below.
        </Typography>
      </Box>

      {loading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={22} sx={{ color: "#A07823" }} />
        </Stack>
      ) : (
        <>
          {summary.length > 0 && (
            <Box
              sx={{
                borderRadius: 2,
                border: "1px solid #E0DACE",
                bgcolor: "#FFFFFF",
                overflow: "hidden",
              }}
            >
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #F1EBDF" }}>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "#0A1320" }}>
                  By kit
                </Typography>
              </Box>
              <Stack divider={<Box sx={{ borderTop: "1px solid #F1EBDF" }} />}>
                {summary.map((s) => (
                  <Stack
                    key={s.topic_slug}
                    direction="row"
                    sx={{ px: 2.5, py: 1.5, alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: "#0A1320" }} noWrap>
                        {s.topic_title}
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: "#7A8590" }}>
                        {s.count} response{s.count === 1 ? "" : "s"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                      <StarRoundedIcon sx={{ fontSize: 18, color: "#F0C16E" }} />
                      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#0A1320" }}>
                        {s.average.toFixed(1)}
                      </Typography>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {/* Latest responses */}
          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid #E0DACE",
              bgcolor: "#FFFFFF",
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #F1EBDF" }}>
              <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "#0A1320" }}>
                Latest responses
              </Typography>
            </Box>
            {rows.length === 0 ? (
              <Box sx={{ p: 6, textAlign: "center" }}>
                <Typography sx={{ fontSize: "0.92rem", color: "#7A8590" }}>
                  No feedback submitted yet.
                </Typography>
              </Box>
            ) : (
              <Stack divider={<Box sx={{ borderTop: "1px solid #F1EBDF" }} />}>
                {rows.map((r) => (
                  <Box key={r.id} sx={{ px: 2.5, py: 2 }}>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 0.5 }}>
                      <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <StarRoundedIcon
                            key={star}
                            sx={{
                              fontSize: 16,
                              color: star <= r.rating ? "#F0C16E" : "#E0DACE",
                            }}
                          />
                        ))}
                      </Stack>
                      <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#0A1320" }}>
                        {r.member_name}
                      </Typography>
                      <Typography sx={{ fontSize: "0.74rem", color: "#7A8590" }}>
                        · {r.topic_title}
                      </Typography>
                      <Typography sx={{ fontSize: "0.7rem", color: "#7A8590", ml: "auto" }}>
                        {new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {" · "}
                        {r.progress_pct}% complete
                      </Typography>
                    </Stack>
                    {r.comment && (
                      <Typography sx={{ fontSize: "0.88rem", color: "#3B4A55", lineHeight: 1.55, mt: 0.5 }}>
                        “{r.comment}”
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </>
      )}
    </Stack>
  );
}
