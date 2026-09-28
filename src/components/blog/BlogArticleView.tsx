"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Box, Button, Collapse, Container, IconButton, Stack, Typography } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import { BLOG_CTA_LABEL, type BlogArticle } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";
import { Block, TocLinks, bodyText, inline } from "@/components/blog/ArticleBlocks";

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
      new Date(`${iso}T00:00:00`),
    );
  } catch {
    return iso;
  }
}

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const GOLD_BRIGHT = "#D9A84B";
const LINE = "#E6DDCF";


/**
 * Reusable ASN blog-article template (approved editorial pattern):
 * breadcrumb → hero (category, single H1, dek, author row, featured image)
 * → answer-first callout → sticky desktop TOC + scannable body → takeaway
 * card → membership CTA panel → related articles. Wrapped in the main
 * site's Header/Footer so the blog reads as part of the primary website.
 */
export default function BlogArticleView({
  article,
  related,
}: {
  article: BlogArticle;
  related: BlogArticle[];
}) {
  const toc = [
    ...(article.quickAnswer ? [{ id: "quick-answer", label: "The quick answer" }] : []),
    ...article.body.filter((b) => b.kind === "h2").map((b) => ({ id: b.id, label: b.toc })),
    ...(article.faqs && article.faqs.length > 0 ? [{ id: "faq", label: "FAQs" }] : []),
  ];
  const [tocOpen, setTocOpen] = useState(false);

  const expertName = article.expert.profileHref ? (
    <Box
      component={Link}
      href={article.expert.profileHref}
      sx={{
        color: "inherit",
        textDecoration: "none",
        borderBottom: `1px solid rgba(217,168,75,0.6)`,
        "&:hover": { color: GOLD },
      }}
    >
      {article.expert.name}
    </Box>
  ) : (
    article.expert.name
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#FBF8F1", display: "flex", flexDirection: "column" }}>
      <Header />

      <Container maxWidth="lg" sx={{ flex: 1 }}>
        {/* Breadcrumb — a white pill matching the header's nav-pill
            language: Home / Blog as gold-hover links, chevron separators,
            current article truncated with a tooltip-free ellipsis. */}
        <Box sx={{ maxWidth: 986, mx: "auto", pt: { xs: 2.5, md: 3.5 } }}>
          <Stack
            component="nav"
            aria-label="Breadcrumb"
            direction="row"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              maxWidth: "100%",
              bgcolor: "#FFFFFF",
              border: "1px solid rgba(14,42,61,0.08)",
              borderRadius: 999,
              px: 1,
              py: 0.5,
              boxShadow: "0 4px 20px -8px rgba(14,42,61,0.08)",
            }}
          >
            <Box
              component={Link}
              href="/"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.6,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                fontSize: "0.76rem",
                fontWeight: 600,
                color: INK_SOFT,
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "color 180ms ease, background-color 180ms ease",
                "&:hover": { color: INK, bgcolor: "rgba(217,168,75,0.10)" },
              }}
            >
              <HomeRoundedIcon sx={{ fontSize: 14, color: GOLD }} />
              Home
            </Box>
            <ChevronRightRoundedIcon sx={{ fontSize: 15, color: INK_MUTED, opacity: 0.6, flexShrink: 0 }} />
            <Box
              component={Link}
              href="/blog"
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                fontSize: "0.76rem",
                fontWeight: 600,
                color: INK_SOFT,
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "color 180ms ease, background-color 180ms ease",
                "&:hover": { color: INK, bgcolor: "rgba(217,168,75,0.10)" },
              }}
            >
              Blog
            </Box>
            <ChevronRightRoundedIcon sx={{ fontSize: 15, color: INK_MUTED, opacity: 0.6, flexShrink: 0 }} />
            <Typography
              aria-current="page"
              sx={{
                px: 1.25,
                py: 0.5,
                fontSize: "0.76rem",
                fontWeight: 700,
                color: GOLD,
                maxWidth: { xs: 170, sm: 380, md: 520 },
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {article.title}
            </Typography>
          </Stack>
        </Box>

        {/* Hero — same centered 986px axis as the body below, so the
            title column, image, TOC and article all line up. */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.05fr) minmax(0, 0.95fr)" },
            gap: { xs: 3, md: 5 },
            alignItems: "center",
            pt: { xs: 3, md: 5 },
            pb: { xs: 3.5, md: 5 },
            maxWidth: 986,
            mx: "auto",
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: "0.7rem",
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: GOLD,
                mb: 1.5,
              }}
            >
              {article.category}
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontFamily: "var(--font-display)",
                fontSize: { xs: "1.85rem", sm: "2.1rem", md: "2.3rem" },
                fontWeight: 600,
                color: INK,
                lineHeight: 1.14,
                letterSpacing: "-0.02em",
                mb: 2,
              }}
            >
              {article.title}
            </Typography>
            <Typography sx={{ fontSize: "1.02rem", color: INK_SOFT, lineHeight: 1.65, mb: 3 }}>
              {article.dek}
            </Typography>

            {/* Author row */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
              <Box
                sx={{
                  position: "relative",
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: `2px solid rgba(217,168,75,0.55)`,
                  flexShrink: 0,
                }}
              >
                <Image
                  src={article.expert.headshotUrl}
                  alt={article.expert.name}
                  fill
                  sizes="48px"
                  style={{ objectFit: "cover", objectPosition: "center top" }}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>
                  Expert guidance from {expertName}
                </Typography>
                <Typography sx={{ fontSize: "0.78rem", color: INK_MUTED }}>
                  {article.expert.role} ·{" "}
                  {article.dateModified !== article.datePublished
                    ? `Updated ${formatDate(article.dateModified)}`
                    : `Published ${formatDate(article.datePublished)}`}
                </Typography>
              </Box>
              <Box
                sx={{
                  ml: { sm: "auto" },
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: "rgba(217,168,75,0.12)",
                  color: GOLD,
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                }}
              >
                {article.readTime}
              </Box>
            </Stack>
          </Box>

          {/* Featured image */}
          <Box
            sx={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: 4,
              overflow: "hidden",
              boxShadow: "0 32px 64px -28px rgba(10,26,47,0.4)",
            }}
          >
            <Image
              src={article.hero.src}
              alt={article.hero.alt}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
              style={{ objectFit: "cover" }}
            />
          </Box>
        </Box>

        {/* Body layout: sticky TOC rail + article column. The pair is
            centered as one unit (justifyContent) so the leftover container
            width splits evenly left/right instead of piling up on the
            right side of the article. */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "230px minmax(0, 700px)" },
            justifyContent: "center",
            gap: { xs: 0, md: 7 },
            alignItems: "start",
            pb: { xs: 5, md: 7 },
          }}
        >
          {/* Desktop TOC */}
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              position: "sticky",
              top: 110,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.66rem",
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: INK_MUTED,
                mb: 1.5,
                px: 1.5,
              }}
            >
              In this article
            </Typography>
            <TocLinks toc={toc} />
          </Box>

          <Box component="article" sx={{ minWidth: 0 }}>
            {/* Mobile in-page contents control */}
            <Box sx={{ display: { xs: "block", md: "none" }, mb: 3 }}>
              <Button
                onClick={() => setTocOpen((v) => !v)}
                aria-expanded={tocOpen}
                fullWidth
                disableRipple
                endIcon={
                  <ExpandMoreRoundedIcon
                    sx={{ transition: "transform 180ms ease", transform: tocOpen ? "rotate(180deg)" : "none" }}
                  />
                }
                sx={{
                  justifyContent: "space-between",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  color: INK,
                  bgcolor: "#FFFFFF",
                  border: `1px solid ${LINE}`,
                  borderRadius: 2.5,
                  px: 2,
                  py: 1.25,
                  "&:hover": { bgcolor: "#FFFFFF", borderColor: GOLD_BRIGHT },
                }}
              >
                In this article
              </Button>
              <Collapse in={tocOpen}>
                <Box sx={{ pt: 1.5 }}>
                  <TocLinks toc={toc} onNavigate={() => setTocOpen(false)} />
                </Box>
              </Collapse>
            </Box>

            {/* Answer-first callout (AEO) */}
            {article.quickAnswer && (
              <Box
                id="quick-answer"
                sx={{
                  p: { xs: 2.5, md: 3 },
                  mb: 4,
                  borderRadius: 3,
                  bgcolor: "#FFFFFF",
                  border: `1px solid ${LINE}`,
                  borderTop: `3px solid ${GOLD_BRIGHT}`,
                  scrollMarginTop: "110px",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: GOLD,
                    mb: 1,
                  }}
                >
                  The quick answer
                </Typography>
                <Typography sx={{ fontSize: "1rem", color: INK, lineHeight: 1.7 }}>
                  {article.quickAnswer}
                </Typography>
              </Box>
            )}

            {article.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}

            {/* FAQ — approved Q&A, also emitted as FAQPage JSON-LD */}
            {article.faqs && article.faqs.length > 0 && (
              <Box sx={{ mt: 5 }}>
                <Typography
                  component="h2"
                  id="faq"
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: { xs: "1.45rem", md: "1.7rem" },
                    fontWeight: 600,
                    color: INK,
                    lineHeight: 1.22,
                    letterSpacing: "-0.015em",
                    mb: 2.5,
                    scrollMarginTop: "110px",
                  }}
                >
                  Frequently asked questions
                </Typography>
                {article.faqs.map((faq) => (
                  <Box
                    key={faq.q}
                    sx={{
                      mb: 2,
                      p: { xs: 2.25, md: 2.75 },
                      borderRadius: 3,
                      bgcolor: "#FFFFFF",
                      border: `1px solid ${LINE}`,
                    }}
                  >
                    <Typography
                      component="h3"
                      sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 0.9, lineHeight: 1.4 }}
                    >
                      {faq.q}
                    </Typography>
                    <Typography sx={{ fontSize: "0.95rem", color: INK_SOFT, lineHeight: 1.7 }}>
                      {faq.a}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* Takeaway card */}
            <Box
              sx={{
                mt: 5,
                p: { xs: 2.5, md: 3.5 },
                borderRadius: 3,
                bgcolor: "rgba(217,168,75,0.08)",
                border: "1px solid rgba(217,168,75,0.3)",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: GOLD,
                  mb: 1,
                }}
              >
                {article.takeaway.eyebrow}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.3rem", md: "1.5rem" },
                  fontWeight: 600,
                  color: INK,
                  lineHeight: 1.25,
                  mb: 1.25,
                }}
              >
                {article.takeaway.title}
              </Typography>
              <Typography sx={{ ...bodyText, mb: 0 }}>{article.takeaway.body}</Typography>
            </Box>

            {/* Membership CTA — wording + destination locked by the approver */}
            <Box
              sx={{
                mt: 4,
                borderRadius: 4,
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 0.9fr) minmax(0, 1.1fr)" },
                background: "linear-gradient(135deg, #0A1A2F 0%, #12325A 100%)",
              }}
            >
              {/* Kit panel — composed in-page (kit name + expert) instead of
                  cropping the hero image, so nothing is ever cut off. */}
              <Box
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  p: { xs: 3, md: 3.5 },
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: { xs: 220, sm: "100%" },
                  background: "linear-gradient(160deg, #17335A 0%, #0A1A2F 80%)",
                  borderRight: { sm: "1px solid rgba(217,168,75,0.22)" },
                }}
              >
                <Box aria-hidden sx={{ position: "absolute", right: -70, top: -70, width: 220, height: 220, borderRadius: "50%", border: "1px solid rgba(217,168,75,0.18)" }} />
                <Box>
                  <Box
                    sx={{
                      display: "inline-block",
                      px: 1.25,
                      py: 0.45,
                      borderRadius: 999,
                      border: "1px solid rgba(217,168,75,0.5)",
                      color: "#E8C76F",
                      fontSize: "0.6rem",
                      fontWeight: 800,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      mb: 1.75,
                    }}
                  >
                    Expert kit · Action guide
                  </Box>
                  <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(246,241,231,0.55)", mb: 0.75 }}>
                    {article.category}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontSize: { xs: "1.35rem", md: "1.5rem" },
                      fontWeight: 600,
                      color: "#F6F1E7",
                      lineHeight: 1.2,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {article.kitCta.kitName}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mt: 3 }}>
                  <Box sx={{ position: "relative", width: 58, height: 58, borderRadius: "50%", overflow: "hidden", border: "2px solid #D9A84B", flexShrink: 0 }}>
                    <Image
                      src={article.expert.headshotUrl}
                      alt={article.expert.name}
                      fill
                      sizes="58px"
                      style={{ objectFit: "cover", objectPosition: "center top" }}
                    />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "#F6F1E7", lineHeight: 1.2 }}>
                      {article.expert.name}
                    </Typography>
                    <Typography sx={{ fontSize: "0.76rem", color: "rgba(246,241,231,0.65)", mt: 0.25 }} noWrap>
                      {article.expert.role}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
              <Box sx={{ p: { xs: 3, md: 4 } }}>
                <Typography
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: GOLD_BRIGHT,
                    mb: 1.25,
                  }}
                >
                  Continue inside the membership
                </Typography>
                <Typography
                  component="h2"
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: { xs: "1.35rem", md: "1.55rem" },
                    fontWeight: 600,
                    color: "#F6F1E7",
                    lineHeight: 1.25,
                    mb: 1.25,
                  }}
                >
                  Get the complete {article.kitCta.kitName} kit.
                </Typography>
                <Typography sx={{ fontSize: "0.92rem", color: "rgba(246,241,231,0.82)", lineHeight: 1.65, mb: 2.5 }}>
                  {article.kitCta.description}
                </Typography>
                {article.kitCta.support && (
                  <Typography sx={{ fontSize: "0.88rem", color: "#E8C76F", lineHeight: 1.6, mb: 2 }}>
                    {inline(article.kitCta.support)}
                  </Typography>
                )}
                <Button
                  component={Link}
                  href={article.kitCta.href}
                  disableElevation
                  endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    "&&": {
                      bgcolor: GOLD_BRIGHT,
                      color: INK,
                      fontWeight: 800,
                      fontSize: "0.92rem",
                      textTransform: "none",
                      px: 3,
                      py: 1.25,
                      borderRadius: 999,
                    },
                    "&&:hover": { bgcolor: "#E4B95F", color: INK },
                  }}
                >
                  {article.kitCta.label ?? BLOG_CTA_LABEL}
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Related articles — capped to the same centered width as the
            TOC + article pair above so the whole page sits on one axis. */}
        {related.length > 0 && <RelatedRail articles={related} />}
      </Container>

      <Footer />
    </Box>
  );
}

/**
 * "Keep reading" — a compact horizontal rail (3 cards visible on desktop)
 * with side arrows, instead of a full grid that swallows the page.
 */
function RelatedRail({ articles }: { articles: BlogArticle[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };
  const arrowSx = {
    width: 38,
    height: 38,
    border: `1px solid ${LINE}`,
    bgcolor: "#FFFFFF",
    color: INK,
    "&:hover": { bgcolor: "#FFFFFF", borderColor: GOLD_BRIGHT, color: GOLD },
  } as const;
  return (
    <Box sx={{ pb: { xs: 6, md: 8 }, maxWidth: 986, mx: "auto" }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2.25 }}>
        <Typography
          component="h2"
          sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.4rem", md: "1.7rem" }, fontWeight: 600, color: INK }}
        >
          Keep reading
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton aria-label="Previous articles" onClick={() => scrollBy(-1)} sx={arrowSx}>
            <ChevronLeftRoundedIcon />
          </IconButton>
          <IconButton aria-label="Next articles" onClick={() => scrollBy(1)} sx={arrowSx}>
            <ChevronRightRoundedIcon />
          </IconButton>
        </Stack>
      </Stack>
      <Box
        ref={ref}
        sx={{
          display: "flex",
          gap: 2.25,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          pb: 1,
          mx: { xs: -2, sm: 0 },
          px: { xs: 2, sm: 0 },
        }}
      >
        {articles.map((a) => (
          <Box
            key={a.slug}
            sx={{ flex: "0 0 auto", width: { xs: 250, sm: 280, md: "calc((100% - 36px) / 3)" }, scrollSnapAlign: "start" }}
          >
            <BlogCard article={a} compact />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
