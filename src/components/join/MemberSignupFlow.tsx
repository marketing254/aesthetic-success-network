"use client";
import { trackEvent } from "@/lib/analytics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowLeft, ArrowRight, Check, ExternalLink } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { challengeOptions, heardAboutOptions, locationOptions, memberRoles } from "@/lib/content";

const MotionBox = motion.create(Box);

// Resolved server-side by the page (lib/referralContext) so the
// invitation header is in the first paint; type mirrored here because
// the lib is server-only.
type RefContext = {
  name: string;
  kind: "expert" | "partner" | "team";
  tagline: string | null;
  imageUrl: string | null;
  pairedName: string | null;
  offerActive: boolean;
  offerMonths: number;
};

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => !/^dr\.?$/i.test(w));
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "DM";
}

/** "Jane Smith" → "Jane"; "Dr. Jane Smith" → "Dr. Smith";
 *  companies keep their full name. */
function shortNameOf(ctx: RefContext): string {
  if (ctx.kind === "team") return "the team";
  if (ctx.kind === "partner") return ctx.name;
  const base = (ctx.name.split(",")[0] ?? ctx.name).trim();
  const parts = base.split(/\s+/);
  if (/^dr\.?$/i.test(parts[0] ?? "")) return `Dr. ${parts[parts.length - 1]}`;
  return parts[0] ?? base;
}

const OTHER = "Other";

// Must match WaitlistSection verbatim — this exact copy is persisted
// server-side as the TCPA/CASL audit trail when the box is checked.
const SMS_CONSENT_TEXT =
  "I agree to receive SMS messages from the Aesthetic Success Network, including hotline replies. Reply STOP to opt out.";

const STEPS = [
  { eyebrow: "Step 1 of 3", title: "First, about you." },
  { eyebrow: "Step 2 of 3", title: "Your practice." },
  { eyebrow: "Step 3 of 3", title: "Almost in." },
] as const;

/**
 * Netflix-style member signup — the SAME fields and the SAME
 * /api/member/signup payload as the /join member form, split into three
 * short steps with one clear ask per screen. Email arrives prefilled from
 * the homepage hero (?email=...), ?ref= attribution passes through
 * unchanged, and success continues into the existing pay-first flow
 * (/upgrade → Stripe checkout).
 */
export type LatestJob = { title: string; where: string; pay: string };
export type ReferrerQuoteProp = { quote: string; role: string };

export type SignupPrefill = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  practiceName: string | null;
};

export default function MemberSignupFlow({
  refCtx = null,
  prefill = null,
  latestJob = null,
  quote = null,
}: {
  refCtx?: RefContext | null;
  prefill?: SignupPrefill | null;
  latestJob?: LatestJob | null;
  quote?: ReferrerQuoteProp | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const reduced = useReducedMotion();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 (a ?resume= welcome-back visit arrives with saved details)
  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? params.get("email") ?? "");
  // Step 2
  const [roleLabel, setRoleLabel] = useState("");
  const [roleLabelOther, setRoleLabelOther] = useState("");
  const [practiceName, setPracticeName] = useState(prefill?.practiceName ?? "");
  const [locations, setLocations] = useState("");
  const [phone, setPhone] = useState("");
  // Step 3
  const [challenge, setChallenge] = useState("");
  const [challengeOther, setChallengeOther] = useState("");
  const [heardAbout, setHeardAbout] = useState("");
  const [heardAboutOther, setHeardAboutOther] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  const emailOk = /.+@.+\..+/.test(email.trim());

  const stepValid = useMemo(() => {
    if (step === 0) return firstName.trim() !== "" && lastName.trim() !== "" && emailOk;
    if (step === 1)
      return (
        practiceName.trim() !== "" &&
        (roleLabel !== OTHER || roleLabelOther.trim() !== "")
      );
    return (
      agreed &&
      (challenge !== OTHER || challengeOther.trim() !== "") &&
      (heardAbout !== OTHER || heardAboutOther.trim() !== "")
    );
  }, [step, firstName, lastName, emailOk, practiceName, roleLabel, roleLabelOther, agreed, challenge, challengeOther, heardAbout, heardAboutOther]);

  // Partial-registration capture — the SAME recovery sequence as /start,
  // for anyone who enters a valid email on /join/member and drops off
  // before paying. Fires when the email field blurs, on Continue, and on
  // tab-close (keepalive beacon). The server enforces the 30-day
  // one-sequence rule and skips existing paying members, so a repeat here
  // never restarts or double-sends anything.
  const abandonSnapshot = useRef<string>("");
  const captureAbandon = useCallback(() => {
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return;
    const snap = JSON.stringify([em, firstName, lastName, practiceName, roleLabel]);
    if (abandonSnapshot.current === snap) return;
    abandonSnapshot.current = snap;
    try {
      void fetch("/api/ads/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          email: em,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          practiceName: practiceName.trim() || null,
          role: roleLabel === OTHER ? roleLabelOther.trim() || null : roleLabel || null,
          plan: params.get("interval") === "annual" ? "founding_annual" : "founding_monthly",
          utm: {
            ref: params.get("ref") ?? null,
            promo: params.get("promo") ?? null,
            source: "landing-join",
          },
        }),
      });
    } catch {
      /* capture must never affect the visitor */
    }
  }, [email, firstName, lastName, practiceName, roleLabel, roleLabelOther, params]);

  // Tab-close / navigate-away safety net: capture on the way out too.
  useEffect(() => {
    const onLeave = () => captureAbandon();
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [captureAbandon]);

  const go = (d: 1 | -1) => {
    setError(null);
    // Leaving step 1 forward = they gave us an email; snapshot it now.
    if (d === 1 && step === 0) captureAbandon();
    setDir(d);
    setStep((s) => Math.min(2, Math.max(0, s + d)));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const resolveOther = (v: string, other: string) => (v === OTHER ? other.trim() : v || null);
    try {
      const res = await fetch("/api/member/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "member" as const,
          fullName,
          email: email.trim(),
          practiceName: practiceName.trim(),
          phone: phone.trim() || null,
          smsConsent,
          smsConsentText: smsConsent ? SMS_CONSENT_TEXT : null,
          smsConsentAt: smsConsent ? new Date().toISOString() : null,
          source: "landing-join",
          ref: params.get("ref") ?? undefined,
          utm: {
            role_label: resolveOther(roleLabel, roleLabelOther),
            locations: locations || null,
            biggest_challenge: resolveOther(challenge, challengeOther),
            heard_about: resolveOther(heardAbout, heardAboutOther),
            agreement_type: "member",
            agreement_version: "1.0",
            agreement_accepted_at: new Date().toISOString(),
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data?.error ?? "Couldn't complete signup right now. Please try again.");
        setSubmitting(false);
        return;
      }
      // GA4 key event: account created (marks the top of the paid funnel).
      trackEvent("sign_up", { method: params.get("ref") ? "referral" : "organic" });
      // Carry context through to /upgrade: an annual pre-selection (from
      // /pricing) for the billing toggle, and the referral code so the
      // owner's promo auto-applies on the payment card.
      const next = data?.next ?? "/upgrade";
      const carry = new URLSearchParams();
      if (params.get("interval") === "annual") carry.set("interval", "annual");
      const ref = params.get("ref");
      if (ref) carry.set("ref", ref);
      // Direct promo links (team promo codes, the exit-intent offer) ride a
      // ?promo=CODE param the same way referrals ride ?ref=.
      const promo = params.get("promo");
      if (promo && /^[A-Za-z0-9-]{3,20}$/.test(promo)) carry.set("promo", promo);
      // Welcome-back links: the resume token rides through so the payment
      // card applies the month-free code server-side at checkout.
      const resume = params.get("resume");
      if (resume && /^[A-Za-z0-9_-]{16,64}$/.test(resume)) carry.set("resume", resume);
      router.push(
        carry.size > 0 ? `${next}${next.includes("?") ? "&" : "?"}${carry.toString()}` : next,
      );
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      bgcolor: "#FFFFFF",
      borderRadius: 2,
      fontSize: "1rem",
    },
    "& .MuiInputLabel-root": { fontSize: "0.95rem" },
  } as const;

  // Referral visits get the invitation page; organic visits keep the
  // single-column form. Nothing about the steps themselves differs.
  const cardMode = !!refCtx;
  const offerN = refCtx?.offerActive ? refCtx.offerMonths : 0;

  const cardTitle =
    offerN > 1 ? `Start your ${numberWord(offerN)} months` : offerN === 1 ? "Start your free month" : "Start your membership";

  const continueLabel =
    step === 2 ? "Start your membership" : cardMode ? `Continue, step ${step + 1} of 3` : "Continue";

  const formSteps = (
    <AnimatePresence mode="wait" initial={false}>
      <MotionBox
        key={step}
        initial={reduced ? false : { opacity: 0, x: dir * 36 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduced ? undefined : { opacity: 0, x: dir * -36 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        {cardMode && step === 0 ? (
          <Typography
            component="h2"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "1.5rem", md: "1.65rem" },
              fontWeight: 600,
              color: INK,
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
              mb: 2.5,
            }}
          >
            {cardTitle}
          </Typography>
        ) : (
          <>
            <Typography
              sx={{
                color: GOLD_DARK,
                fontSize: "0.72rem",
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                mb: 1,
              }}
            >
              {STEPS[step]!.eyebrow}
            </Typography>
            <Typography
              component={cardMode ? "h2" : "h1"}
              sx={{
                fontFamily: "var(--font-display)",
                fontSize: cardMode ? { xs: "1.5rem", md: "1.65rem" } : { xs: "1.8rem", md: "2.2rem" },
                fontWeight: cardMode ? 600 : 500,
                color: INK,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                mb: 1,
              }}
            >
              {STEPS[step]!.title}
            </Typography>
            <Typography sx={{ color: MUTED, fontSize: "0.95rem", lineHeight: 1.6, mb: 3.5 }}>
              {step === 0 && "Three short steps and you're picking your plan. No payment on this page."}
              {step === 1 && "So the helpline and your member directory listing fit your practice."}
              {step === 2 && "One optional question, one agreement, and you're through to plan and checkout."}
            </Typography>
          </>
        )}

        {step === 0 && (
          <Stack spacing={2.25}>
            <Stack direction={cardMode ? "column" : { xs: "column", sm: "row" }} spacing={2.25}>
              <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" autoFocus={!cardMode} fullWidth required sx={fieldSx} />
              <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" fullWidth required sx={fieldSx} />
            </Stack>
            <TextField label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => captureAbandon()} autoComplete="email" fullWidth required sx={fieldSx} />
          </Stack>
        )}

        {step === 1 && (
          <Stack spacing={2.25}>
            <TextField select label="What best describes your role?" value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} fullWidth sx={fieldSx}>
              {memberRoles.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
            {roleLabel === OTHER && (
              <TextField label="Tell us your role" value={roleLabelOther} onChange={(e) => setRoleLabelOther(e.target.value)} placeholder="e.g. Director of Operations" fullWidth required sx={fieldSx} />
            )}
            <TextField label="Practice name" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} autoComplete="organization" fullWidth required sx={fieldSx} />
            <Stack direction={cardMode ? "column" : { xs: "column", sm: "row" }} spacing={2.25}>
              <TextField select label="Number of locations" value={locations} onChange={(e) => setLocations(e.target.value)} fullWidth sx={fieldSx}>
                {locationOptions.map((o) => (
                  <MenuItem key={o} value={o}>{o}</MenuItem>
                ))}
              </TextField>
              <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" fullWidth sx={fieldSx} />
            </Stack>
          </Stack>
        )}

        {step === 2 && (
          <Stack spacing={2.25}>
            <TextField select label="Biggest challenge right now?" value={challenge} onChange={(e) => setChallenge(e.target.value)} fullWidth sx={fieldSx}>
              {challengeOptions.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            {challenge === OTHER && (
              <TextField label="Describe your biggest challenge" value={challengeOther} onChange={(e) => setChallengeOther(e.target.value)} placeholder="e.g. Hiring & retaining injectors" multiline minRows={2} fullWidth required sx={fieldSx} />
            )}
            <TextField select label="How did you hear about us?" value={heardAbout} onChange={(e) => setHeardAbout(e.target.value)} fullWidth sx={fieldSx}>
              {heardAboutOptions.map((o) => (
                <MenuItem key={o} value={o}>{o}</MenuItem>
              ))}
            </TextField>
            {heardAbout === OTHER && (
              <TextField label="Tell us where you heard about us" value={heardAboutOther} onChange={(e) => setHeardAboutOther(e.target.value)} placeholder="e.g. A study club, a Facebook group…" fullWidth required sx={fieldSx} />
            )}
            <FormControlLabel
              control={
                <Checkbox
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  size="small"
                  sx={{ color: "#A8A29E", "&.Mui-checked": { color: GOLD_DARK }, p: 0.5, mr: 0.5 }}
                />
              }
              label={
                <Typography sx={{ fontSize: "0.82rem", color: "#52525B", lineHeight: 1.5 }}>
                  I agree to the{" "}
                  <Box
                    component={Link}
                    href="/agreements/asn-member-agreement.pdf"
                    target="_blank"
                    rel="noopener"
                    sx={{
                      color: GOLD_DARK,
                      fontWeight: 700,
                      textDecoration: "underline",
                      textDecorationColor: "rgba(155,123,58,0.4)",
                      textUnderlineOffset: 3,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.4,
                    }}
                  >
                    Member Agreement
                    <ExternalLink size={11} />
                  </Box>{" "}
                  and to receive launch updates from ASN.
                </Typography>
              }
              sx={{ alignItems: "flex-start", m: 0 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  size="small"
                  sx={{ color: "#A8A29E", "&.Mui-checked": { color: GOLD_DARK }, p: 0.5, mr: 0.5 }}
                />
              }
              label={
                <Typography sx={{ fontSize: "0.82rem", color: "#52525B", lineHeight: 1.5 }}>
                  {SMS_CONSENT_TEXT}
                </Typography>
              }
              sx={{ alignItems: "flex-start", m: 0 }}
            />
          </Stack>
        )}

        {error && (
          <Typography
            role="alert"
            sx={{
              mt: 2.5,
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

        <Stack direction="row" spacing={1.5} sx={{ mt: cardMode ? 3 : 4, alignItems: "center" }}>
          {step > 0 && (
            <Button
              onClick={() => go(-1)}
              startIcon={<ArrowLeft size={15} />}
              sx={{ textTransform: "none", color: MUTED, fontWeight: 600, borderRadius: cardMode ? 999 : 2, px: 1.5 }}
            >
              Back
            </Button>
          )}
          <Button
            onClick={() => (step === 2 ? void submit() : go(1))}
            disabled={!stepValid || submitting}
            endIcon={
              submitting ? (
                <CircularProgress size={15} sx={{ color: INK }} />
              ) : step === 2 ? (
                <Check size={16} />
              ) : (
                <ArrowRight size={16} />
              )
            }
            sx={{
              flex: 1,
              py: 1.5,
              fontSize: "1rem",
              fontWeight: 800,
              textTransform: "none",
              borderRadius: cardMode ? 999 : 2,
              bgcolor: GOLD,
              color: INK,
              "&:hover": { bgcolor: "#E5BA63" },
              "&.Mui-disabled": { bgcolor: "rgba(217,168,75,0.35)", color: "rgba(10,26,47,0.5)" },
            }}
          >
            {continueLabel}
          </Button>
        </Stack>

        {cardMode ? (
          step === 0 && (
            <Typography sx={{ mt: 2, fontSize: "0.8rem", color: SOFT, textAlign: "center", lineHeight: 1.55 }}>
              {offerN > 0
                ? `You add a payment method at step 3. Nothing is charged until month ${numberWord(offerN + 1)}, and we remind you twice before that.`
                : "No payment on this page. You choose your plan after step 3."}
            </Typography>
          )
        ) : (
          step === 0 && (
            <Typography sx={{ mt: 2.5, fontSize: "0.8rem", color: SOFT, textAlign: "center" }}>
              Founding 100 · $29 a month, locked for life · cancel anytime
            </Typography>
          )
        )}
      </MotionBox>
    </AnimatePresence>
  );

  const progressBar = (
    <Box sx={{ height: 4, bgcolor: "rgba(155,123,58,0.15)" }}>
      <Box
        sx={{
          height: "100%",
          width: `${((step + 1) / 3) * 100}%`,
          bgcolor: GOLD,
          transition: "width 420ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </Box>
  );

  const fullFormLink = (
    <Typography sx={{ mt: 3, fontSize: "0.78rem", color: SOFT, textAlign: "center" }}>
      An expert, partner, or team application instead?{" "}
      <Box component={Link} href="/join" sx={{ color: GOLD_DARK, fontWeight: 700 }}>
        Use the full form
      </Box>
    </Typography>
  );

  // ── Organic visit: the single-column form, unchanged ────────────────
  if (!refCtx) {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: PAPER, display: "flex", flexDirection: "column" }}>
        {progressBar}
        <Container maxWidth="sm" sx={{ flex: 1, display: "flex", flexDirection: "column", py: { xs: 4, md: 7 } }}>
          <Box sx={{ maxWidth: 460, width: "100%", mx: "auto", flex: 1 }}>{formSteps}</Box>
          {fullFormLink}
        </Container>
      </Box>
    );
  }

  // ── Referral visit: the invitation page around the same form ────────
  // Phone order is header, headline, form, then everything else: the
  // grid below stacks in DOM order at xs, so nothing needs reordering.
  const short = shortNameOf(refCtx);
  const inviteLine =
    refCtx.kind === "team"
      ? `A gift from the Aesthetic Success Network team.${offerN > 0 ? ` ${monthsPhrase(offerN)} free, already applied.` : ""}`
      : `Invited by ${refCtx.name}.${offerN > 0 ? ` ${monthsPhrase(offerN)} free, already applied.` : ""}`;
  const howItWorks = [
    { title: "Your details", text: "Name, email and your practice. About a minute." },
    {
      title: "Payment method",
      text: offerN > 0 ? `Needed to start your free months. Nothing is charged until month ${numberWord(offerN + 1)}.` : "Added at step 3. Nothing is charged today.",
    },
    {
      title: offerN > 0 ? `${monthsPhrase(offerN)} free` : "Your portal opens",
      text:
        offerN > 0
          ? `Everything unlocks now. $29 a month starts in month ${numberWord(offerN + 1)}.`
          : "Everything unlocks as soon as payment is confirmed.",
    },
  ];
  const heroPoints = [
    ...(offerN > 0 ? [`${monthsPhrase(offerN)} free from ${refCtx.kind === "team" ? "the team" : short}`] : []),
    "Nothing charged today",
    "Cancel any time",
  ];

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: PAPER, overflowX: "hidden" }}>
      {progressBar}
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
        {/* Header */}
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, pt: { xs: 1.5, md: 2.5 } }}
        >
          {/* Wordmark without the "Founded by" caption the standard logo
              file carries; this page says "Powered by" only. */}
          <Box component={Link} href="/" aria-label="Aesthetic Success Network" sx={{ display: "block", flexShrink: 0, width: { xs: 120, md: 168 }, lineHeight: 0 }}>
            <Image src="/asn-logo-full-white.png" alt="Aesthetic Success Network" width={720} height={243} priority style={{ width: "100%", height: "auto" }} />
          </Box>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0 }}>
            <RefAvatar ctx={refCtx} size={32} />
            <Typography sx={{ fontSize: { xs: "0.76rem", sm: "0.85rem" }, color: MUTED, fontWeight: 600, lineHeight: 1.35 }}>
              {inviteLine}
            </Typography>
          </Stack>
        </Stack>

        {/* Headline and form */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 420px" },
            gap: { xs: 3.5, md: 8 },
            alignItems: { xs: "start", md: "center" },
            pt: { xs: 3.5, md: 5.5 },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: "var(--font-display)",
                fontSize: { xs: "2.2rem", sm: "2.6rem", md: "3.1rem" },
                fontWeight: 500,
                color: INK,
                letterSpacing: "-0.02em",
                lineHeight: 1.08,
              }}
            >
              Expert advice your team can run on Monday.
            </Typography>
            <Typography sx={{ mt: 2.25, fontSize: { xs: "1rem", md: "1.08rem" }, color: "#3B4A55", lineHeight: 1.65, maxWidth: 580 }}>
              Bring any practice problem. Get a written answer, and the right expert to talk to. Then open an
              expert kit and hand your team the video, the checklist and the wall poster that go with it.
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: "10px 22px", mt: 2.5 }}>
              {heroPoints.map((t) => (
                <Stack key={t} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <Check size={15} color={GREEN} strokeWidth={3} />
                  <Typography sx={{ fontSize: "0.9rem", color: "#3B4A55", fontWeight: 600 }}>{t}</Typography>
                </Stack>
              ))}
            </Stack>

            {/* How it works: the three form steps, then the trial. Facts
                only, all stated elsewhere on the page. */}
            <Box
              sx={{
                mt: { xs: 3, md: 4 },
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" },
                gap: { xs: 1.25, sm: 1.5 },
                maxWidth: 620,
              }}
            >
              {howItWorks.map((h, i) => (
                <Box key={h.title} sx={{ bgcolor: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: "16px", px: 2, py: 1.75, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
                    <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: GOLD, color: INK, display: "grid", placeItems: "center", fontSize: "0.75rem", fontWeight: 800, flexShrink: 0 }}>
                      {i + 1}
                    </Box>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, lineHeight: 1.25 }}>{h.title}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 }}>{h.text}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: "#FFFFFF",
                border: `1px solid ${LINE}`,
                borderRadius: "20px",
                p: { xs: 2.5, sm: 3.25 },
                boxShadow: "0 18px 40px -28px rgba(10,26,47,0.3)",
              }}
            >
              {formSteps}
            </Box>
            {fullFormLink}
          </Box>
        </Box>

        {/* Why we built this */}
        {quote && (
          <Box
            sx={{
              mt: { xs: 5, md: 6 },
              p: { xs: 2.5, md: 3.5 },
              bgcolor: "#FFFFFF",
              border: `1px solid ${LINE}`,
              borderLeft: `5px solid ${GOLD}`,
              borderRadius: "20px",
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: { xs: 2.25, sm: 3.5 },
              alignItems: { xs: "flex-start", sm: "center" },
            }}
          >
            {refCtx.imageUrl ? (
              <Box
                component="img"
                src={refCtx.imageUrl}
                alt={refCtx.name}
                sx={{
                  width: { xs: 96, md: 128 },
                  height: { xs: 96, md: 128 },
                  borderRadius: "50%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  border: `3px solid ${GOLD}`,
                  flexShrink: 0,
                }}
              />
            ) : (
              <RefAvatar ctx={refCtx} size={96} />
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={kickerSx}>Why we built this</Typography>
              <Typography
                component="blockquote"
                sx={{
                  m: 0,
                  mt: 1.25,
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.12rem", md: "1.32rem" },
                  lineHeight: 1.45,
                  color: INK,
                }}
              >
                “{quote.quote}”
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} sx={{ mt: 1.75, gap: { xs: 0.25, sm: 1.5 }, alignItems: { sm: "baseline" } }}>
                <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 600, color: INK }}>
                  {refCtx.name}
                </Typography>
                <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{quote.role}</Typography>
              </Stack>
            </Box>
          </Box>
        )}

        {/* Expert kits shelf: rendered only when there are cards to show (none at
            launch; no DMN people or images are carried over). */}
        {PLAYBOOK_CARDS.length > 0 && (
        <Box sx={{ mt: { xs: 5, md: 6 } }}>
          <SectionHead title="Expert kits" sub="Each one turns an expert's session into a short training video, a guide, a checklist, a worksheet and a wall poster." />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(6, minmax(0, 1fr))" },
              gap: { xs: 1.5, md: 2.25 },
            }}
          >
            {PLAYBOOK_CARDS.map((c) => (
              <Box
                key={c.src}
                sx={{
                  position: "relative",
                  aspectRatio: "3 / 4",
                  borderRadius: "14px",
                  overflow: "hidden",
                  bgcolor: "#15263a",
                  boxShadow: "0 10px 24px -12px rgba(10,26,47,0.35)",
                }}
              >
                <Image src={c.src} alt={c.alt} fill sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 200px" style={{ objectFit: "cover" }} />
              </Box>
            ))}
          </Box>
          <Typography sx={{ mt: 1.75, fontSize: "0.84rem", color: MUTED }}>
            A growing library. New kits are added, and every one carries the expert&apos;s name.
          </Typography>
        </Box>
        )}

        {/* Everything in the membership */}
        <Box sx={{ mt: { xs: 5, md: 6 } }}>
          <SectionHead title="Everything in the membership" sub="One login. All of it included." />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            <Tile kicker="Ask" title="Expert Hotline">
              <Box sx={{ bgcolor: "rgba(217,168,75,0.13)", borderRadius: "12px", px: 1.75, py: 1.25, fontSize: "0.86rem", lineHeight: 1.55, color: "#27323D" }}>
                <b>You:</b> Our injectables bookings have been flat for six months.
                <br />
                <b>Beacon:</b>{" "}Here are the kits that cover this, and the expert whose session fits best. Want a
                person to look at your numbers?
              </Box>
              <TileText>
                Any practice problem. A first answer right away, built on our experts&apos; own sessions. Need more? Our team
                comes back in writing within 2 to 3 business days, with the experts worth calling.
              </TileText>
            </Tile>
            {JOB_BOARD_ENABLED && (
            <Tile kicker="Hire" title="Job board">
              <Box sx={{ border: `1px solid ${LINE}`, borderRadius: "12px", px: 1.75, py: 1.25 }}>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>
                  {latestJob ? latestJob.title : "Nurse injector, full time"}
                </Typography>
                <Typography sx={{ fontSize: "0.8rem", color: latestJob ? MUTED : PLACEHOLDER, mt: 0.25 }}>
                  {latestJob ? latestJob.where : "Practice name, City, State"}
                </Typography>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: latestJob ? INK : PLACEHOLDER, mt: 0.25 }}>
                  {latestJob ? latestJob.pay : "Pay range per hour"}
                </Typography>
              </Box>
              <TileText>
                Post your vacancy, included in membership. Every listing shows pay, and each post gets its own page Google
                can list.
              </TileText>
            </Tile>
            )}
          </Box>
          <Box
            sx={{
              mt: 2,
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            {MEMBERSHIP_TILES.map((t) => (
              <Tile key={t.title} kicker={t.kicker} title={t.title} chip={t.chip}>
                <TileText>{t.text}</TileText>
              </Tile>
            ))}
          </Box>
          <Typography sx={{ mt: 1.75, fontSize: "0.84rem", color: MUTED }}>
            Monthly live AMAs and CE sessions are part of membership. Dates are announced inside the portal.
          </Typography>
        </Box>

        {/* Footer */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{
            mt: { xs: 5, md: 6 },
            py: 3.5,
            gap: { xs: 1, md: 5 },
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            borderTop: `1px solid ${LINE}`,
            fontSize: "0.84rem",
            color: MUTED,
          }}
        >
          <span>Aesthetic Success Network · Powered by Business of Aesthetics</span>
          <span>
            {offerN > 0
              ? `$29 a month after ${numberWord(offerN)} month${offerN === 1 ? "" : "s"}. Cancel any time.`
              : "$29 a month. Cancel any time."}
          </span>
          <Box component="a" href="mailto:support@aestheticsuccessnetwork.com" sx={{ color: MUTED, textDecoration: "none", "&:hover": { color: INK } }}>
            support@aestheticsuccessnetwork.com
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

// ── Page tokens (the site's own palette, not the mock's) ──────────────
const INK = "#0A1A2F";
const GOLD = "#D9A84B";
const GOLD_DARK = "#9B7B3A";
const GREEN = "#2C7A52";
const LINE = "#E6DDCF";
const MUTED = "#5C6770";
const SOFT = "#7A8590";
const PAPER = "#FBF8F1";
const PLACEHOLDER = "#A3A9B0";

const kickerSx = {
  color: GOLD_DARK,
  fontSize: "0.7rem",
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
} as const;

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen"];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
/** "Six months" / "One month", sentence case, for the invitation lines. */
function monthsPhrase(n: number): string {
  const w = numberWord(n);
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} month${n === 1 ? "" : "s"}`;
}

// Portal cards for published kits (public/join/kits/<slug>.jpg). EMPTY at
// launch: the DMN playbook covers and people were moved out of public/. The
// shelf renders only when this list has entries.
const PLAYBOOK_CARDS: { src: string; alt: string }[] = [];

// Job board is a phase-two feature; the tile follows the same flag as the
// portal sidebar.
const JOB_BOARD_ENABLED = process.env.NEXT_PUBLIC_JOB_BOARD_ENABLED === "true";

const MEMBERSHIP_TILES: { kicker: string; title: string; text: string; chip?: string }[] = [
  {
    kicker: "Learn",
    title: "Resource library",
    text: "A growing library of expert kits. Each one turns an expert's session into a training video, a guide, a checklist, a worksheet and a wall poster.",
  },
  {
    kicker: "Run",
    title: "SOPs and templates",
    text: "Procedures written from an expert's own process and approved by them, so a front desk or a patient coordinator can run them on Monday.",
  },
  {
    kicker: "Measure",
    title: "Tools and calculators",
    text: "Fill-in tools for the numbers a practice lives on: treatment margins, consult conversion and the membership math itself.",
  },
  {
    kicker: "Find",
    title: "Expert directory",
    text: "Vetted experts with a booking link on every profile. Beacon names the right one for your question.",
  },
  {
    kicker: "Save",
    title: "Partner offers",
    text: "Partners vetted by the Business of Aesthetics team, with offers only members get.",
  },
  {
    kicker: "Meet",
    title: "Live AMAs and CE",
    text: "Monthly live sessions with the experts in the network, with CE where the accreditor confirms it. Dates are announced inside the portal.",
  },
];

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} sx={{ alignItems: { md: "baseline" }, gap: { xs: 0.5, md: 1.75 }, mb: 2.25 }}>
      <Typography component="h2" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.5rem", md: "1.7rem" }, fontWeight: 600, color: INK, lineHeight: 1.2 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: "0.9rem", color: MUTED, lineHeight: 1.5 }}>{sub}</Typography>
    </Stack>
  );
}

function Tile({ kicker, title, chip, children }: { kicker: string; title: string; chip?: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: "#FFFFFF",
        border: `1px solid ${LINE}`,
        borderRadius: "16px",
        p: { xs: 2.25, md: 2.5 },
        display: "flex",
        flexDirection: "column",
        gap: 1.1,
        minWidth: 0,
      }}
    >
      <Typography sx={kickerSx}>{kicker}</Typography>
      <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography component="h3" sx={{ fontFamily: "var(--font-display)", fontSize: "1.18rem", fontWeight: 600, color: INK, lineHeight: 1.2 }}>
          {title}
        </Typography>
        {chip && (
          <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, px: 1.1, py: 0.35, borderRadius: 999, bgcolor: "rgba(217,168,75,0.16)", color: GOLD_DARK }}>
            {chip}
          </Box>
        )}
      </Stack>
      {children}
    </Box>
  );
}

function TileText({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: "0.86rem", color: "#3B4A55", lineHeight: 1.55 }}>{children}</Typography>;
}

/** Avatar for the referring expert (headshot) or partner (logo), with an
 *  initials fallback. Plain <img>: these are user-supplied URLs, so we
 *  deliberately skip the Next image optimizer. */
function RefAvatar({ ctx, size }: { ctx: RefContext; size: number }) {
  if (ctx.imageUrl) {
    return (
      <Box
        component="img"
        src={ctx.imageUrl}
        alt={ctx.name}
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: ctx.kind === "expert" ? "cover" : "contain",
          objectPosition: "center top",
          bgcolor: "#FFFFFF",
          border: `1px solid ${LINE}`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "rgba(217,168,75,0.18)",
        border: "1px solid rgba(217,168,75,0.5)",
        color: GOLD_DARK,
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.38,
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {initialsOf(ctx.name)}
    </Box>
  );
}
