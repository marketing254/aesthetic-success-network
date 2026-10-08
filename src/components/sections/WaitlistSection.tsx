"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowRight,
  ExternalLink,
  GraduationCap,
  Lock,
  Store,
  User,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  challengeOptions,
  locationOptions,
  memberRoles,
  isOtherOption,
} from "@/lib/content";
import { vendorCategories } from "@/lib/vendorData";

const MotionBox = motion.create(Box);

// Internal value is still "vendor" so the /api/vendor/signup endpoint and
// vendor_applications schema don't have to migrate. The UI label is
// "Partner" everywhere. Same for routes — /vendor/* stay as-is.
type HeroRole = "member" | "vendor" | "expert";

const OTHER = "Other";

// The EXACT copy users accept when they check the SMS box. Persisted
// verbatim on the server so we have an audit trail for TCPA / CASL.
// Update this string in lockstep with the JSX label below — they must match.
const SMS_CONSENT_TEXT =
  "I agree to receive SMS messages from the Aesthetic Success Network, including Hotline replies. Reply STOP to opt out.";

// One ASN Provider Agreement covers experts, partners and expert+partner
// (ASN-SWAP-CANON §5). The page is the primary link; the PDF is offered
// alongside it.
const MEMBER_AGREEMENT_PAGE = "/agreement/member";
const MEMBER_AGREEMENT_PDF = "/agreements/asn-member-agreement.pdf";
const PROVIDER_AGREEMENT_PAGE = "/agreement/provider";
const PROVIDER_AGREEMENT_PDF = "/agreements/asn-provider-agreement.pdf";

const agreementLinkSx = {
  color: "#9B7B3A",
  fontWeight: 700,
  textDecoration: "underline",
  textDecorationColor: "rgba(155,123,58,0.4)",
  textUnderlineOffset: 3,
  display: "inline-flex",
  alignItems: "center",
  gap: 0.4,
} as const;

type WaitlistSectionProps = {
  /**
   * Lock the form to a single role and hide the segmented toggle. Used on
   * /experts and /partners so the same form appears there as on the home
   * page but only shows the relevant fields. Omit to render the full
   * three-tab UX (the home-page behavior).
   */
  lockedRole?: HeroRole;
  /** DOM id used for in-page anchor links (defaults to "waitlist"). */
  sectionId?: string;
};

/**
 * Standalone waitlist form section. Field structure and payload shape are
 * IDENTICAL to the previous hero-embedded version so the Supabase schema and
 * admin reporting continue to work unchanged.
 *
 * When `lockedRole` is set, the segmented toggle is hidden and the form is
 * locked to that role — used to embed the exact same UX on /experts
 * (expert) and /partners (vendor) pages without duplicating the form.
 */
export default function WaitlistSection({ lockedRole, sectionId }: WaitlistSectionProps = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const reduced = useReducedMotion();

  const [role, setRole] = useState<HeroRole>(lockedRole ?? "member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Partner partnership agreement (left checkbox in partner mode).
  const [agreed, setAgreed] = useState(false);
  // Partner authorization (right checkbox in partner mode).
  const [authorized, setAuthorized] = useState(false);
  // Member agreement acceptance (only checkbox in member mode).
  const [memberAgreed, setMemberAgreed] = useState(false);
  // Expert Agreement acceptance — the legally-binding checkbox (Fix 1).
  const [expertAgreementAccepted, setExpertAgreementAccepted] = useState(false);
  // Founding-expert consideration is INTERNAL ONLY for ASN (canon §3): the
  // public form never offers it, but the API field is still sent (false)
  // so the payload shape is unchanged.
  const expertConsidered = false;
  // Cross-role (Fix 3): expert who also wants their company listed as a partner.
  const [expertAlsoPartner, setExpertAlsoPartner] = useState(false);
  // Cross-role (Fix 3): partner who is also an individual expert.
  const [vendorAlsoExpert, setVendorAlsoExpert] = useState(false);
  // SMS consent — required for the Hotline reply flow + announcements.
  // The exact text below is persisted server-side as evidence (TCPA/CASL).
  const [memberSmsConsent, setMemberSmsConsent] = useState(false);
  const [vendorSmsConsent, setVendorSmsConsent] = useState(false);
  const [expertSmsConsent, setExpertSmsConsent] = useState(false);

  // Tracked dropdown values so we can reveal an "Other" text input when
  // the user picks "Other".
  const [vendorCategory, setVendorCategory] = useState("");
  const [memberRoleValue, setMemberRoleValue] = useState("");
  const [memberChallenge, setMemberChallenge] = useState("");

  const isVendor = role === "vendor";
  const isExpert = role === "expert";

  // Pre-select tab from ?role=member|expert|partner (set by the
  // OneNetworkThreeWays CTAs and the public /experts and /partners pages).
  // Skip when `lockedRole` is set — the form is already pinned to a role
  // and we don't want URL params to override the page-locked choice.
  useEffect(() => {
    if (lockedRole) return;
    const r = params?.get("role");
    if (r === "member" || r === "vendor" || r === "expert") {
      setRole(r);
    } else if (r === "partner") {
      // Public-facing alias for the internal "vendor" value.
      setRole("vendor");
    }
  }, [params, lockedRole]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (isVendor && (!agreed || !authorized)) {
      setError("Please confirm both boxes before applying as a partner.");
      return;
    }
    if (isExpert && !expertAgreementAccepted) {
      setError("Please read and agree to the Provider Agreement before applying.");
      return;
    }
    if (!isVendor && !isExpert && !memberAgreed) {
      setError("Please agree to the Member Agreement to join the waitlist.");
      return;
    }

    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const firstName = String(fd.get("firstName") ?? "").trim();
    const lastName = String(fd.get("lastName") ?? "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    // If the user picked "Other" in a dropdown, the typed text replaces
    // the literal "Other" so the saved value is the real answer.
    const resolveOther = (selected: FormDataEntryValue | null, otherText: FormDataEntryValue | null) => {
      const value = String(selected ?? "");
      if (!isOtherOption(value)) return value;
      const typed = String(otherText ?? "").trim();
      return typed || OTHER;
    };

    try {
      if (isVendor) {
        // Vendors go through the dedicated /api/vendor/signup endpoint, which
        // writes to vendor_applications, sends the magic-link email, and
        // returns the application reference id. They land on /vendor/applied,
        // NOT the member thank-you page.
        const vendorPayload = {
          companyName: fd.get("companyName"),
          category: resolveOther(fd.get("category"), fd.get("categoryOther")),
          website: fd.get("website"),
          description: fd.get("description") ?? "",
          memberOffer: String(fd.get("memberOffer") ?? "").trim(),
          contactName: fullName,
          contactEmail: fd.get("email"),
          contactPhone: fd.get("contactPhone"),
          secondaryEmail: fd.get("secondaryEmail") ?? "",
          secondaryPhone: fd.get("secondaryPhone") ?? "",
          signatureName: fd.get("signatureName"),
          signatureTitle: fd.get("signatureTitle"),
          agreedToTerms: agreed,
          confirmedAuthority: authorized,
          alsoExpert: vendorAlsoExpert,
          smsConsent: vendorSmsConsent,
          smsConsentText: vendorSmsConsent ? SMS_CONSENT_TEXT : null,
          smsConsentAt: vendorSmsConsent ? new Date().toISOString() : null,
          planId: "founding",
          source: "landing-vendor-cta",
        };

        const res = await fetch("/api/vendor/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vendorPayload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? "Could not submit your application. Please try again.");
          setSubmitting(false);
          return;
        }
        router.push("/vendor/applied");
        return;
      }

      // Expert application branch — dedicated endpoint + table now
      // (was previously coerced into waitlist_signups with role marker
      // in utm; switched to /api/expert/signup → expert_applications so
      // the team can triage applications separately and the applicant
      // gets the expert-specific confirmation email).
      if (isExpert) {
        const nowIso = new Date().toISOString();
        const expertPayload = {
          fullName,
          email: fd.get("email"),
          phone: fd.get("phone") ?? undefined,
          // Company only carries meaning when they also want a partner listing.
          companyName: expertAlsoPartner
            ? String(fd.get("expertCompanyName") ?? "").trim() || undefined
            : undefined,
          companyOffer: expertAlsoPartner
            ? String(fd.get("expertCompanyOffer") ?? "").trim() || undefined
            : undefined,
          alsoPartner: expertAlsoPartner,
          specialty: String(fd.get("expertSpecialty") ?? "").trim(),
          topics: String(fd.get("expertTopics") ?? "").trim() || undefined,
          website: String(fd.get("expertWebsite") ?? "").trim() || undefined,
          bookingLink: String(fd.get("expertBookingLink") ?? "").trim() || undefined,
          source: lockedRole === "expert" ? "experts-page" : "landing-expert-cta",
          utm: {
            role_label: "expert",
          },
          agreementAccepted: expertAgreementAccepted,
          consideredFounding: expertConsidered,
          agreementAcceptedAt: nowIso,
          smsConsent: expertSmsConsent,
          smsConsentText: expertSmsConsent ? SMS_CONSENT_TEXT : null,
          smsConsentAt: expertSmsConsent ? nowIso : null,
        };
        const res = await fetch("/api/expert/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expertPayload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? "Could not submit your application. Please try again.");
          setSubmitting(false);
          return;
        }
        router.push(`/waitlist/thanks?role=expert${data.duplicate ? "&again=1" : ""}`);
        return;
      }

      // Member signup branch — self-serve. Creates the members row +
      // Supabase auth user, then sends the magic-link sign-in email so
      // the user lands on /upgrade to pick a plan + pay.
      // Admin no longer reviews/activates; they CAN deactivate later
      // from /admin/members.
      const memberPayload = {
        role: "member" as const,
        fullName,
        email: fd.get("email"),
        practiceName: fd.get("practiceName"),
        phone: fd.get("phone"),
        smsConsent: memberSmsConsent,
        smsConsentText: memberSmsConsent ? SMS_CONSENT_TEXT : null,
        smsConsentAt: memberSmsConsent ? new Date().toISOString() : null,
        source: "landing-join",
        // ?ref=CODE → attributes the signup to that expert/partner.
        ref:
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("ref") ?? undefined
            : undefined,
        utm: {
          role_label: resolveOther(fd.get("roleLabel"), fd.get("roleLabelOther")),
          locations: fd.get("locations"),
          biggest_challenge: resolveOther(fd.get("challenge"), fd.get("challengeOther")),
          agreement_type: "member",
          agreement_version: "1.0",
          agreement_accepted_at: new Date().toISOString(),
        },
      };

      const res = await fetch("/api/member/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error ??
            "Couldn't complete signup right now. Please try again.",
        );
        setSubmitting(false);
        return;
      }
      // Pay-first flow: go straight to the plan picker + Stripe checkout.
      // No login/code yet: signup set a short-lived checkout cookie that
      // lets /upgrade + checkout run without a session. They log in AFTER
      // paying. (data.next is "/upgrade".)
      const next = (data as { next?: string })?.next ?? "/upgrade";
      router.push(next);
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <Box
      id={sectionId ?? "waitlist"}
      component="section"
      sx={{
        py: { xs: 7, md: 9 },
        bgcolor: "#F8F5EE",
        borderTop: "1px solid #E7E2D6",
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={1.25} sx={{ textAlign: "center", maxWidth: 620, mx: "auto", mb: { xs: 4, md: 5 } }}>
          <Typography
            sx={{
              color: "#9B7B3A",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {isExpert
              ? "Apply as an expert"
              : isVendor
                ? "Apply as a partner"
                : "Reserve your spot"}
          </Typography>
          <Typography
            variant="h2"
            sx={{
              color: "#1A1A1A",
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.7rem", md: "2.1rem" },
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            {isExpert
              ? "Apply to the expert bench."
              : isVendor
                ? "Become a Founding Partner."
                : "Lock the $29 founding rate."}
          </Typography>
          <Typography sx={{ color: "#52525B", fontSize: { xs: "0.95rem", md: "1.02rem" } }}>
            {isExpert
              ? "Tell us about your expertise. We review every applicant, and the team will be in touch within a few business days."
              : isVendor
                ? "Tell us about your company and the member offer you'll make. We review every applicant."
                : "Takes 60 seconds. You pick your plan on the next step. 30-day money-back guarantee, cancel anytime."}
          </Typography>
        </Stack>

        <MotionBox
          initial={reduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          sx={{
            bgcolor: "#FFFFFF",
            border: "1px solid #E7E2D6",
            borderRadius: 3,
            p: { xs: 2.5, md: 3.5 },
            maxWidth: 620,
            mx: "auto",
            boxShadow: "0 1px 2px rgba(20,20,20,0.04), 0 24px 60px -30px rgba(20,20,20,0.18)",
          }}
        >
          <Box component="form" onSubmit={onSubmit}>
            <Stack spacing={2}>
              {/* Segmented toggle — hidden when the form is locked to a
                  single role (used on /experts and /partners). */}
              {!lockedRole && (
              <Box
                sx={{
                  display: "flex",
                  gap: 0.5,
                  p: 0.5,
                  borderRadius: 1.5,
                  bgcolor: "#F8F5EE",
                  border: "1px solid #E7E2D6",
                }}
              >
                {(["member", "expert", "vendor"] as HeroRole[]).map((r) => {
                  const isActive = role === r;
                  const Icon = r === "member" ? User : r === "expert" ? GraduationCap : Store;
                  const label =
                    r === "member" ? "I'm a practice owner" : r === "expert" ? "I'm an expert" : "I'm a partner";
                  return (
                    <Box
                      key={r}
                      component="button"
                      type="button"
                      onClick={() => {
                        setRole(r);
                        setAgreed(false);
                        setAuthorized(false);
                        setMemberAgreed(false);
                        setExpertAgreementAccepted(false);
                        setExpertAlsoPartner(false);
                        setVendorAlsoExpert(false);
                        setVendorCategory("");
                        setMemberRoleValue("");
                        setMemberChallenge("");
                        setError(null);
                      }}
                      sx={{
                        cursor: "pointer",
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.85,
                        py: 1,
                        border: "none",
                        borderRadius: 1.25,
                        bgcolor: isActive ? "#FFFFFF" : "transparent",
                        color: isActive ? "#1A1A1A" : "#71717A",
                        boxShadow: isActive ? "0 1px 2px rgba(20,20,20,0.08)" : "none",
                        fontSize: "0.86rem",
                        fontWeight: 600,
                        fontFamily: "inherit",
                        transition: "all 200ms ease",
                      }}
                    >
                      <Icon size={14} />
                      {label}
                    </Box>
                  );
                })}
              </Box>
              )}

              <AnimatePresence mode="wait" initial={false}>
                {isVendor ? (
                  <motion.div
                    key="vendor"
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Stack spacing={1.5}>
                      {/* 01 COMPANY */}
                      <SectionLabel num="01" title="Company" />
                      <Grid container spacing={1.25}>
                        <Grid size={{ xs: 12 }}>
                          <CompactField name="companyName" label="Company name" placeholder="Radiance Devices" autoComplete="organization" required />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField name="website" label="Website" placeholder="https://radiancedevices.com" autoComplete="url" required />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField
                            name="category"
                            label="Category"
                            select
                            value={vendorCategory}
                            onChange={(e) => setVendorCategory(e.target.value)}
                            required
                          >
                            <MenuItem value="" disabled>Choose</MenuItem>
                            {vendorCategories.map((c) => (
                              <MenuItem key={c} value={c}>{c}</MenuItem>
                            ))}
                          </CompactField>
                        </Grid>
                        {isOtherOption(vendorCategory) && (
                          <Grid size={{ xs: 12 }}>
                            <CompactField
                              name="categoryOther"
                              label="Tell us your category"
                              placeholder="e.g. Medical-director services"
                              required
                            />
                          </Grid>
                        )}
                        <Grid size={{ xs: 12 }}>
                          <CompactField
                            name="description"
                            label="What does your company do, in one sentence?"
                            placeholder="One sentence on what you do"
                            multiline
                            minRows={2}
                            required
                          />
                        </Grid>
                        {/* Fix 2: the member offer the page header promises. */}
                        <Grid size={{ xs: 12 }}>
                          <CompactField
                            name="memberOffer"
                            label="Your exclusive member offer"
                            placeholder="e.g. 15% off your first year, or a free consultation. You can refine this with us later."
                            multiline
                            minRows={2}
                            required
                          />
                        </Grid>
                      </Grid>

                      {/* 02 CONTACT: primary + secondary email and phone */}
                      <SectionLabel num="02" title="Contact" />
                      <Grid container spacing={1.25}>
                        <Grid size={{ xs: 6 }}>
                          <CompactField name="firstName" label="First name" placeholder="Taylor" autoComplete="given-name" required />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <CompactField name="lastName" label="Last name" placeholder="Morgan" autoComplete="family-name" required />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField name="email" type="email" label="Primary work email" placeholder="taylor@radiancedevices.com" autoComplete="email" required />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField name="secondaryEmail" type="email" label="Secondary email (optional)" placeholder="partners@radiancedevices.com" autoComplete="email" />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField name="contactPhone" type="tel" label="Primary phone" placeholder="+1 (555) 010-1234" autoComplete="tel" required />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField name="secondaryPhone" type="tel" label="Secondary phone (optional)" placeholder="+1 (555) 010-5678" autoComplete="tel" />
                        </Grid>
                      </Grid>

                      {/* 03 SIGN */}
                      <SectionLabel num="03" title="Sign on behalf of the company" />
                      <Grid container spacing={1.25}>
                        <Grid size={{ xs: 12, sm: 7 }}>
                          <CompactField name="signatureName" label="Signer full name" placeholder="Taylor Morgan" autoComplete="name" required />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 5 }}>
                          <CompactField name="signatureTitle" label="Signer title" placeholder="VP of Partnerships" autoComplete="organization-title" required />
                        </Grid>
                      </Grid>

                      {/* Cross-role (Fix 3): partner who's also an individual expert */}
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={vendorAlsoExpert}
                            onChange={(e) => setVendorAlsoExpert(e.target.checked)}
                            size="small"
                            sx={{
                              color: "#A8A29E",
                              "&.Mui-checked": { color: "#9B7B3A" },
                              p: 0.5,
                              mr: 0.5,
                            }}
                          />
                        }
                        label={
                          <Typography sx={{ fontSize: "0.8rem", color: "#52525B", lineHeight: 1.5 }}>
                            I&apos;m also an individual expert who&apos;d like to contribute content.
                          </Typography>
                        }
                        sx={{ alignItems: "flex-start", m: 0, mt: 1 }}
                      />

                      {/* Dual checkboxes */}
                      <Stack spacing={1.25} sx={{ mt: 1 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={agreed}
                              onChange={(e) => setAgreed(e.target.checked)}
                              size="small"
                              sx={{
                                color: "#A8A29E",
                                "&.Mui-checked": { color: "#9B7B3A" },
                                p: 0.5,
                                mr: 0.5,
                              }}
                            />
                          }
                          label={
                            <Typography sx={{ fontSize: "0.8rem", color: "#52525B", lineHeight: 1.5 }}>
                              I have read and agree to the{" "}
                              <Box component={Link} href={PROVIDER_AGREEMENT_PAGE} target="_blank" rel="noopener" sx={agreementLinkSx}>
                                Provider Agreement
                                <ExternalLink size={11} />
                              </Box>
                              {" "}(
                              <Box component="a" href={PROVIDER_AGREEMENT_PDF} target="_blank" rel="noopener" sx={agreementLinkSx}>
                                PDF
                              </Box>
                              ).
                            </Typography>
                          }
                          sx={{ alignItems: "flex-start", m: 0 }}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={authorized}
                              onChange={(e) => setAuthorized(e.target.checked)}
                              size="small"
                              sx={{
                                color: "#A8A29E",
                                "&.Mui-checked": { color: "#9B7B3A" },
                                p: 0.5,
                                mr: 0.5,
                              }}
                            />
                          }
                          label={
                            <Typography sx={{ fontSize: "0.8rem", color: "#52525B", lineHeight: 1.5 }}>
                              I confirm I am authorized to commit my company to this partnership
                              and to the member offer above.
                            </Typography>
                          }
                          sx={{ alignItems: "flex-start", m: 0 }}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={vendorSmsConsent}
                              onChange={(e) => setVendorSmsConsent(e.target.checked)}
                              size="small"
                              sx={{
                                color: "#A8A29E",
                                "&.Mui-checked": { color: "#9B7B3A" },
                                p: 0.5,
                                mr: 0.5,
                              }}
                            />
                          }
                          label={
                            <Typography sx={{ fontSize: "0.8rem", color: "#52525B", lineHeight: 1.5 }}>
                              {SMS_CONSENT_TEXT}
                            </Typography>
                          }
                          sx={{ alignItems: "flex-start", m: 0 }}
                        />
                      </Stack>
                    </Stack>
                  </motion.div>
                ) : isExpert ? (
                  <motion.div
                    key="expert"
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Stack spacing={1.5}>
                      <SectionLabel num="01" title="You" />
                      <Grid container spacing={1.25}>
                        <Grid size={{ xs: 6 }}>
                          <CompactField name="firstName" label="First name" placeholder="Dr. Taylor" autoComplete="given-name" required />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <CompactField name="lastName" label="Last name" placeholder="Morgan" autoComplete="family-name" required />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <CompactField name="email" type="email" label="Work email" placeholder="taylor@morganconsulting.com" autoComplete="email" required />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <CompactField name="phone" type="tel" label="Phone (optional)" placeholder="(555) 000-0000" autoComplete="tel" />
                        </Grid>
                      </Grid>

                      <SectionLabel num="02" title="Your expertise" />
                      <Grid container spacing={1.25}>
                        <Grid size={{ xs: 12 }}>
                          <CompactField
                            name="expertSpecialty"
                            label="What do you teach or coach on?"
                            placeholder="e.g. Injectables pricing & margins"
                            required
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <CompactField
                            name="expertTopics"
                            label="Topics you'd record (one per line)"
                            placeholder="One topic per line"
                            multiline
                            minRows={3}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField name="expertWebsite" label="Website (optional)" placeholder="https://morganconsulting.com" autoComplete="url" />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField name="expertBookingLink" label="Booking link (optional)" placeholder="https://cal.com/you/intro" autoComplete="url" />
                        </Grid>
                      </Grid>
                    </Stack>

                    {/* Cross-role (Fix 3): expert who also lists their company */}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={expertAlsoPartner}
                          onChange={(e) => setExpertAlsoPartner(e.target.checked)}
                          size="small"
                          sx={{
                            color: "#A8A29E",
                            "&.Mui-checked": { color: "#9B7B3A" },
                            p: 0.5,
                            mr: 0.5,
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: "0.8rem", color: "#52525B", lineHeight: 1.5 }}>
                          I&apos;d also like to list my company as a partner.
                        </Typography>
                      }
                      sx={{ alignItems: "flex-start", m: 0, mt: 1.5 }}
                    />
                    {expertAlsoPartner && (
                      <Grid container spacing={1.25} sx={{ mt: 0.25, pl: 3.5 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField
                            name="expertCompanyName"
                            label="Company name"
                            placeholder="Morgan Consulting"
                            autoComplete="organization"
                            required
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <CompactField
                            name="expertCompanyOffer"
                            label="What does it offer practices?"
                            placeholder="e.g. 10% off practice-management software for members"
                          />
                        </Grid>
                      </Grid>
                    )}

                    {/* Provider Agreement: the binding checkbox (Fix 1) */}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={expertAgreementAccepted}
                          onChange={(e) => setExpertAgreementAccepted(e.target.checked)}
                          size="small"
                          sx={{
                            color: "#A8A29E",
                            "&.Mui-checked": { color: "#9B7B3A" },
                            p: 0.5,
                            mr: 0.5,
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: "0.8rem", color: "#52525B", lineHeight: 1.5 }}>
                          I have read and agree to the{" "}
                          <Box component={Link} href={PROVIDER_AGREEMENT_PAGE} target="_blank" rel="noopener" sx={agreementLinkSx}>
                            Provider Agreement
                            <ExternalLink size={11} />
                          </Box>
                          {" "}(
                          <Box component="a" href={PROVIDER_AGREEMENT_PDF} target="_blank" rel="noopener" sx={agreementLinkSx}>
                            PDF
                          </Box>
                          ).
                        </Typography>
                      }
                      sx={{ alignItems: "flex-start", m: 0, mt: 1.5 }}
                    />

                    {/* The "Consider me as a Founding Expert" checkbox is
                        deliberately absent: founding experts are invite-only
                        (ASN-SWAP-CANON §3). */}

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={expertSmsConsent}
                          onChange={(e) => setExpertSmsConsent(e.target.checked)}
                          size="small"
                          sx={{
                            color: "#A8A29E",
                            "&.Mui-checked": { color: "#9B7B3A" },
                            p: 0.5,
                            mr: 0.5,
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: "0.8rem", color: "#52525B", lineHeight: 1.5 }}>
                          {SMS_CONSENT_TEXT}
                        </Typography>
                      }
                      sx={{ alignItems: "flex-start", m: 0, mt: 1 }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="member"
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Grid container spacing={1.25}>
                      <Grid size={{ xs: 6 }}>
                        <CompactField name="firstName" label="First name" placeholder="Dr. Taylor" autoComplete="given-name" required />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <CompactField name="lastName" label="Last name" placeholder="Morgan" autoComplete="family-name" required />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <CompactField name="email" type="email" label="Work email" placeholder="taylor@practice.com" autoComplete="email" required />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <CompactField
                          name="roleLabel"
                          label="What best describes your role?"
                          select
                          value={memberRoleValue}
                          onChange={(e) => setMemberRoleValue(e.target.value)}
                        >
                          <MenuItem value="" disabled>Choose one</MenuItem>
                          {memberRoles.map((r) => (
                            <MenuItem key={r} value={r}>{r}</MenuItem>
                          ))}
                        </CompactField>
                      </Grid>
                      {isOtherOption(memberRoleValue) && (
                        <Grid size={{ xs: 12 }}>
                          <CompactField
                            name="roleLabelOther"
                            label="Tell us your role"
                            placeholder="e.g. Director of Operations"
                            required
                          />
                        </Grid>
                      )}
                      <Grid size={{ xs: 12 }}>
                        <CompactField name="practiceName" label="Practice name" placeholder="Glow Aesthetics" autoComplete="organization" required />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <CompactField name="locations" label="Number of locations" select defaultValue="">
                          <MenuItem value="" disabled>Choose</MenuItem>
                          {locationOptions.map((o) => (
                            <MenuItem key={o} value={o}>{o}</MenuItem>
                          ))}
                        </CompactField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <CompactField name="phone" label="Phone (optional)" placeholder="(555) 000-0000" autoComplete="tel" />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <CompactField
                          name="challenge"
                          label="Biggest challenge right now?"
                          select
                          value={memberChallenge}
                          onChange={(e) => setMemberChallenge(e.target.value)}
                        >
                          <MenuItem value="" disabled>Choose</MenuItem>
                          {challengeOptions.map((c) => (
                            <MenuItem key={c} value={c}>{c}</MenuItem>
                          ))}
                        </CompactField>
                      </Grid>
                      {isOtherOption(memberChallenge) && (
                        <Grid size={{ xs: 12 }}>
                          <CompactField
                            name="challengeOther"
                            label="Describe your biggest challenge"
                            placeholder="e.g. Hiring and keeping a great injector"
                            multiline
                            minRows={2}
                            required
                          />
                        </Grid>
                      )}
                    </Grid>

                    {/* Member Agreement checkbox, required */}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={memberAgreed}
                          onChange={(e) => setMemberAgreed(e.target.checked)}
                          size="small"
                          sx={{
                            color: "#A8A29E",
                            "&.Mui-checked": { color: "#9B7B3A" },
                            p: 0.5,
                            mr: 0.5,
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: "0.8rem", color: "#52525B", lineHeight: 1.5 }}>
                          I agree to the{" "}
                          <Box component={Link} href={MEMBER_AGREEMENT_PAGE} target="_blank" rel="noopener" sx={agreementLinkSx}>
                            Member Agreement
                            <ExternalLink size={11} />
                          </Box>
                          {" "}(
                          <Box component="a" href={MEMBER_AGREEMENT_PDF} target="_blank" rel="noopener" sx={agreementLinkSx}>
                            PDF
                          </Box>
                          ) and to receive launch updates from the Aesthetic Success Network.
                        </Typography>
                      }
                      sx={{ alignItems: "flex-start", m: 0, mt: 1.5 }}
                    />

                    {/* SMS consent: optional but stored verbatim if checked */}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={memberSmsConsent}
                          onChange={(e) => setMemberSmsConsent(e.target.checked)}
                          size="small"
                          sx={{
                            color: "#A8A29E",
                            "&.Mui-checked": { color: "#9B7B3A" },
                            p: 0.5,
                            mr: 0.5,
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: "0.8rem", color: "#52525B", lineHeight: 1.5 }}>
                          {SMS_CONSENT_TEXT}
                        </Typography>
                      }
                      sx={{ alignItems: "flex-start", m: 0, mt: 1 }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <Typography
                  role="alert"
                  sx={{
                    color: "#991B1B",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    bgcolor: "#FEF2F2",
                    border: "1px solid #FECACA",
                    borderRadius: 1.5,
                    px: 1.25,
                    py: 0.85,
                  }}
                >
                  {error}
                </Typography>
              )}

              <Button
                type="submit"
                disabled={
                  submitting ||
                  (isVendor
                    ? !agreed || !authorized
                    : isExpert
                      ? !expertAgreementAccepted
                      : !memberAgreed)
                }
                fullWidth
                endIcon={
                  submitting ? (
                    <CircularProgress size={15} thickness={5} sx={{ color: "#FFFFFF" }} />
                  ) : (
                    <ArrowRight size={16} />
                  )
                }
                sx={{
                  py: 1.4,
                  fontSize: "0.94rem",
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                  bgcolor: "#1A1A1A !important",
                  backgroundImage: "none !important",
                  color: "#FFFFFF !important",
                  letterSpacing: "-0.005em",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  "&:hover": {
                    bgcolor: "#2A2A2A !important",
                    backgroundImage: "none !important",
                    color: "#FFFFFF !important",
                  },
                  "&.Mui-disabled": {
                    bgcolor: "#E7E2D6 !important",
                    backgroundImage: "none !important",
                    color: "#A8A29E !important",
                  },
                }}
              >
                {submitting
                  ? "Sending…"
                  : isVendor
                    ? "Apply as a partner"
                    : isExpert
                      ? "Apply as an expert"
                      : "Reserve my founding spot"}
              </Button>

              <Stack direction="row" spacing={0.65} sx={{ alignItems: "center", justifyContent: "center", color: "#71717A" }}>
                <Lock size={11} />
                <Typography sx={{ color: "#71717A", fontSize: "0.74rem" }}>
                  {isVendor || isExpert
                    ? "We review every application · no payment to apply"
                    : "30-day money-back guarantee · cancel anytime"}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </MotionBox>
      </Container>
    </Box>
  );
}

function SectionLabel({ num, title }: { num: string; title: string }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 0.5 }}>
      <Typography
        sx={{
          color: "#9B7B3A",
          fontSize: "0.7rem",
          fontWeight: 700,
          fontFamily: "var(--font-display)",
          letterSpacing: "0.04em",
        }}
      >
        {num}
      </Typography>
      <Typography
        sx={{ color: "#1A1A1A", fontSize: "0.76rem", fontWeight: 600, letterSpacing: "-0.005em" }}
      >
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: "#E7E2D6" }} />
    </Stack>
  );
}

type FieldProps = React.ComponentProps<typeof TextField> & { label: string };

function CompactField({ label, name, ...props }: FieldProps) {
  return (
    <TextField
      {...props}
      name={name}
      label={label}
      variant="outlined"
      fullWidth
      size="small"
      slotProps={{
        inputLabel: {
          shrink: true,
          sx: {
            color: "#52525B",
            fontWeight: 600,
            fontSize: "0.78rem",
            "&.MuiInputLabel-shrink": {
              transform: "translate(12px, -7px) scale(0.85)",
            },
            "&.Mui-focused": { color: "#1A1A1A" },
          },
        },
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          bgcolor: "#FFFFFF",
          color: "#1A1A1A",
          minHeight: 42,
          borderRadius: 1.5,
          transition: "border-color 180ms ease, box-shadow 180ms ease",
          "& fieldset": { borderColor: "#E7E2D6", borderWidth: 1 },
          "&:hover fieldset": { borderColor: "#D4CDB8" },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(155,123,58,0.14)" },
          "&.Mui-focused fieldset": { borderColor: "#9B7B3A", borderWidth: 1.5 },
        },
        "& .MuiOutlinedInput-input": {
          color: "#1A1A1A",
          fontSize: "0.9rem",
          fontWeight: 500,
          py: 1.1,
          "&::placeholder": {
            color: "#A8A29E",
            opacity: 1,
            fontSize: "0.84rem",
          },
        },
        "& .MuiSelect-select": { py: "11px !important" },
      }}
    />
  );
}
