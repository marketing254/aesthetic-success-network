"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Checkbox, CircularProgress, Container, FormControlLabel, Stack, Typography } from "@mui/material";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import JoinApplicationForm from "@/components/join/JoinApplicationForm";
import { COLORS } from "@/theme";

const AGREEMENT_VERSION = "v1";

/**
 * Client view for /invite/[code] — the personalized standard invite.
 *
 * Two modes:
 *  - profileInvite: the admin already created their expert/partner
 *    profile. They accept the STANDARD agreement here, then sign in to
 *    the portal — where the billing gate collects their card before
 *    anything unlocks (only founding invitees are card-free).
 *  - prospect: no profile yet — the standard application form,
 *    pre-filled, which files them as pending review.
 */
export default function InviteLandingView({
  state,
  kind,
  fullName,
  email,
  companyName,
  code,
  profileInvite = false,
  cardRequired = true,
}: {
  state: "valid" | "accepted" | "invalid";
  kind: "expert" | "partner";
  fullName: string;
  email: string | null;
  companyName: string | null;
  code: string;
  profileInvite?: boolean;
  /** false when the profile already has billing set up — card messaging hidden. */
  cardRequired?: boolean;
}) {
  const firstName = fullName.split(/\s+/)[0] ?? "";
  const roleLabel = kind === "expert" ? "Expert" : "Partner";
  const loginHref = kind === "expert" ? "/expert/login" : "/vendor/login";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.surface, display: "flex", flexDirection: "column" }}>
      <Header />
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 }, flex: 1 }}>
        {state !== "valid" ? (
          <Box sx={{ textAlign: "center", py: 10, maxWidth: 520, mx: "auto" }}>
            <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: "rgba(217,168,75,0.14)", color: COLORS.accent, display: "grid", placeItems: "center", mx: "auto", mb: 2 }}>
              <MailRoundedIcon sx={{ fontSize: 26 }} />
            </Box>
            <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.8rem", md: "2.2rem" }, fontWeight: 500, color: COLORS.ink, mb: 1.5 }}>
              {state === "accepted" ? "This invite has already been used" : "This invite link isn't valid"}
            </Typography>
            <Typography sx={{ color: COLORS.muted, fontSize: "0.95rem", lineHeight: 1.6 }}>
              {state === "accepted"
                ? "You're all set. Sign in to your portal, or email us with any questions: "
                : "It may have expired or been replaced. Reach out and we'll send you a fresh one: "}
              <Box component="a" href="mailto:founding@aestheticsuccessnetwork.com" sx={{ color: COLORS.accent, fontWeight: 700, textDecoration: "none" }}>
                founding@aestheticsuccessnetwork.com
              </Box>
              .
            </Typography>
            {state === "accepted" && (
              <Button component={Link} href={loginHref} variant="contained" sx={{ mt: 3, textTransform: "none", borderRadius: 999, bgcolor: COLORS.accent, color: "#fff", "&:hover": { bgcolor: COLORS.accent } }}>
                Sign in to the portal
              </Button>
            )}
          </Box>
        ) : (
          <Stack spacing={4}>
            <Box sx={{ textAlign: "center", maxWidth: 640, mx: "auto" }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.accent, mb: 1.25 }}>
                Your personal invitation · ASN {roleLabel}
              </Typography>
              <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "2rem", md: "2.6rem" }, fontWeight: 500, color: COLORS.ink, lineHeight: 1.12, letterSpacing: "-0.02em", mb: 1.5 }}>
                {firstName ? `${firstName}, you're invited.` : "You're invited."}
              </Typography>
              <Typography sx={{ color: COLORS.inkSoft, fontSize: "1rem", lineHeight: 1.65 }}>
                {profileInvite ? (
                  <>
                    Your {roleLabel.toLowerCase()} profile
                    {companyName ? <> for <Box component="strong">{companyName}</Box></> : null}
                    {cardRequired
                      ? " is ready in the Aesthetic Success Network. Accept the standard agreement below, then sign in. You'll add your card in the portal to activate your free trial."
                      : " is ready in the Aesthetic Success Network. Accept the standard agreement below, then sign in. Your billing is already set up, so the portal is one login away."}
                  </>
                ) : (
                  <>
                    We&apos;d love to have {companyName ? <Box component="strong">{companyName}</Box> : "you"} in the Aesthetic
                    Success Network as a {roleLabel.toLowerCase()}. We&apos;ve pre-filled your details. Review the standard
                    agreement, confirm, and the team takes it from there. You&apos;ll add your card in the portal once approved.
                  </>
                )}
              </Typography>
            </Box>

            {profileInvite ? (
              <ProfileAcceptCard kind={kind} code={code} loginHref={loginHref} cardRequired={cardRequired} />
            ) : (
              <JoinApplicationForm
                role={kind}
                inviteCode={code}
                agreementHref="/agreements/asn-provider-agreement.pdf"
                initial={{ contactName: fullName, contactEmail: email ?? "", focus: companyName ?? "" }}
              />
            )}

            <Typography sx={{ textAlign: "center", fontSize: "0.82rem", color: COLORS.muted }}>
              Curious first?{" "}
              <Box component={Link} href={kind === "expert" ? "/experts" : "/companies"} sx={{ color: COLORS.accent, fontWeight: 700 }}>
                See the {kind === "expert" ? "expert bench" : "partner network"}
              </Box>
              .
            </Typography>
          </Stack>
        )}
      </Container>
      <Footer />
    </Box>
  );
}

/** Agreement acceptance for invites tied to an existing profile. */
function ProfileAcceptCard({ kind, code, loginHref, cardRequired = true }: { kind: "expert" | "partner"; code: string; loginHref: string; cardRequired?: boolean }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Non-founding invites use the GENERIC Provider Agreement PDF (one ASN
  // agreement covers experts and partners); personalized agreements are a
  // founding-invite-only thing.
  const agreementHref = "/agreements/asn-provider-agreement.pdf";
  const accent = kind === "partner" ? "#A07823" : "#2C7A52";

  const accept = async () => {
    if (!agreed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(code)}/accept`, { method: "POST" });
      const b = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !b.ok) {
        setError(b.error ?? "Couldn't record your acceptance. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 2.5, bgcolor: "#FFFFFF", border: `1px solid ${COLORS.line}`, maxWidth: 620, mx: "auto", textAlign: "center" }}>
        <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: "rgba(44,122,82,0.12)", color: "#2C7A52", display: "grid", placeItems: "center", mx: "auto", mb: 1.5 }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 28 }} />
        </Box>
        <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 600, color: COLORS.ink, mb: 1 }}>
          Agreement accepted
        </Typography>
        <Typography sx={{ color: COLORS.inkSoft, fontSize: "0.95rem", lineHeight: 1.6, mb: 2.5 }}>
          {cardRequired
            ? "Next step: sign in with your email (a 6-digit code, no password). Inside the portal you'll add your card to activate your free trial (nothing is charged today)."
            : "Next step: sign in with your email (a 6-digit code, no password). Your billing is already set up, so you're straight into the portal."}
        </Typography>
        <Button component={Link} href={loginHref} variant="contained" endIcon={<ArrowForwardRoundedIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 999, px: 3, bgcolor: accent, color: "#fff", "&:hover": { bgcolor: accent } }}>
          Sign in to your portal
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 2.5, bgcolor: "#FFFFFF", border: `1px solid ${COLORS.line}`, maxWidth: 620, mx: "auto" }}>
      <Typography sx={{ fontSize: "0.82rem", color: COLORS.muted, mb: 1.25 }}>What you&apos;re agreeing to</Typography>
      <Stack spacing={1} sx={{ mb: 2 }}>
        {[
          "Standard ASN provider terms, no bespoke founding agreement",
          "Cancel anytime, 30-day written notice",
          cardRequired ? "Free trial activates once you add a card in the portal" : "Your billing is already set up, nothing more to add",
        ].map((line) => (
          <Stack key={line} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: "rgba(217,168,75,0.12)", color: accent, display: "grid", placeItems: "center", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0, mt: 0.25 }}>✓</Box>
            <Typography sx={{ fontSize: "0.9rem", color: COLORS.ink, lineHeight: 1.5 }}>{line}</Typography>
          </Stack>
        ))}
      </Stack>
      <Box component={Link} href={agreementHref} target="_blank" rel="noopener noreferrer"
        sx={{ display: "block", width: "fit-content", color: accent, fontSize: "0.85rem", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3, mb: 2.5 }}>
        Read the full agreement →
      </Box>
      <FormControlLabel
        sx={{ display: "flex", alignItems: "flex-start", ml: 0, mr: 0 }}
        control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} sx={{ color: accent, "&.Mui-checked": { color: accent }, mt: -1, ml: -1.25 }} />}
        label={
          <Typography sx={{ fontSize: "0.9rem", color: COLORS.ink }}>
            I agree to the <Box component="strong" sx={{ color: accent }}>ASN Provider Agreement, {kind === "partner" ? "Partner" : "Expert"} terms ({AGREEMENT_VERSION})</Box>.
          </Typography>
        }
      />
      <Button fullWidth variant="contained" disabled={!agreed || busy} onClick={accept}
        endIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : <ArrowForwardRoundedIcon />}
        sx={{ mt: 3, borderRadius: 999, py: 1.25, bgcolor: accent, color: "#FFFFFF", "&:hover": { bgcolor: accent } }}>
        {busy ? "Recording…" : "Accept & continue"}
      </Button>
      {error && <Alert severity="error" sx={{ mt: 2, fontSize: "0.82rem" }}>{error}</Alert>}
      <Typography sx={{ fontSize: "0.78rem", color: COLORS.muted, mt: 2, textAlign: "center" }}>
        {cardRequired
          ? "No card needed on this page · You'll add it inside the portal to start your free trial"
          : "Nothing to pay here. Your billing is already in place"}
      </Typography>
    </Box>
  );
}
