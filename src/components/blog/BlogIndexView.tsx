"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Container, Pagination, Stack, Typography } from "@mui/material";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import { PUBLISHED_BLOG_ARTICLES, BLOG_INDEX_HEADING, BLOG_INDEX_STANDFIRST } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

/**
 * /blog index — heading + supporting copy per the approved build brief,
 * category filter chips (derived from live articles only, so no empty
 * categories ever render) and the responsive card grid in launch order.
 */
const PAGE_SIZE = 6;

export default function BlogIndexView() {
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const gridTop = useRef<HTMLDivElement | null>(null);

  // Categories derive from the registry — a future category appears here
  // automatically the moment its first article ships.
  const categories = useMemo(
    () => [...new Set(PUBLISHED_BLOG_ARTICLES.map((a) => a.category))],
    [],
  );
  const filtered = category ? PUBLISHED_BLOG_ARTICLES.filter((a) => a.category === category) : PUBLISHED_BLOG_ARTICLES;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // A new category filter always starts from page 1.
  useEffect(() => {
    setPage(1);
  }, [category]);

  const goToPage = (next: number) => {
    setPage(next);
    gridTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#FBF8F1", display: "flex", flexDirection: "column" }}>
      <Header />

      {/* Hero — centered so the wide cream canvas reads balanced instead
          of a left-heavy block with dead space on the right. A short gold
          rule anchors the heading the way the site's other pages do. */}
      <Box sx={{ pt: { xs: 5, md: 8 }, pb: { xs: 3, md: 4.5 }, textAlign: "center" }}>
        <Container maxWidth="lg">
          <Typography
            variant="overline"
            sx={{
              color: GOLD,
              fontSize: "0.66rem",
              fontWeight: 700,
              letterSpacing: "0.22em",
              display: "block",
              mb: 1,
            }}
          >
            ASN Blog
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
              fontWeight: 600,
              color: INK,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 800,
              mx: "auto",
              mb: 2,
            }}
          >
            {BLOG_INDEX_HEADING}
          </Typography>
          <Typography sx={{ fontSize: "1.02rem", color: INK_SOFT, lineHeight: 1.65, maxWidth: 620, mx: "auto" }}>
            {BLOG_INDEX_STANDFIRST}
          </Typography>
          <Box sx={{ width: 44, height: 3, bgcolor: "#D9A84B", borderRadius: 2, mx: "auto", mt: 3, opacity: 0.7 }} />
        </Container>
      </Box>

      {/* Category filter — centered under the hero on the same axis */}
      {categories.length > 1 && (
        <Container maxWidth="lg" sx={{ mb: 4 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, justifyContent: "center" }}>
            {[null, ...categories].map((cat) => {
              const active = category === cat;
              return (
                <Chip
                  key={cat ?? "all"}
                  label={cat ?? "All topics"}
                  clickable
                  onClick={() => setCategory(cat)}
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    borderRadius: 999,
                    bgcolor: active ? INK : "#FFFFFF",
                    color: active ? "#F6F1E7" : INK_SOFT,
                    border: `1px solid ${active ? INK : LINE}`,
                    "&:hover": { bgcolor: active ? INK : "rgba(217,168,75,0.1)" },
                  }}
                />
              );
            })}
          </Stack>
        </Container>
      )}

      {/* Article grid — launch order preserved (registry order) */}
      <Container maxWidth="lg" sx={{ pb: { xs: 6, md: 9 }, flex: 1 }}>
        <Box ref={gridTop} sx={{ scrollMarginTop: 110 }} />
        {PUBLISHED_BLOG_ARTICLES.length === 0 && (
          /* Honest empty state: the registry ships empty at launch. */
          <Box
            sx={{
              py: { xs: 6, md: 8 },
              textAlign: "center",
              bgcolor: "#FFFFFF",
              border: `1px solid ${LINE}`,
              borderRadius: 3,
            }}
          >
            <Typography sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.4rem", md: "1.7rem" }, color: INK, mb: 1 }}>
              No posts yet.
            </Typography>
            <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, maxWidth: 520, mx: "auto", lineHeight: 1.6 }}>
              The first articles are in production and will appear here as they are approved.
              In the meantime, membership details are on the pricing page.
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
            gridAutoRows: "1fr",
            gap: 3,
          }}
        >
          {shown.map((article) => (
            <BlogCard key={article.slug} article={article} />
          ))}
        </Box>

        {pageCount > 1 && (
          <Stack direction="row" sx={{ justifyContent: "center", mt: { xs: 4, md: 5 } }}>
            <Pagination
              count={pageCount}
              page={page}
              onChange={(_, next) => goToPage(next)}
              shape="rounded"
              size="large"
              sx={{
                "& .MuiPaginationItem-root": {
                  fontWeight: 700,
                  color: INK_SOFT,
                  border: `1px solid ${LINE}`,
                  bgcolor: "#FFFFFF",
                  borderRadius: 2,
                },
                "& .MuiPaginationItem-root.Mui-selected": {
                  bgcolor: INK,
                  color: "#F6F1E7",
                  borderColor: INK,
                  "&:hover": { bgcolor: INK },
                },
                "& .MuiPaginationItem-root:hover": { bgcolor: "rgba(217,168,75,0.12)" },
              }}
            />
          </Stack>
        )}
      </Container>

      <Footer />
    </Box>
  );
}
