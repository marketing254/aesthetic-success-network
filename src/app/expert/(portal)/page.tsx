"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ExpertsRow } from "@/lib/supabase/types";
import ReferralCard from "@/components/shared/ReferralCard";
import { EP, StatusTint } from "@/components/shared/TopNavPortalShell";
import { ListDivider, PageHeader, SectionCard, StatCard, TagPill, portalText } from "@/components/vendor/PortalUI";

type RecentInquiry = {
  id: string;
  author_display_name: string;
  resource_topic_title: string | null;
  resource_title: string | null;
  body: string;
  status: "open" | "answered" | "closed";
  created_at: string;
};

/** Which parts of the public profile are filled in, for the completeness meter. */
function profileChecks(e: ExpertsRow | null): { label: string; done: boolean }[] {
  return [
    { label: "Name", done: !!(e?.display_name ?? e?.full_name) },
    { label: "Headshot", done: !!e?.headshot_url },
    { label: "Specialty", done: !!e?.specialty },
    { label: "Bio", done: !!e?.bio },
    { label: "Topics", done: !!e?.topics },
    { label: "Booking link", done: !!e?.booking_link },
    { label: "Website", done: !!e?.website },
  ];
}

export default function ExpertDashboardPage() {
  const [expert, setExpert] = useState<ExpertsRow | null>(null);
  const [resourceCount, setResourceCount] = useState<number | null>(null);
  const [inquiries, setInquiries] = useState<RecentInquiry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email?.toLowerCase();
      if (!email) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("experts")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (!active) return;
      setExpert(data);

      if (data?.id) {
        const { count } = await supabase
          .from("expert_resources")
          .select("id", { count: "exact", head: true })
          .eq("expert_id", data.id);
        if (active) setResourceCount(count ?? 0);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Recent inquiries for the overview list. Same inbox the Inquiries
  // page reads; a failure here just leaves the list empty.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/expert/inquiries?status=all&limit=5", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setInquiries([]);
          return;
        }
        const body = (await res.json()) as { inquiries?: RecentInquiry[] };
        if (active) setInquiries(body.inquiries ?? []);
      } catch {
        if (active) setInquiries([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 12 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  const name = (expert?.display_name ?? expert?.full_name ?? "Expert").trim();
  const firstName = name.split(/\s+/)[0] || "there";
  const activated = expert?.activated_at ? new Date(expert.activated_at) : null;
  const daysSinceJoin = activated
    ? Math.max(0, Math.floor((Date.now() - activated.getTime()) / 86_400_000))
    : null;
  const isFounding = !!expert?.billing_exempt;
  const isActive = expert?.status === "active";
  const checks = profileChecks(expert);
  const doneCount = checks.filter((c) => c.done).length;
  const completeness = Math.round((doneCount / checks.length) * 100);
  const profileComplete = completeness === 100;
  const missing = checks.filter((c) => !c.done).map((c) => c.label);
  const openInquiries = (inquiries ?? []).filter((i) => i.status === "open").length;
  const hasLibrary = (resourceCount ?? 0) > 0;

  return (
    <Stack spacing={3}>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle={
          daysSinceJoin === null
            ? "Your portal is live. The ASN content team produces and publishes your kits on your behalf. Keep an eye on your library and the inquiries inbox."
            : daysSinceJoin === 0
              ? "Your portal is live today. Take a look around. The content team will publish your first kit shortly."
              : `Day ${daysSinceJoin} on the bench. Members are starting to find your kits. Check your inquiries inbox.`
        }
      />

      {/* Welcome banner: bronze tint, headshot left, identity + completeness, espresso CTA */}
      <Box
        sx={{
          borderRadius: `${EP.radius}px`,
          bgcolor: EP.bronzeTint,
          border: "1px solid rgba(176,122,44,0.25)",
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 3.5 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "auto minmax(0, 1fr) auto" },
          gap: { xs: 2.5, md: 3.5 },
          alignItems: "center",
        }}
      >
        <Avatar
          src={expert?.headshot_url ?? undefined}
          sx={{
            width: { xs: 72, md: 96 },
            height: { xs: 72, md: 96 },
            bgcolor: EP.espresso,
            color: EP.ivory,
            fontSize: { xs: "1.375rem", md: "1.75rem" },
            fontWeight: 700,
            border: `4px solid ${EP.white}`,
            boxShadow: EP.shadow,
          }}
        >
          {initialsOf(name)}
        </Avatar>

        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
            <Typography sx={{ fontSize: { xs: "1.25rem", md: "1.5rem" }, fontWeight: 800, letterSpacing: "-0.025em", color: EP.espresso, lineHeight: 1.2 }}>
              {name}
            </Typography>
            {isFounding && <FoundingBadge />}
            <StatusTint label={isActive ? "Active" : "Pending"} tone={isActive ? "live" : "pending"} size="sm" />
          </Stack>
          <Typography sx={{ fontSize: "0.9375rem", color: EP.body, mt: 0.5, lineHeight: 1.5 }}>
            {expert?.specialty || "Add your specialty so members know what you teach."}
          </Typography>

          {/* Completeness bar in bronze */}
          <Box sx={{ mt: 2, maxWidth: 520 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 0.75 }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: EP.espresso }}>Profile completeness</Typography>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: EP.bronzeDeep, fontVariantNumeric: "tabular-nums" }}>
                {completeness}%
              </Typography>
            </Stack>
            <Box sx={{ height: 8, borderRadius: 999, bgcolor: "rgba(255,255,255,0.75)", overflow: "hidden" }}>
              <Box sx={{ width: `${completeness}%`, height: "100%", borderRadius: 999, bgcolor: EP.bronze, transition: "width 300ms ease" }} />
            </Box>
            <Typography sx={{ fontSize: "0.75rem", color: EP.muted, mt: 0.75, lineHeight: 1.5 }}>
              {profileComplete
                ? `All ${checks.length} sections filled in. Members see the full picture.`
                : `${doneCount} of ${checks.length} sections done. Missing: ${missing.join(", ")}.`}
            </Typography>
          </Box>
        </Box>

        <Button
          component={Link}
          href="/expert/profile"
          variant="contained"
          endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", md: "center" } }}
        >
          {profileComplete ? "Edit profile" : "Complete profile"}
        </Button>
      </Box>

      {/* Stat row, 4 across */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 3 }}>
        <StatCard
          icon={UploadFileOutlinedIcon}
          label="Kits in your library"
          value={resourceCount?.toString() ?? "0"}
          footer={
            resourceCount === 0
              ? "The content team publishes your first one"
              : resourceCount === 1
                ? "One in the library"
                : `${resourceCount} in the library`
          }
        />
        <StatCard icon={VisibilityOutlinedIcon} label="Member views" value="0" footer="Tracking starts soon" />
        <StatCard
          icon={ChatBubbleOutlineOutlinedIcon}
          label="Inquiries waiting"
          value={String(openInquiries)}
          footer={inquiries === null ? "Loading" : openInquiries === 0 ? "None waiting" : "Members are waiting on a reply"}
        />
        <StatCard
          icon={VerifiedRoundedIcon}
          label="Status"
          value={isActive ? "Active" : "Pending"}
          footer={
            activated
              ? `Since ${activated.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : "Awaiting activation"
          }
        />
      </Box>

      {/* Two columns: recent inquiries and the checklist */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3, alignItems: "stretch" }}>
        <SectionCard
          title="Recent inquiries"
          subtitle="Questions members posted on your kits"
          padding="none"
          sx={{ height: "100%" }}
          action={
            <Button component={Link} href="/expert/inquiries" size="small" variant="text" endIcon={<ChevronRightRoundedIcon sx={{ fontSize: 16 }} />}>
              All inquiries
            </Button>
          }
        >
          {inquiries === null ? (
            <Stack sx={{ alignItems: "center", py: 4 }}>
              <CircularProgress size={22} />
            </Stack>
          ) : inquiries.length === 0 ? (
            <Box sx={{ px: 3, py: 5, textAlign: "center" }}>
              <Typography sx={{ ...portalText.body, color: EP.muted }}>
                No inquiries yet. When a member asks a question on one of your kits, it shows up here.
              </Typography>
            </Box>
          ) : (
            <Stack divider={<ListDivider />}>
              {inquiries.map((inq) => (
                <Box
                  key={inq.id}
                  component={Link}
                  href="/expert/inquiries"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 1.5,
                    alignItems: "center",
                    minHeight: 56,
                    px: 3,
                    py: 1.5,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "background-color 120ms ease",
                    "&:hover": { bgcolor: EP.bronzeTint },
                  }}
                >
                  <Avatar sx={{ width: 32, height: 32, bgcolor: EP.bronzeTint, color: EP.bronzeDeep, fontSize: "0.75rem", fontWeight: 700 }}>
                    {initialsOf(inq.author_display_name)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: EP.ink }} noWrap>
                        {inq.author_display_name}
                      </Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: EP.muted, flexShrink: 0 }}>{formatRelative(inq.created_at)}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: "0.8125rem", color: EP.body }} noWrap>
                      {inq.resource_topic_title ? `${inq.resource_topic_title}: ` : ""}
                      {inq.body}
                    </Typography>
                  </Box>
                  <StatusTint
                    label={inq.status === "open" ? "Needs reply" : inq.status === "answered" ? "Answered" : "Closed"}
                    tone={inq.status === "open" ? "pending" : inq.status === "answered" ? "live" : "off"}
                    size="sm"
                  />
                </Box>
              ))}
            </Stack>
          )}
        </SectionCard>

        <SectionCard title="Get started" subtitle="Four steps that get members booking with you" padding="none" sx={{ height: "100%" }}>
          <Stack divider={<ListDivider />}>
            <ChecklistRow
              icon={ManageAccountsOutlinedIcon}
              done={profileComplete}
              title="Complete your public profile"
              body="Your bio, headshot, booking link and topics: the way members and companies see you in the directory."
              href="/expert/profile"
              cta={profileComplete ? "Edit profile" : "Complete profile"}
            />
            <ChecklistRow
              icon={UploadFileOutlinedIcon}
              done={hasLibrary}
              title="See your library"
              body="Every kit the ASN content team has published in your voice. New work shows up automatically, with no upload step on your side."
              href="/expert/resources"
              cta="View your library"
            />
            <ChecklistRow
              icon={InsightsOutlinedIcon}
              done={false}
              title="Track inquiries"
              body="See which members opened your resources and who has inquired about working with you. Coming soon."
              href="/expert/inquiries"
              cta="See inquiries"
              comingSoon
            />
            <ChecklistRow
              icon={ChatBubbleOutlineOutlinedIcon}
              done={false}
              title="Post updates"
              body="Write short status updates that appear in member and company feeds. Members can comment and react. Coming soon."
              href="/expert/posts"
              cta="Write a post"
              comingSoon
            />
          </Stack>
        </SectionCard>
      </Box>

      {/* Referral link: share to bring aesthetic practice owners in */}
      <ReferralCard endpoint="/api/expert/referral" />

      {/* From your application snapshot */}
      {expert && (
        <SectionCard title="From your application">
          <Stack spacing={2}>
            <Field label="Your topic" value={expert.specialty} />
            {expert.topics && <Field label="Topics you proposed" value={expert.topics} />}
            {expert.website && <Field label="Website" value={expert.website} />}
            {expert.booking_link && <Field label="Booking link" value={expert.booking_link} />}
          </Stack>
        </SectionCard>
      )}
    </Stack>
  );
}

/** Gold stays only here: the founding badge. */
function FoundingBadge() {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.1,
        height: 24,
        borderRadius: "8px",
        bgcolor: EP.goldTint,
        color: EP.goldText,
        fontSize: "0.75rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
        border: "1px solid rgba(217,168,75,0.45)",
      }}
    >
      <WorkspacePremiumRoundedIcon sx={{ fontSize: 14, color: EP.gold }} />
      Founding expert
    </Box>
  );
}

function ChecklistRow({
  icon: Icon,
  done,
  title,
  body,
  href,
  cta,
  comingSoon,
}: {
  icon: React.ElementType<{ sx?: object }>;
  done: boolean;
  title: string;
  body: string;
  href: string;
  cta: string;
  comingSoon?: boolean;
}) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 1.5,
        alignItems: "flex-start",
        px: 3,
        py: 2,
        textDecoration: "none",
        color: "inherit",
        transition: "background-color 120ms ease",
        "&:hover": { bgcolor: EP.bronzeTint },
        "&:hover .checklist-cta": { textDecoration: "underline" },
      }}
    >
      {done ? (
        <CheckCircleRoundedIcon sx={{ fontSize: 22, color: EP.liveFg, mt: 0.1 }} />
      ) : (
        <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 22, color: EP.faint, mt: 0.1 }} />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
          <Icon sx={{ fontSize: 16, color: EP.bronze }} />
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: EP.espresso, letterSpacing: "-0.01em" }}>{title}</Typography>
          {comingSoon && <TagPill label="Soon" size="sm" />}
        </Stack>
        <Typography sx={{ fontSize: "0.8125rem", color: EP.muted, lineHeight: 1.55, mt: 0.25 }}>{body}</Typography>
        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5, mt: 0.75 }}>
          <Typography className="checklist-cta" sx={{ fontSize: "0.8125rem", fontWeight: 600, color: EP.bronzeDeep }}>
            {cta}
          </Typography>
          <ArrowForwardRoundedIcon sx={{ fontSize: 15, color: EP.bronzeDeep }} />
        </Stack>
      </Box>
    </Box>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Box>
      <Typography sx={{ ...portalText.eyebrow, mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ color: EP.ink, fontSize: "0.875rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{value}</Typography>
    </Box>
  );
}

function initialsOf(name: string): string {
  const t = (name ?? "").trim();
  if (!t) return "EX";
  const parts = t.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
