"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { KitCover } from "@/components/member/KitCover";
import {
  EditorialHeader,
  editorialText,
  ink,
} from "@/components/member/Editorial";

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
  kit_type?: "standard" | "book_club" | null;
  originating_expert_id?: string | null;
  created_at?: string | null;
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
  downloadCount: number;
  viewedCount: number;
  completedCount: number;
  isFree: boolean;
  kitType: "standard" | "book_club";
  originatingExpertId: string | null;
  // Newest member-facing publish date — used by the "Latest" sort.
  newestAt: string | null;
};

type SortKey = "latest" | "oldest" | "alpha" | "most-resources";

// Filter key — either a special slot or a literal category name from the DB.
type FilterKey = "all" | "free" | string;

const PAGE_SIZE = 12;

export default function ResourceLibraryPage() {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilterState] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("latest");
  const [expertFilter, setExpertFilter] = useState<string>("all");
  const [expertOptions, setExpertOptions] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(1);

  // Load the expert option list once so the filter dropdown is populated.
  useEffect(() => {
    let active = true;
    fetch("/api/member/experts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { experts: [] }))
      .then((body: { experts?: { id: string; name: string; kit_count: number }[] }) => {
        if (!active) return;
        // Only experts who have at least 1 kit are useful as a filter.
        setExpertOptions(
          (body.experts ?? [])
            .filter((e) => e.kit_count > 0)
            .map((e) => ({ id: e.id, name: e.name })),
        );
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Honour ?expert=<id> deep-links from /dashboard/experts so the same
  // listing UI can be re-used as a "kits by this expert" view.
  const expertId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("expert")
    : null;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const url = expertId
          ? `/api/member/resources?expert=${encodeURIComponent(expertId)}`
          : "/api/member/resources";
        const res = await fetch(url, { cache: "no-store" });
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
  }, [expertId]);

  // Wrap filter & query setters so the page resets at the same time the user
  // changes them — avoids a separate effect that would cause a cascading render.
  const setFilter = (k: FilterKey) => {
    setFilterState(k);
    setPage(1);
  };
  const setQuery = (next: string) => {
    setQ(next);
    setPage(1);
  };

  const topics: TopicCard[] = useMemo(() => {
    const map = new Map<string, TopicCard>();
    for (const r of resources) {
      const isVideo = r.kind.startsWith("video_") || r.kind === "audio";
      const existing = map.get(r.topic_slug);
      const viewed = !!r.progress?.last_viewed_at;
      const completed = !!r.progress?.completed_at;
      if (existing) {
        existing.resourceCount += 1;
        if (isVideo) existing.videoCount += 1;
        else existing.downloadCount += 1;
        if (viewed) existing.viewedCount += 1;
        if (completed) existing.completedCount += 1;
        if (!r.is_free) existing.isFree = false;
        if (r.created_at && (!existing.newestAt || r.created_at > existing.newestAt)) {
          existing.newestAt = r.created_at;
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
          downloadCount: isVideo ? 0 : 1,
          viewedCount: viewed ? 1 : 0,
          completedCount: completed ? 1 : 0,
          isFree: r.is_free,
          kitType: r.kit_type === "book_club" ? "book_club" : "standard",
          originatingExpertId: r.originating_expert_id ?? null,
          newestAt: r.created_at ?? null,
        });
      }
    }
    return Array.from(map.values());
  }, [resources]);

  // Index expert name → id for matching the search against expert names.
  const expertNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of expertOptions) m.set(e.id, e.name.toLowerCase());
    return m;
  }, [expertOptions]);

  const filtered = useMemo(() => {
    let out = topics;
    if (filter === "free") {
      out = out.filter((t) => t.isFree);
    } else if (filter !== "all") {
      out = out.filter((t) => t.category === filter);
    }
    if (expertFilter !== "all") {
      out = out.filter((t) => t.originatingExpertId === expertFilter);
    }
    if (q.trim()) {
      const lc = q.toLowerCase();
      out = out.filter(
        (t) =>
          t.title.toLowerCase().includes(lc) ||
          (t.summary ?? "").toLowerCase().includes(lc) ||
          (t.category ?? "").toLowerCase().includes(lc) ||
          // Match expert names as well so "atomic" finds Atomic Habits AND
          // an expert's name finds every kit tagged to them.
          (t.originatingExpertId
            ? (expertNameById.get(t.originatingExpertId) ?? "").includes(lc)
            : false),
      );
    }
    // Stable sort — duplicate the array first so the underlying memo doesn't
    // mutate.
    const sorted = [...out];
    switch (sort) {
      case "alpha":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "most-resources":
        sorted.sort((a, b) => b.resourceCount - a.resourceCount);
        break;
      case "oldest":
        sorted.sort((a, b) => {
          const av = a.newestAt ?? "";
          const bv = b.newestAt ?? "";
          return av.localeCompare(bv);
        });
        break;
      case "latest":
      default:
        sorted.sort((a, b) => {
          const av = a.newestAt ?? "";
          const bv = b.newestAt ?? "";
          return bv.localeCompare(av);
        });
        break;
    }
    return sorted;
  }, [topics, q, filter, expertFilter, expertNameById, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  // Pull category labels straight from the DB rows — no hard-coded enum.
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const t of topics) {
      if (t.category) set.add(t.category);
    }
    return Array.from(set).sort();
  }, [topics]);

  const freeCount = topics.filter((t) => t.isFree).length;

  return (
    <Box sx={{ color: ink.primary }}>
      <EditorialHeader
        eyebrow="Resource library"
        title="Built from real experts. Ready for you & your team."
        standfirst="Each kit is a topic pack: training video, action guide, worksheets, checklist, and ready-to-use templates. Stream the video, download the rest."
      />

      {/* Toolbar — dropdown filters + sort + search. Scales as we add more
          categories and experts without consuming an extra row. */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.25}
        sx={{
          alignItems: { md: "center" },
          mb: 3,
        }}
      >
        <TextField
          size="small"
          placeholder="Search by title, category, or expert"
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon sx={{ fontSize: 18, color: ink.fade }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            flex: { md: 1.4 },
            "& .MuiOutlinedInput-root": {
              borderRadius: 999,
              fontSize: "0.88rem",
              bgcolor: "#FFFFFF",
            },
          }}
        />
        <TextField
          select
          size="small"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterKey)}
          label="Category"
          slotProps={{ inputLabel: { sx: { fontSize: "0.82rem" } } }}
          sx={{
            minWidth: 180,
            "& .MuiOutlinedInput-root": {
              borderRadius: 999,
              fontSize: "0.86rem",
              bgcolor: "#FFFFFF",
            },
          }}
        >
          <MenuItem value="all" sx={{ fontSize: "0.86rem" }}>All categories ({topics.length})</MenuItem>
          <MenuItem value="free" sx={{ fontSize: "0.86rem" }}>Free ({freeCount})</MenuItem>
          {availableCategories.map((c) => (
            <MenuItem key={c} value={c} sx={{ fontSize: "0.86rem" }}>
              {c} ({topics.filter((t) => t.category === c).length})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          value={expertFilter}
          onChange={(e) => setExpertFilter(e.target.value)}
          label="Expert"
          slotProps={{ inputLabel: { sx: { fontSize: "0.82rem" } } }}
          sx={{
            minWidth: 170,
            "& .MuiOutlinedInput-root": {
              borderRadius: 999,
              fontSize: "0.86rem",
              bgcolor: "#FFFFFF",
            },
          }}
        >
          <MenuItem value="all" sx={{ fontSize: "0.86rem" }}>All experts</MenuItem>
          {expertOptions.map((e) => (
            <MenuItem key={e.id} value={e.id} sx={{ fontSize: "0.86rem" }}>
              {e.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          label="Sort"
          slotProps={{ inputLabel: { sx: { fontSize: "0.82rem" } } }}
          sx={{
            minWidth: 150,
            "& .MuiOutlinedInput-root": {
              borderRadius: 999,
              fontSize: "0.86rem",
              bgcolor: "#FFFFFF",
            },
          }}
        >
          <MenuItem value="latest" sx={{ fontSize: "0.86rem" }}>Latest</MenuItem>
          <MenuItem value="oldest" sx={{ fontSize: "0.86rem" }}>Oldest</MenuItem>
          <MenuItem value="alpha" sx={{ fontSize: "0.86rem" }}>A–Z</MenuItem>
          <MenuItem value="most-resources" sx={{ fontSize: "0.86rem" }}>Most resources</MenuItem>
        </TextField>
      </Stack>

      {/* Grid */}
      {loading ? (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress size={20} sx={{ color: "var(--gold)" }} />
        </Stack>
      ) : filtered.length === 0 ? (
        <Box
          sx={{
            py: 8,
            textAlign: "center",
            borderTop: "1px solid var(--paper-rule)",
            borderBottom: "1px solid var(--paper-rule)",
          }}
        >
          <Typography sx={{ ...editorialText.heading, mb: 0.5 }}>
            {q ? `No kits match "${q}"` : topics.length === 0 ? "No kits published yet" : "No kits in this filter"}
          </Typography>
          <Typography sx={editorialText.meta}>
            {topics.length === 0 && !q
              ? "Kits will appear here as soon as the ASN content team adds them."
              : "Try a different filter or clear the search."}
          </Typography>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              // 12 kits per page → 4-up on desktop (3 clean rows), 3-up on
              // tablet (4 rows), 2-up on phones (6 rows). Smaller cards,
              // no ragged last row at any breakpoint.
              gridTemplateColumns: {
                xs: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: { xs: 2, md: 2.5 },
              rowGap: { xs: 2.5, md: 3 },
            }}
          >
            {pageItems.map((t) => (
              <KitTile key={t.slug} topic={t} />
            ))}
          </Box>

          {totalPages > 1 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          )}
        </>
      )}
    </Box>
  );
}

function KitTile({ topic }: { topic: TopicCard }) {
  const progressPct =
    topic.resourceCount > 0
      ? Math.round((topic.viewedCount / topic.resourceCount) * 100)
      : 0;
  const inProgress = topic.viewedCount > 0 && topic.viewedCount < topic.resourceCount;
  const completed = topic.completedCount === topic.resourceCount && topic.resourceCount > 0;

  return (
    <Box
      component={Link}
      href={`/dashboard/resources/${topic.slug}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        transition: "transform var(--dur-base) var(--ease-out)",
        "&:hover": { transform: "translateY(-2px)" },
        "&:focus-visible": {
          outline: "2px solid var(--gold)",
          outlineOffset: 4,
          borderRadius: "4px",
        },
      }}
    >
      <Box sx={{ mb: 1.5 }}>
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

      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.5, flexWrap: "wrap", rowGap: 0.5 }}>
        {topic.kitType === "book_club" && (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.4,
              height: 16,
              px: 0.75,
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
        {topic.category && (
          <Typography sx={{ ...editorialText.eyebrow, color: ink.fade }}>
            {topic.category}
          </Typography>
        )}
      </Stack>
      {topic.summary && (
        <Typography
          sx={{
            ...editorialText.body,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            mb: 1.25,
          }}
        >
          {topic.summary}
        </Typography>
      )}
      <Box
        sx={{
          mt: "auto",
          pt: 1,
          borderTop: "1px solid var(--paper-rule)",
        }}
      >
        {/* Progress bar — replaces the "X items · Y done" line */}
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            mb: 0.6,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.66rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: completed ? "var(--leaf, #1F5C40)" : inProgress ? "var(--gold-deep, #A07823)" : "var(--ink-fade, #7A8590)",
            }}
          >
            {completed
              ? "Complete"
              : inProgress
                ? `${progressPct}% complete`
                : "Not started"}
          </Typography>
          <Typography sx={{ ...editorialText.meta, fontSize: "0.7rem" }}>
            {topic.viewedCount}/{topic.resourceCount}
          </Typography>
        </Stack>
        <Box
          sx={{
            height: 6,
            borderRadius: 999,
            bgcolor: "rgba(14,42,61,0.08)",
            overflow: "hidden",
          }}
        >
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
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "flex-end",
            mt: 0.8,
          }}
        >
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.4,
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--gold-deep)",
            }}
          >
            {inProgress && !completed ? "Continue" : completed ? "Re-open" : "Open"}{" "}
            <ArrowForwardIcon sx={{ fontSize: 12 }} />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const goPrev = () => {
    if (canPrev) {
      onChange(page - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const goNext = () => {
    if (canNext) {
      onChange(page + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Build page numbers (with ellipsis around current page when many pages)
  const pageNumbers: Array<number | "…"> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (page > 3) pageNumbers.push("…");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pageNumbers.push(i);
    if (page < totalPages - 2) pageNumbers.push("…");
    pageNumbers.push(totalPages);
  }

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{
        mt: 4,
        pt: 2.5,
        borderTop: "1px solid var(--paper-rule)",
        alignItems: "center",
        justifyContent: "center",
        columnGap: 3,
      }}
    >
      <Typography sx={editorialText.meta}>
        Showing {from}–{to} of {totalItems}
      </Typography>

      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <PageButton onClick={goPrev} disabled={!canPrev} ariaLabel="Previous page">
          <ArrowBackIcon sx={{ fontSize: 13 }} /> Prev
        </PageButton>

        <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 0.25, mx: 1 }}>
          {pageNumbers.map((p, i) =>
            p === "…" ? (
              <Box
                key={`gap-${i}`}
                sx={{ px: 0.75, color: "var(--ink-fade)", fontSize: "0.78rem" }}
              >
                …
              </Box>
            ) : (
              <PageNumber
                key={p}
                page={p}
                active={p === page}
                onClick={() => {
                  onChange(p);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ),
          )}
        </Box>

        {/* Mobile compact indicator */}
        <Box
          sx={{
            display: { xs: "inline-flex", sm: "none" },
            mx: 1,
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          {page} / {totalPages}
        </Box>

        <PageButton onClick={goNext} disabled={!canNext} ariaLabel="Next page">
          Next <ArrowForwardIcon sx={{ fontSize: 13 }} />
        </PageButton>
      </Stack>
    </Stack>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.4,
        height: 30,
        px: 1.25,
        bgcolor: "transparent",
        border: "1px solid var(--paper-rule)",
        borderRadius: 0.5,
        color: disabled ? "var(--ink-fade)" : "var(--ink)",
        fontSize: "0.76rem",
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition:
          "background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
        "&:hover": disabled
          ? {}
          : {
              borderColor: "var(--ink)",
              bgcolor: "color-mix(in oklch, var(--ink) 4%, transparent)",
            },
        "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 2 },
      }}
    >
      {children}
    </Box>
  );
}

function PageNumber({
  page,
  active,
  onClick,
}: {
  page: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={`Page ${page}`}
      aria-current={active ? "page" : undefined}
      sx={{
        minWidth: 30,
        height: 30,
        bgcolor: active ? "var(--ink)" : "transparent",
        color: active ? "var(--paper)" : "var(--ink)",
        border: "1px solid",
        borderColor: active ? "var(--ink)" : "transparent",
        borderRadius: 0.5,
        fontSize: "0.78rem",
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        transition:
          "background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
        "&:hover": active
          ? {}
          : { bgcolor: "color-mix(in oklch, var(--ink) 6%, transparent)" },
        "&:focus-visible": { outline: "2px solid var(--gold)", outlineOffset: 2 },
      }}
    >
      {page}
    </Box>
  );
}
