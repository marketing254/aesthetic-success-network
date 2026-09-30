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
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import {
  vendorAgreementKeyTerms,
  vendorAgreementMeta,
  vendorAgreementSections,
  vendorCommitments,
} from "@/lib/vendorData";
import { normalizeVendorPlan, vendorRamp } from "@/lib/vendorPricing";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { fetchCurrentVendor } from "@/lib/supabase/vendorQueries";
import type { VendorsRow } from "@/lib/supabase/types";
import { PageHeader, SectionCard, StatCard, listHeadSx, portalText } from "@/components/vendor/PortalUI";
import { CP } from "@/components/shared/CommunityPortalShell";

const INK = CP.ink;
const MUTED = CP.muted;
const LINE = CP.border;

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
      <Stack sx={{ alignItems: "center", py: 10, gap: 2 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  const signedAt = vendor?.agreement_signed_at?.slice(0, 10) ?? "Not signed yet";
  const version = vendor?.agreement_version ?? "v1.0";
  // Schedule A comes from the company's own plan (vendors.billing_plan):
  // website ladder, founding ladder ($39 then $149) or founding flat ($39).
  const ramp = vendorRamp(normalizeVendorPlan(vendor?.billing_plan));
  const feeSchedule = ramp.rows.map((r) => ({ period: r.label, fee: r.price, note: r.note }));
  // The price tiles in the key terms band follow the same ramp; the
  // non-price tiles (commitment, notice) come from vendorData unchanged.
  const keyTerms = [
    ...ramp.rows.map((r) => ({
      label: r.label,
      value: r.price,
      sub: r.price === "$0" ? "Waived" : "per month",
    })),
    ...vendorAgreementKeyTerms.filter((t) => !t.value.startsWith("$")),
  ];
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Provider agreement"
        subtitle="Read-only copy of the signed ASN Provider Agreement. The full PDF was emailed to your contact at signup."
      />

      {/* Signature meta card */}
      <SectionCard accent padding="default">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", minWidth: 0 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: CP.white,
                color: CP.gold,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                boxShadow: CP.shadow,
              }}
            >
              <VerifiedRoundedIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ ...portalText.sectionTitle, mb: 0.25 }}>{vendorAgreementMeta.title}</Typography>
              <Typography sx={{ ...portalText.meta, mb: 0.5 }}>{vendorAgreementMeta.tagline}</Typography>
              <Typography sx={portalText.body}>
                Click-to-signed by your authorized representative on {signedAt}, version {version}
              </Typography>
            </Box>
          </Stack>
          <Chip size="small" color="success" label="Agreement in force" sx={{ flexShrink: 0 }} />
        </Stack>
      </SectionCard>

      {/* Key terms */}
      <Grid container spacing={3}>
        {keyTerms.map((t) => (
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
                p: 2.25,
                borderRadius: "12px",
                border: `1px solid ${LINE}`,
                bgcolor: CP.sandSoft,
                display: "grid",
                gridTemplateColumns: "36px 1fr",
                gap: 2,
                alignItems: "flex-start",
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  bgcolor: CP.navy,
                  color: CP.gold,
                  display: "grid",
                  placeItems: "center",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {c.number}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", letterSpacing: "-0.01em", color: INK, mb: 0.25 }}>
                  {c.title}
                </Typography>
                <Typography sx={portalText.body}>{c.body}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </SectionCard>

      {/* Fee schedule */}
      <SectionCard title="Fee schedule" subtitle={`Schedule A: ${ramp.summary}`} padding="none">
        <Box
          sx={{
            ...(listHeadSx as object),
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1.6fr",
            px: 0,
            py: 0,
          }}
        >
          {["Period", "Monthly fee", "Note"].map((h) => (
            <Box key={h} sx={{ px: 3, py: 1.25, textAlign: h === "Monthly fee" ? "right" : "left" }}>
              {h}
            </Box>
          ))}
        </Box>
        {feeSchedule.map((row, i) => (
          <Box
            key={row.period}
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.6fr",
              borderTop: i === 0 ? 0 : `1px solid ${LINE}`,
              alignItems: "center",
              minHeight: 56,
              transition: "background-color 120ms ease",
              "&:hover": { bgcolor: CP.sandSoft },
            }}
          >
            <Box sx={{ px: 3, py: 1.5, fontSize: "0.875rem", fontWeight: 600, color: INK }}>
              {row.period}
            </Box>
            <Box
              sx={{
                px: 3,
                py: 1.5,
                fontSize: "0.875rem",
                fontWeight: 700,
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
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, letterSpacing: "-0.01em", mb: 0.75, color: INK }}>
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
