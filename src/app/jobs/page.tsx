import type { Metadata } from "next";
import Link from "next/link";
import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import JsonLd from "@/components/seo/JsonLd";
import JobFilters from "@/components/jobs/JobFilters";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  JOB_ROLES,
  employmentLabel,
  isEmploymentType,
  isJobRole,
  roleLabel,
  workplaceLabel,
} from "@/lib/jobs/constants";
import { formatPay, postedAgo } from "@/lib/jobs/format";
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

export const metadata: Metadata = {
  title: "Aesthetic practice jobs: injector, aesthetician, coordinator and front desk roles",
  description:
    "Aesthetic practice and med spa jobs posted by member practices across the US. Every listing shows its pay range. Free to browse, no account needed.",
  alternates: { canonical: "/jobs" },
  openGraph: {
    type: "website",
    title: "Aesthetic practice jobs | Aesthetic Success Network",
    description:
      "Injector, aesthetician, coordinator and front desk roles at US aesthetic practices and med spas. Every listing shows its pay range.",
  },
};

type Search = { role?: string; location?: string; type?: string };

type BoardJob = Pick<
  JobPostsRow,
  | "id"
  | "slug"
  | "practice_name"
  | "role"
  | "role_other"
  | "employment_type"
  | "location"
  | "workplace"
  | "pay_min"
  | "pay_max"
  | "pay_unit"
  | "approved_at"
  | "promoted_facebook_at"
  | "promoted_email_at"
>;

/**
 * /jobs — the PUBLIC board. No login, no paywall, no account.
 *
 * This is the most important rule in the whole feature and it is easy to
 * "tidy up" by mistake: browsing must stay open. Job seekers will never
 * pay to look for a job, and members-only browsing means no candidates,
 * which means no applicants, which means members stop posting and the
 * feature dies inside a month. Posting is what sits behind the paywall.
 *
 * Server-rendered on purpose. The filters live in the URL so a filtered
 * view is linkable and crawlable, and so the listings are in the HTML on
 * first byte rather than arriving after a client fetch.
 */
export default async function JobsBoardPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  // Ignore anything not in the fixed vocabularies rather than passing it
  // to Postgres — an invalid enum value in a filter is a 500, and this
  // URL is public and will get fuzzed.
  const role = isJobRole(sp.role) ? sp.role : null;
  const employmentType = isEmploymentType(sp.type) ? sp.type : null;
  const location = (sp.location ?? "").trim().slice(0, 80) || null;

  const sb = getSupabaseAdmin();
  let query = sb
    .from("job_posts")
    // One literal string, not a concatenation: supabase-js infers the row
    // type from the literal, and splitting it across lines with `+` widens
    // it to `string` and loses every column type.
    .select("id, slug, practice_name, role, role_other, employment_type, location, workplace, pay_min, pay_max, pay_unit, approved_at, promoted_facebook_at, promoted_email_at")
    .eq("status", "live")
    .order("approved_at", { ascending: false })
    .limit(100);

  if (role) query = query.eq("role", role);
  if (employmentType) query = query.eq("employment_type", employmentType);
  // Free-text location match. ilike over a trigram index would be better
  // at scale; at phase-1 volume this is fine and avoids a new extension.
  if (location) query = query.ilike("location", `%${location}%`);

  // The unfiltered board feeds the hero numbers and the "browse by role"
  // list, so a filtered view still shows what else is on the board.
  const [{ data }, { data: allLive }] = await Promise.all([
    query,
    sb.from("job_posts").select("role, practice_name").eq("status", "live").limit(500),
  ]);
  const jobs: BoardJob[] = data ?? [];
  const board = allLive ?? [];
  const totalLive = board.length;
  const practicesHiring = new Set(board.map((j) => j.practice_name.trim().toLowerCase())).size;
  const roleCounts = new Map<string, number>();
  for (const j of board) roleCounts.set(j.role, (roleCounts.get(j.role) ?? 0) + 1);
  const rolesWithJobs = JOB_ROLES.filter((r) => (roleCounts.get(r.value) ?? 0) > 0);

  // An ItemList of the visible jobs helps Google understand this as a
  // listing page. The per-job JobPosting markup lives on each job page,
  // which is what actually feeds Google for Jobs.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: jobs.slice(0, 25).map((job, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://www.aestheticsuccessnetwork.com/jobs/${job.slug}`,
      name: `${roleLabel(job.role, job.role_other)}, ${job.location}`,
    })),
  };

  const filtered = Boolean(role || employmentType || location);
  const activeFilters: { label: string; href: string }[] = [];
  if (role) {
    activeFilters.push({ label: roleLabel(role, null), href: buildHref({ type: employmentType, location }) });
  }
  if (employmentType) {
    activeFilters.push({ label: employmentLabel(employmentType), href: buildHref({ role, location }) });
  }
  if (location) {
    activeFilters.push({ label: `"${location}"`, href: buildHref({ role, type: employmentType }) });
  }

  return (
    <>
      <Header />
      <JsonLd data={itemListJsonLd} />

      <Box component="main" sx={{ bgcolor: "#F7F5F0", pb: 10 }}>
        {/* ── Hero band ─────────────────────────────────────────────── */}
        <Box
          sx={{
            bgcolor: NAVY,
            color: "#fff",
            pt: { xs: 9, md: 11 },
            pb: { xs: 7, md: 8 },
            backgroundImage:
              "radial-gradient(900px 420px at 85% 10%, rgba(160,120,35,0.22), transparent 60%)",
          }}
        >
          <Container maxWidth="lg">
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.4fr) minmax(0, 1fr)" },
                gap: { xs: 4, md: 6 },
                alignItems: "center",
              }}
            >
              <Stack spacing={2}>
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.22em",
                    color: "#F0C16E",
                    textTransform: "uppercase",
                  }}
                >
                  ASN job board
                </Typography>
                <Typography
                  component="h1"
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: { xs: "2.3rem", md: "3.4rem" },
                    fontWeight: 500,
                    color: "#fff",
                    lineHeight: 1.05,
                    letterSpacing: "-0.025em",
                    maxWidth: 640,
                  }}
                >
                  Jobs at aesthetic practices worth working for
                </Typography>
                <Typography
                  sx={{ color: "rgba(255,255,255,0.8)", maxWidth: 560, lineHeight: 1.7, fontSize: "1.05rem" }}
                >
                  Posted by member practices across the US. Every listing shows its pay range.
                  That is a rule, not a preference. Free to browse, and you don&apos;t need an
                  account.
                </Typography>
              </Stack>

              {/* Counters stay hidden until the first real listing is live: a
                  zero next to "100%" reads as a broken page. */}
              {totalLive > 0 ? (
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1.5 }}>
                  <Stat value={String(totalLive)} label={totalLive === 1 ? "open role" : "open roles"} />
                  <Stat
                    value={String(practicesHiring)}
                    label={practicesHiring === 1 ? "practice hiring" : "practices hiring"}
                  />
                  <Stat value="100%" label="show pay" />
                </Box>
              ) : null}
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          {/* ── Search bar, overlapping the hero ──────────────────────── */}
          <Box
            sx={{
              mt: { xs: -4, md: -5 },
              bgcolor: "#fff",
              border: `1px solid ${LINE}`,
              borderRadius: 3,
              p: { xs: 2, md: 2.5 },
              boxShadow: "0 18px 40px rgba(10,26,47,0.10)",
            }}
          >
            <JobFilters role={sp.role ?? ""} location={sp.location ?? ""} type={sp.type ?? ""} />
          </Box>

          {/* ── Results + sidebar ─────────────────────────────────────── */}
          <Box
            sx={{
              mt: 4,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 320px" },
              gap: 4,
              alignItems: "start",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  rowGap: 1,
                  mb: 2,
                }}
              >
                <Typography component="h2" sx={{ fontWeight: 700, color: INK, fontSize: "1.05rem" }}>
                  {jobs.length === 0
                    ? "No matching roles"
                    : `${jobs.length} ${jobs.length === 1 ? "role" : "roles"}${filtered ? " match" : " open"}`}
                </Typography>
                <Typography sx={{ color: INK_MUTED, fontSize: "0.85rem" }}>Newest first</Typography>
              </Stack>

              {activeFilters.length > 0 ? (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mb: 2, flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
                >
                  {activeFilters.map((f) => (
                    <Chip
                      key={f.label}
                      label={`${f.label} ×`}
                      component="a"
                      href={f.href}
                      clickable
                      sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, color: INK_SOFT, fontWeight: 600 }}
                    />
                  ))}
                  <Link
                    href="/jobs"
                    style={{ color: GOLD, fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}
                  >
                    Clear all
                  </Link>
                </Stack>
              ) : null}

              {jobs.length === 0 ? (
                <Box
                  sx={{
                    border: `1px dashed ${LINE}`,
                    borderRadius: 3,
                    p: { xs: 4, md: 6 },
                    textAlign: "center",
                    bgcolor: "#fff",
                  }}
                >
                  <Typography sx={{ fontWeight: 600, color: INK, mb: 1 }}>
                    {filtered ? "No jobs match that search yet" : "No jobs on the board right now"}
                  </Typography>
                  <Typography sx={{ color: INK_MUTED, maxWidth: 420, mx: "auto", lineHeight: 1.7 }}>
                    {filtered ? (
                      <>
                        Try widening it:{" "}
                        <Link href="/jobs" style={{ color: GOLD }}>
                          see every open role
                        </Link>
                        .
                      </>
                    ) : (
                      "New roles go up as member practices post them. Check back soon."
                    )}
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </Stack>
              )}
            </Box>

            <Box
              component="aside"
              sx={{ position: { md: "sticky" }, top: { md: 96 }, display: "grid", gap: 2 }}
            >
              <SeekerCard />
              {rolesWithJobs.length > 0 ? (
                <SideCard title="Browse by role">
                  <Stack component="ul" sx={{ listStyle: "none", m: 0, p: 0 }} spacing={0.25}>
                    {rolesWithJobs.map((r) => {
                      const active = role === r.value;
                      return (
                        <Box component="li" key={r.value}>
                          <Link
                            href={
                              active
                                ? buildHref({ type: employmentType, location })
                                : buildHref({ role: r.value, type: employmentType, location })
                            }
                            style={{ textDecoration: "none" }}
                          >
                            <Stack
                              direction="row"
                              sx={{
                                justifyContent: "space-between",
                                alignItems: "center",
                                px: 1.25,
                                py: 0.9,
                                borderRadius: 2,
                                bgcolor: active ? GOLD_SOFT : "transparent",
                                color: active ? GOLD : INK_SOFT,
                                fontSize: "0.92rem",
                                fontWeight: active ? 700 : 500,
                                "&:hover": { bgcolor: GOLD_SOFT },
                              }}
                            >
                              <span>{r.label}</span>
                              <Box
                                component="span"
                                sx={{ color: INK_MUTED, fontSize: "0.8rem", fontWeight: 600 }}
                              >
                                {roleCounts.get(r.value)}
                              </Box>
                            </Stack>
                          </Link>
                        </Box>
                      );
                    })}
                  </Stack>
                </SideCard>
              ) : null}
              <PostYourOwn />
            </Box>
          </Box>
        </Container>
      </Box>

      <Footer />
    </>
  );
}

function buildHref(f: { role?: string | null; type?: string | null; location?: string | null }) {
  const params = new URLSearchParams();
  if (f.role) params.set("role", f.role);
  if (f.location) params.set("location", f.location);
  if (f.type) params.set("type", f.type);
  const qs = params.toString();
  return qs ? `/jobs?${qs}` : "/jobs";
}

/** Posted within the last three days. */
function isNewPost(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return true;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return now.getTime() - then <= 3 * 86_400_000;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.14)",
        bgcolor: "rgba(255,255,255,0.06)",
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.5, md: 2 },
      }}
    >
      <Typography
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: { xs: "1.6rem", md: "2rem" },
          lineHeight: 1,
          color: "#F0C16E",
        }}
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.75)", mt: 0.75, lineHeight: 1.3 }}>
        {label}
      </Typography>
    </Box>
  );
}

function JobCard({ job }: { job: BoardJob }) {
  const promoted = Boolean(job.promoted_facebook_at || job.promoted_email_at);
  const isNew = isNewPost(job.approved_at);
  const pay = formatPay(job.pay_min, job.pay_max, job.pay_unit);
  const hasPay = job.pay_min !== null && job.pay_max !== null;

  return (
    <Link href={`/jobs/${job.slug}`} style={{ display: "block", textDecoration: "none" }}>
      <Box
        sx={{
          border: `1px solid ${LINE}`,
          borderRadius: 3,
          bgcolor: "#fff",
          p: { xs: 2.25, sm: 3 },
          transition: "border-color 140ms, box-shadow 140ms, transform 140ms",
          "&:hover": {
            borderColor: GOLD,
            boxShadow: "0 12px 28px rgba(10,26,47,0.08)",
            transform: "translateY(-2px)",
          },
          "&:hover .cta": { color: GOLD },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) auto" },
            gap: { xs: 1.5, sm: 3 },
            alignItems: "start",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5, mb: 0.75 }}
            >
              <Typography
                component="h3"
                sx={{ fontWeight: 700, fontSize: "1.15rem", color: INK, lineHeight: 1.25 }}
              >
                {roleLabel(job.role, job.role_other)}
              </Typography>
              {isNew ? <Tag label="New" tone="gold" /> : null}
              {promoted ? <Tag label="Promoted" tone="green" /> : null}
            </Stack>

            <Stack
              direction="row"
              sx={{
                flexWrap: "wrap",
                columnGap: 2,
                rowGap: 0.5,
                color: INK_SOFT,
                fontSize: "0.92rem",
                alignItems: "center",
              }}
            >
              <Meta icon={<BusinessOutlinedIcon sx={{ fontSize: 17 }} />} text={job.practice_name} />
              <Meta
                icon={<PlaceOutlinedIcon sx={{ fontSize: 17 }} />}
                text={job.workplace === "remote" ? "Remote" : job.location}
              />
              <Meta
                icon={<ScheduleOutlinedIcon sx={{ fontSize: 17 }} />}
                text={postedAgo(job.approved_at)}
                muted
              />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 1.75, flexWrap: "wrap", rowGap: 1 }}>
              <Pill label={employmentLabel(job.employment_type)} />
              {job.workplace !== "onsite" ? <Pill label={workplaceLabel(job.workplace)} /> : null}
              {/* Pay pill on mobile; the right-hand block carries it on wider screens. */}
              <Box sx={{ display: { xs: "block", sm: "none" } }}>
                <Pill label={pay} strong={hasPay} />
              </Box>
            </Stack>
          </Box>

          <Box
            sx={{
              display: { xs: "none", sm: "flex" },
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "space-between",
              alignSelf: "stretch",
              minWidth: 160,
              textAlign: "right",
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: INK_MUTED,
                }}
              >
                Pay
              </Typography>
              <Typography
                sx={{
                  fontWeight: 700,
                  color: hasPay ? INK : INK_MUTED,
                  fontSize: hasPay ? "1.02rem" : "0.9rem",
                  lineHeight: 1.3,
                  mt: 0.25,
                  maxWidth: 200,
                }}
              >
                {pay}
              </Typography>
            </Box>
            <Typography
              className="cta"
              sx={{
                mt: 2,
                fontSize: "0.88rem",
                fontWeight: 700,
                color: INK_SOFT,
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                transition: "color 140ms",
              }}
            >
              View role <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
            </Typography>
          </Box>
        </Box>
      </Box>
    </Link>
  );
}

function Meta({ icon, text, muted }: { icon: React.ReactNode; text: string; muted?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        color: muted ? INK_MUTED : "inherit",
      }}
    >
      <Box component="span" sx={{ display: "inline-flex", color: INK_MUTED }}>
        {icon}
      </Box>
      {text}
    </Box>
  );
}

function Pill({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 1.25,
        py: 0.4,
        borderRadius: 999,
        fontSize: "0.8rem",
        fontWeight: 600,
        bgcolor: strong ? GOLD_SOFT : "#F3F1EC",
        color: strong ? GOLD : INK_SOFT,
      }}
    >
      {label}
    </Box>
  );
}

function Tag({ label, tone }: { label: string; tone: "gold" | "green" }) {
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
        bgcolor: tone === "gold" ? GOLD_SOFT : "#E4F1E4",
        color: tone === "gold" ? GOLD : "#1B5E20",
      }}
    >
      {label}
    </Box>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: "#fff", border: `1px solid ${LINE}`, borderRadius: 3, p: 2.5 }}>
      <Typography
        sx={{
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: GOLD,
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/**
 * The job-seeker account is free and exists so an applicant becomes
 * someone we can contact and someone who can track their applications.
 */
function SeekerCard() {
  return (
    <SideCard title="For job seekers">
      <Typography sx={{ fontWeight: 700, color: INK, mb: 0.75 }}>
        Apply in one click, track every application
      </Typography>
      <Typography sx={{ color: INK_MUTED, fontSize: "0.9rem", lineHeight: 1.65, mb: 2 }}>
        A free account saves your details and CV, and shows you where each application got to.
      </Typography>
      <Stack spacing={1}>
        <Button
          href="/seeker/join"
          variant="contained"
          fullWidth
          sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, borderRadius: 2 }}
        >
          Create a free account
        </Button>
        <Button href="/seeker/login" fullWidth sx={{ color: INK_SOFT, borderRadius: 2 }}>
          I already have one
        </Button>
      </Stack>
    </SideCard>
  );
}

/**
 * The quiet join link. It's here because a hiring practice reading the
 * board is a live prospect, and because an injector who lands here from
 * Google is a second audience arriving for free.
 */
function PostYourOwn() {
  return (
    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: NAVY, color: "#fff" }}>
      <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", mb: 1, lineHeight: 1.2, color: "#fff" }}>
        Hiring for your own practice?
      </Typography>
      <Typography sx={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.65, fontSize: "0.9rem", mb: 2 }}>
        Members post a vacancy here and it gets its own public page, written so Google can list it
        as a job. Included in membership, and it replaces a paid job board.
      </Typography>
      <Link
        href="/pricing"
        style={{ color: "#F0C16E", fontWeight: 600, textDecoration: "none", fontSize: "0.92rem" }}
      >
        See what membership includes →
      </Link>
    </Box>
  );
}
