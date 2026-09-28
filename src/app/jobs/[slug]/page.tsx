import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import JsonLd from "@/components/seo/JsonLd";
import JobViewBeacon from "@/components/jobs/JobViewBeacon";
import JobApplyPanel from "@/components/jobs/JobApplyPanel";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { employmentLabel, roleLabel, workplaceLabel } from "@/lib/jobs/constants";
import { bannerPublicUrl, formatPay, postedAgo } from "@/lib/jobs/format";
import { jobBreadcrumbJsonLd, jobPostingJsonLd } from "@/lib/jobs/jsonLd";
import { jobTextBlocks } from "@/lib/jobs/richText";
import type { JobPostsRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const GOLD_SOFT = "#FBF3E1";
const LINE = "#E6DDCF";
const NAVY = "#0E2A3D";

type RelatedJob = Pick<
  JobPostsRow,
  "id" | "slug" | "practice_name" | "role" | "role_other" | "location" | "workplace" | "pay_min" | "pay_max" | "pay_unit" | "approved_at"
>;

async function loadJob(slug: string): Promise<JobPostsRow | null> {
  const sb = getSupabaseAdmin();
  // `select("*")` rather than a column list: supabase-js only infers row
  // types from a string LITERAL, and this page needs nearly every column
  // for the JobPosting markup anyway.
  const { data } = await sb.from("job_posts").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const job = data;
  // Live and filled stay reachable; a filled post keeps its URL working
  // for anyone following a link we already promoted, and says so.
  // Draft, pending, rejected and expired are not public.
  if (job.status !== "live" && job.status !== "filled") return null;
  return job;
}

/**
 * Up to three other live roles, same role first. Keeps a candidate on
 * the board instead of bouncing back to Google when one role isn't
 * quite right.
 */
async function loadRelated(job: JobPostsRow): Promise<RelatedJob[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("job_posts")
    .select("id, slug, practice_name, role, role_other, location, workplace, pay_min, pay_max, pay_unit, approved_at")
    .eq("status", "live")
    .neq("id", job.id)
    .order("approved_at", { ascending: false })
    .limit(12);
  const rows: RelatedJob[] = data ?? [];
  return [...rows.filter((r) => r.role === job.role), ...rows.filter((r) => r.role !== job.role)].slice(0, 3);
}

function startLabel(job: JobPostsRow): string {
  if (job.start_flexible) return "Flexible";
  if (job.start_date) {
    return new Date(`${job.start_date}T00:00:00`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  return "Not specified";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await loadJob(slug);
  if (!job) return { title: "Job not found" };

  const title = `${roleLabel(job.role, job.role_other)} at ${job.practice_name}, ${job.location}`;
  // Lead the snippet with pay. It's the differentiator and it's what
  // earns the click out of a search results page. A banner post may
  // have no typed description (0061) — fall back rather than crash.
  const summary = job.description
    ? job.description.slice(0, 120).trim()
    : `See the banner for details on this ${roleLabel(job.role, job.role_other)} role`;
  const description = `${formatPay(job.pay_min, job.pay_max, job.pay_unit)} · ${employmentLabel(
    job.employment_type,
  )} · ${job.location}. ${summary}…`;

  return {
    title,
    description,
    alternates: { canonical: `/jobs/${job.slug}` },
    openGraph: { type: "article", title, description },
    // A filled post should stop competing in search but keep working for
    // anyone who follows an existing link.
    robots: job.status === "filled" ? { index: false, follow: true } : undefined,
  };
}

/**
 * /jobs/[slug] — one public job page.
 *
 * This page is the point of the whole build: it carries the schema.org
 * JobPosting markup that puts a member's vacancy into Google for Jobs,
 * which is free distribution on top of the group promotion.
 *
 * No auth. Anyone can read this, including people who have never heard
 * of ASN — which is the second prize: injectors and front desk staff
 * arrive looking for work and find the network.
 */
export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await loadJob(slug);
  if (!job) notFound();

  const filled = job.status === "filled";
  const bannerUrl = job.post_format === "banner" ? bannerPublicUrl(job.banner_path) : null;
  const related = await loadRelated(job);
  const title = roleLabel(job.role, job.role_other);
  const pay = formatPay(job.pay_min, job.pay_max, job.pay_unit);
  const hasPay = job.pay_min !== null && job.pay_max !== null;

  return (
    <>
      <Header />
      {/* Structured data is server-rendered into the HTML so crawlers
          see it on first byte. Do not move this to a client effect.

          A FILLED post drops its JobPosting markup and keeps only the
          breadcrumb. Google's job posting policy is that the markup goes
          away when the role does, and `validThrough` is still in the
          future on a job filled early, so leaving the markup up would
          claim an open role that isn't. The page itself stays reachable
          (and noindex, see generateMetadata) so links we already
          promoted to the group keep working. */}
      <JsonLd
        data={
          filled
            ? jobBreadcrumbJsonLd(job)
            : [jobPostingJsonLd(job), jobBreadcrumbJsonLd(job)]
        }
      />
      <JobViewBeacon slug={job.slug} />

      <Box component="main" sx={{ bgcolor: "#F7F5F0", pb: 10 }}>
        {/* ── Title band ────────────────────────────────────────────── */}
        <Box sx={{ bgcolor: "#fff", borderBottom: `1px solid ${LINE}`, pt: { xs: 7, md: 9 }, pb: { xs: 3.5, md: 4.5 } }}>
          <Container maxWidth="lg">
            <Stack
              direction="row"
              component="nav"
              aria-label="Breadcrumb"
              spacing={1}
              sx={{ alignItems: "center", color: INK_MUTED, fontSize: "0.85rem", mb: 2.5, flexWrap: "wrap" }}
            >
              <Link href="/jobs" style={{ color: INK_MUTED, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> All aesthetic practice jobs
              </Link>
              <span>/</span>
              <Box component="span" sx={{ color: INK_SOFT, fontWeight: 600 }}>{title}</Box>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
                gap: { xs: 2.5, md: 4 },
                alignItems: "end",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1, mb: 1.25 }}>
                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: GOLD,
                    }}
                  >
                    {job.practice_name}
                  </Typography>
                  {filled ? <Badge label="Role filled" tone="amber" /> : null}
                </Stack>
                <Typography
                  component="h1"
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: { xs: "2rem", md: "2.9rem" },
                    fontWeight: 500,
                    color: INK,
                    lineHeight: 1.08,
                    letterSpacing: "-0.025em",
                  }}
                >
                  {title}
                </Typography>

                <Stack
                  direction="row"
                  sx={{ mt: 2, flexWrap: "wrap", columnGap: 2.5, rowGap: 1, color: INK_SOFT, fontSize: "0.95rem" }}
                >
                  <Meta icon={<PlaceOutlinedIcon sx={{ fontSize: 18 }} />} text={job.location} />
                  <Meta icon={<WorkOutlineRoundedIcon sx={{ fontSize: 18 }} />} text={employmentLabel(job.employment_type)} />
                  <Meta icon={<BusinessOutlinedIcon sx={{ fontSize: 18 }} />} text={workplaceLabel(job.workplace)} />
                  <Meta icon={<ScheduleOutlinedIcon sx={{ fontSize: 18 }} />} text={postedAgo(job.approved_at)} muted />
                </Stack>
              </Box>

              {/* Pay is the promise this board makes, so it gets the
                  headline slot on the right rather than a row in a table. */}
              <Box
                sx={{
                  bgcolor: GOLD_SOFT,
                  border: `1px solid #F0E2BF`,
                  borderRadius: 3,
                  px: { xs: 2.5, md: 3 },
                  py: { xs: 2, md: 2.25 },
                  minWidth: { md: 260 },
                }}
              >
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD }}>
                  Pay
                </Typography>
                <Typography
                  sx={{
                    fontFamily: hasPay ? "var(--font-display)" : undefined,
                    fontSize: hasPay ? { xs: "1.5rem", md: "1.75rem" } : "1rem",
                    fontWeight: hasPay ? 500 : 600,
                    color: INK,
                    lineHeight: 1.15,
                    mt: 0.5,
                  }}
                >
                  {pay}
                </Typography>
                {!filled ? (
                  <Button
                    href="#apply"
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2, bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, borderRadius: 2, fontWeight: 700 }}
                  >
                    Apply for this role
                  </Button>
                ) : null}
              </Box>
            </Box>
          </Container>
        </Box>

        {/* ── Body + sidebar ─────────────────────────────────────────── */}
        <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 4 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" },
              gap: 4,
              alignItems: "start",
            }}
          >
            <Stack spacing={3} sx={{ minWidth: 0 }}>
              {filled ? (
                <Box sx={{ bgcolor: "#FBF0D6", border: "1px solid #F0DDA8", borderRadius: 3, p: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, color: "#8A6100" }}>This role has been filled</Typography>
                  <Typography sx={{ color: "#8A6100", fontSize: "0.92rem", mt: 0.5 }}>
                    The practice has closed applications.{" "}
                    <Link href="/jobs" style={{ color: "#8A6100", fontWeight: 700 }}>
                      See what else is open
                    </Link>
                    .
                  </Typography>
                </Box>
              ) : null}

              {/* Banner posts lead with the graphic, but the summary text
                  below it is still required and still rendered, it is the
                  only part of a banner post that Google and a screen
                  reader can actually read. */}
              {bannerUrl ? (
                <Card>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bannerUrl}
                    alt={job.banner_alt ?? `${job.practice_name} job advert`}
                    style={{ width: "100%", height: "auto", display: "block", borderRadius: 12 }}
                  />
                </Card>
              ) : null}

              {job.description || job.requirements ? (
                <Card>
                  <Stack spacing={4}>
                    {job.description ? (
                      <Section
                        title={job.post_format === "banner" ? "The role" : "About the role"}
                        body={job.description}
                      />
                    ) : null}
                    {job.requirements ? (
                      <Section title="What they're looking for" body={job.requirements} />
                    ) : null}
                  </Stack>
                </Card>
              ) : null}

              {/* Applying is gated behind a free account so the applicant
                  becomes someone we can contact instead of an anonymous
                  mailto. The panel is a client component because it needs
                  to be, file input, per-field validation, submit states , 
                  and it resolves its own signed-in state, which keeps this
                  server page free of any auth coupling. */}
              {!filled ? (
                <Card id="apply" sx={{ scrollMarginTop: 96, borderColor: "#F0E2BF" }}>
                  <JobApplyPanel
                    slug={job.slug}
                    practiceName={job.practice_name}
                    applyUrl={job.apply_url ?? null}
                    hasApplyEmail={!!job.apply_email}
                    embedded
                  />
                </Card>
              ) : null}

              <Typography sx={{ fontSize: "0.85rem", color: INK_MUTED }}>
                {postedAgo(job.approved_at)} · Posted by a member of the{" "}
                <Link href="/" style={{ color: GOLD, textDecoration: "none" }}>
                  Aesthetic Success Network
                </Link>
              </Typography>
            </Stack>

            <Box component="aside" sx={{ position: { md: "sticky" }, top: { md: 96 }, display: "grid", gap: 2 }}>
              <Card>
                <Eyebrow>At a glance</Eyebrow>
                <Stack spacing={1.75} sx={{ mt: 1.5 }}>
                  <Fact label="Pay" value={pay} strong />
                  <Fact label="Employment type" value={employmentLabel(job.employment_type)} />
                  <Fact label="Workplace" value={workplaceLabel(job.workplace)} />
                  <Fact label="Location" value={job.location} />
                  <Fact label="Start" value={startLabel(job)} />
                  <Fact label="Practice" value={job.practice_name} />
                </Stack>
                {!filled ? (
                  <Button
                    href="#apply"
                    variant="outlined"
                    fullWidth
                    sx={{ mt: 2.5, color: INK, borderColor: INK, borderRadius: 2, fontWeight: 700, "&:hover": { borderColor: INK, bgcolor: "#F3F1EC" } }}
                  >
                    Apply now
                  </Button>
                ) : null}
              </Card>

              {related.length > 0 ? (
                <Card>
                  <Eyebrow>More open roles</Eyebrow>
                  <Stack sx={{ mt: 1 }}>
                    {related.map((r) => (
                      <Link key={r.id} href={`/jobs/${r.slug}`} style={{ textDecoration: "none" }}>
                        <Box
                          sx={{
                            py: 1.5,
                            borderBottom: `1px solid ${LINE}`,
                            "&:last-of-type": { borderBottom: 0, pb: 0 },
                            "&:hover .t": { color: GOLD },
                          }}
                        >
                          <Typography className="t" sx={{ fontWeight: 700, color: INK, fontSize: "0.95rem", transition: "color 120ms" }}>
                            {roleLabel(r.role, r.role_other)}
                          </Typography>
                          <Typography sx={{ color: INK_SOFT, fontSize: "0.85rem", mt: 0.25 }}>
                            {r.practice_name} · {r.workplace === "remote" ? "Remote" : r.location}
                          </Typography>
                          <Typography sx={{ color: INK_MUTED, fontSize: "0.82rem", mt: 0.25, fontWeight: 600 }}>
                            {formatPay(r.pay_min, r.pay_max, r.pay_unit)}
                          </Typography>
                        </Box>
                      </Link>
                    ))}
                  </Stack>
                  <Link
                    href="/jobs"
                    style={{ color: GOLD, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 14 }}
                  >
                    Browse all roles <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
                  </Link>
                </Card>
              ) : null}

              <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: NAVY, color: "#fff" }}>
                <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", mb: 0.75, lineHeight: 1.2, color: "#fff" }}>
                  Running a practice and hiring?
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.6, fontSize: "0.88rem", mb: 1.5 }}>
                  Members post here free, and every post gets a public page built to be found on Google.
                </Typography>
                <Link href="/pricing" style={{ color: "#F0C16E", fontWeight: 600, textDecoration: "none", fontSize: "0.9rem" }}>
                  See what membership includes →
                </Link>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Footer />
    </>
  );
}

function Card({
  children,
  id,
  sx,
}: {
  children: React.ReactNode;
  id?: string;
  sx?: Record<string, unknown>;
}) {
  return (
    <Box
      id={id}
      sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, p: { xs: 2.5, md: 3.5 }, ...sx }}
    >
      {children}
    </Box>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: GOLD }}
    >
      {children}
    </Typography>
  );
}

function Badge({ label, tone }: { label: string; tone: "amber" }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 1,
        py: 0.2,
        borderRadius: 1,
        fontSize: "0.68rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        bgcolor: tone === "amber" ? "#FBF0D6" : GOLD_SOFT,
        color: "#8A6100",
      }}
    >
      {label}
    </Box>
  );
}

function Meta({ icon, text, muted }: { icon: React.ReactNode; text: string; muted?: boolean }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: muted ? INK_MUTED : "inherit" }}>
      <Box component="span" sx={{ display: "inline-flex", color: INK_MUTED }}>
        {icon}
      </Box>
      {text}
    </Box>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box>
      <Typography
        sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: INK_MUTED, mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: strong ? "1.05rem" : "0.95rem", fontWeight: strong ? 700 : 500, color: strong ? INK : INK_SOFT, lineHeight: 1.4 }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Member-authored text rendered as paragraphs and bullet lists.
 *
 * Deliberately NOT dangerouslySetInnerHTML: the form takes plain text,
 * and a public page that renders member HTML is an XSS hole waiting for
 * the first spammer who gets through review. The one piece of formatting
 * we honour — a line starting with "-" is a bullet — is parsed by
 * lib/jobs/richText.ts into React elements here, and into <ul><li> for
 * the JobPosting markup, so the page and the structured data agree.
 */
function Section({ title, body }: { title: string; body: string }) {
  const blocks = jobTextBlocks(body);
  return (
    <Box>
      <Typography
        component="h2"
        sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.35rem", md: "1.55rem" }, fontWeight: 500, color: INK, letterSpacing: "-0.01em", mb: 1.5 }}
      >
        {title}
      </Typography>
      <Stack spacing={1.5}>
        {blocks.map((block, i) =>
          block.kind === "list" ? (
            <Box
              key={i}
              component="ul"
              sx={{ m: 0, pl: 2.5, color: INK_SOFT, lineHeight: 1.8, fontSize: "1rem", "& li": { mb: 0.5, pl: 0.5 }, "& li::marker": { color: GOLD } }}
            >
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </Box>
          ) : (
            <Typography key={i} sx={{ color: INK_SOFT, lineHeight: 1.8, fontSize: "1rem", whiteSpace: "pre-line" }}>
              {block.lines.join("\n")}
            </Typography>
          ),
        )}
      </Stack>
    </Box>
  );
}
