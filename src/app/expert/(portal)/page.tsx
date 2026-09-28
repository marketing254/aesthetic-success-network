"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ExpertsRow } from "@/lib/supabase/types";
import ReferralCard from "@/components/shared/ReferralCard";
import { PageHeader, SectionCard, StatCard } from "@/components/vendor/PortalUI";

const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const NAVY = "#0E2A3D";

export default function ExpertDashboardPage() {
  const [expert, setExpert] = useState<ExpertsRow | null>(null);
  const [resourceCount, setResourceCount] = useState<number | null>(null);
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

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 12 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  const firstName = (expert?.display_name ?? expert?.full_name ?? "there")
    .trim()
    .split(/\s+/)[0];
  const activated = expert?.activated_at ? new Date(expert.activated_at) : null;
  const daysSinceJoin = activated
    ? Math.max(0, Math.floor((Date.now() - activated.getTime()) / 86_400_000))
    : null;

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

      {/* Referral link: share to bring aesthetic practice owners in */}
      <ReferralCard endpoint="/api/expert/referral" />

      {/* Quick stats row */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 3,
        }}
      >
        <StatCard
          label="Resources uploaded"
          value={resourceCount?.toString() ?? "0"}
          footer={
            resourceCount === 0
              ? "Add your first one"
              : resourceCount === 1
                ? "One in the library"
                : `${resourceCount} in the library`
          }
        />
        <StatCard label="Member views" value="0" footer="Tracking starts soon" />
        <StatCard label="Inquiries" value="0" footer="None yet" />
        <StatCard
          label="Status"
          value={expert?.status === "active" ? "Active" : "Pending"}
          footer={
            activated
              ? `Since ${activated.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : undefined
          }
        />
      </Box>

      {/* Primary CTA: complete the public profile */}
      <SectionCard>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
        >
          <Box>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, mb: 0.5 }}>
              Set up your public profile
            </Typography>
            <Typography sx={{ color: BODY, fontSize: "0.875rem", lineHeight: 1.6, maxWidth: 560 }}>
              Members see your bio, photo, and booking link before they reach out. A complete profile gets ~3× the inquiries.
            </Typography>
          </Box>
          <Button
            variant="contained"
            component={Link}
            href="/expert/profile"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", md: "center" } }}
          >
            Complete profile
          </Button>
        </Stack>
      </SectionCard>

      {/* Section cards: direct links to the main areas */}
      <Box>
        <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK, mb: 2 }}>Get started</Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
          }}
        >
          <LinkCard
            icon={UploadFileOutlinedIcon}
            title="Your library"
            body="See every kit the ASN content team has published in your voice. New work shows up automatically, with no upload step on your side."
            href="/expert/resources"
            cta="View your library"
          />
          <LinkCard
            icon={InsightsOutlinedIcon}
            title="Track inquiries"
            body="See which members opened your resources and who's inquired about working with you. Coming soon."
            href="/expert/inquiries"
            cta="See inquiries"
            comingSoon
          />
          <LinkCard
            icon={ChatBubbleOutlineOutlinedIcon}
            title="Post updates"
            body="Write short status updates that appear in member and company feeds. Members can comment and react. Coming soon."
            href="/expert/posts"
            cta="Write a post"
            comingSoon
          />
          <LinkCard
            icon={ManageAccountsOutlinedIcon}
            title="Public profile"
            body="Your bio, photo, booking link, and topics: the way members and companies see you in the directory."
            href="/expert/profile"
            cta="Edit profile"
          />
        </Box>
      </Box>

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

function LinkCard({
  icon: Icon,
  title,
  body,
  href,
  cta,
  comingSoon,
}: {
  icon: React.ElementType<{ sx?: object }>;
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
        display: "block",
        p: 3,
        borderRadius: "8px",
        border: `1px solid ${LINE}`,
        bgcolor: "#FFFFFF",
        textDecoration: "none",
        transition: "border-color 120ms ease",
        "&:hover": { borderColor: "#D1D5DB" },
        "&:hover .link-card-cta": { textDecoration: "underline" },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", mb: 2 }}>
        <Icon sx={{ fontSize: 20, color: MUTED, flexShrink: 0, mt: 0.25 }} />
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: INK }}>{title}</Typography>
            {comingSoon && <Chip label="Soon" size="small" />}
          </Stack>
          <Typography sx={{ color: BODY, fontSize: "0.875rem", lineHeight: 1.6 }}>{body}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
        <Typography className="link-card-cta" sx={{ fontSize: "0.875rem", fontWeight: 500, color: NAVY }}>
          {cta}
        </Typography>
        <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: NAVY }} />
      </Stack>
    </Box>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Box>
      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: MUTED, mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ color: INK, fontSize: "0.875rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{value}</Typography>
    </Box>
  );
}
