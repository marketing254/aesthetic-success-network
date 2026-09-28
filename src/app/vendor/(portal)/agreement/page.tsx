"use client";
import { useEffect, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import {
  vendorAgreementKeyTerms,
  vendorAgreementMeta,
  vendorAgreementSections,
  vendorCommitments,
  vendorFeeSchedule,
} from "@/lib/vendorData";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { fetchCurrentVendor } from "@/lib/supabase/vendorQueries";
import type { VendorsRow } from "@/lib/supabase/types";
import { PageHeader, SectionCard, StatCard, portalText } from "@/components/vendor/PortalUI";

const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const SOFT = "#F3F4F6";
const HOVER = "#F9FAFB";

export default function VendorAgreementPage() {
  const [vendor, setVendor] = useState<VendorsRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();
    (async () => {
      const v = await fetchCurrentVendor(supabase);
      if (!active) return;
      setVendor(v);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 8, gap: 2 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  const signedAt = vendor?.agreement_signed_at?.slice(0, 10) ?? "Not signed yet";
  const version = vendor?.agreement_version ?? "v1.0";
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Provider agreement"
        subtitle="Read-only copy of the signed ASN Provider Agreement. The full PDF was emailed to your contact at signup."
      />

      {/* Signature meta card */}
      <SectionCard padding="default">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" } }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ ...portalText.sectionTitle, mb: 0.25 }}>{vendorAgreementMeta.title}</Typography>
            <Typography sx={{ ...portalText.meta, mb: 0.75 }}>{vendorAgreementMeta.tagline}</Typography>
            <Typography sx={portalText.body}>
              Click-to-signed by your authorized representative on {signedAt}, version {version}
            </Typography>
          </Box>
          <Chip size="small" color="success" label="Agreement in force" sx={{ flexShrink: 0 }} />
        </Stack>
      </SectionCard>

      {/* Key terms */}
      <Grid container spacing={3}>
        {vendorAgreementKeyTerms.map((t) => (
          <Grid key={t.label} size={{ xs: 6, sm: 4, lg: 2.4 }}>
            <StatCard label={t.label} value={t.value} footer={t.sub} />
          </Grid>
        ))}
      </Grid>

      {/* The five commitments */}
      <SectionCard title="The five commitments" subtitle="What you agreed to as a company" padding="default">
        <Stack spacing={1.5}>
          {vendorCommitments.map((c) => (
            <Box
              key={c.number}
              sx={{
                p: 2,
                borderRadius: "6px",
                border: `1px solid ${LINE}`,
                display: "grid",
                gridTemplateColumns: "32px 1fr",
                gap: 2,
                alignItems: "flex-start",
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "6px",
                  bgcolor: SOFT,
                  color: MUTED,
                  display: "grid",
                  placeItems: "center",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {c.number}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: INK, mb: 0.25 }}>
                  {c.title}
                </Typography>
                <Typography sx={portalText.body}>{c.body}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </SectionCard>

      {/* Fee schedule */}
      <SectionCard title="Fee schedule" subtitle="Schedule A" padding="none">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1.6fr",
            borderBottom: `1px solid ${LINE}`,
            fontSize: "0.75rem",
            fontWeight: 600,
            color: MUTED,
            letterSpacing: 0,
            textTransform: "none",
          }}
        >
          {["Period", "Monthly fee", "Note"].map((h) => (
            <Box key={h} sx={{ px: 3, py: 1.25, textAlign: h === "Monthly fee" ? "right" : "left" }}>
              {h}
            </Box>
          ))}
        </Box>
        {vendorFeeSchedule.map((row, i) => (
          <Box
            key={row.period}
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.6fr",
              borderTop: i === 0 ? 0 : `1px solid ${LINE}`,
              alignItems: "center",
              "&:hover": { bgcolor: HOVER },
            }}
          >
            <Box sx={{ px: 3, py: 1.5, fontSize: "0.875rem", fontWeight: 500, color: INK }}>
              {row.period}
            </Box>
            <Box
              sx={{
                px: 3,
                py: 1.5,
                fontSize: "0.875rem",
                fontWeight: 600,
                color: INK,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {row.fee}
            </Box>
            <Box sx={{ px: 3, py: 1.5, fontSize: "0.8125rem", color: MUTED }}>
              {row.note}
            </Box>
          </Box>
        ))}
      </SectionCard>

      {/* Full operational + legal sections */}
      <SectionCard
        title="Operational and legal terms"
        subtitle="Sections 01 to 09"
        padding="default"
        action={<Chip size="small" label={vendorAgreementMeta.version} />}
      >
        <Stack spacing={3} divider={<Box sx={{ borderTop: `1px solid ${LINE}` }} />}>
          {vendorAgreementSections.map((s) => (
            <Box key={s.id}>
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, mb: 0.75, color: INK }}>
                {s.number}. {s.title}
              </Typography>
              <Typography sx={{ ...portalText.body, lineHeight: 1.7 }}>{s.body}</Typography>
            </Box>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
