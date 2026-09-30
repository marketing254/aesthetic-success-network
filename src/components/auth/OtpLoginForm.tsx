"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Image from "next/image";
import { CP, PORTAL_FONT, portalFontClassName } from "@/components/shared/CommunityPortalShell";

/**
 * Shared 2-step OTP login form used by every portal (member, expert,
 * company, admin, job seeker). Each role's /login page passes the endpoints + copy;
 * the rest of the UX (auto-advance to code step, auto-submit at 6 digits,
 * resend, change-email) is identical.
 *
 * Why one component for all roles: the only meaningful difference
 * between the role logins is where they POST (their own send + verify
 * endpoints) and where they land after success. Visual chrome stays
 * consistent: warm off-white page, centred white 16px card with the ASN
 * monogram, Plus Jakarta Sans headings and a navy primary button.
 * `accentColor` / `accentTint` are kept in the config for API
 * compatibility and no longer change the look.
 */

export type OtpLoginConfig = {
  /** Role label shown in the audit row + accessible name. */
  roleLabel: string;
  /** API route that sends the OTP email. POST { email }. */
  sendEndpoint: string;
  /** API route that verifies the OTP + sets the session. POST { email, token }. */
  verifyEndpoint: string;
  /** Title shown on the email-step card. */
  emailStepTitle: string;
  /** Title shown on the code-step card. */
  codeStepTitle: string;
  /** Subtitle under each step's title. */
  emailStepSubtitle: string;
  codeStepSubtitle: string;
  /** Kept for API compatibility (no longer used for styling). */
  accentColor: string;
  /** Kept for API compatibility (no longer used for styling). */
  accentTint: string;
  /** Optional sign-up link (members only; experts, companies and admins are admin-added). */
  signupHref?: string;
  signupLabel?: string;
  /**
   * Optional human-friendly error to show when the API returns
   * "user not found" instead of the default copy. Useful for explaining
   * "ask an admin to invite you" on portals where signup is closed.
   */
  unknownEmailMessage?: string;
  /**
   * Forward a `?next=` query param to the verify endpoint so a sign-in
   * that started mid-task (registering for an event) lands back where it
   * began. The endpoint allowlists the value; the form never trusts it.
   */
  forwardNextParam?: boolean;
};

const NAVY = CP.navy;
const NAVY_HOVER = CP.navyHover;
const INK = CP.ink;
const BODY = CP.body;
const MUTED = CP.muted;
const LINE = CP.border;
const LINE_STRONG = CP.borderStrong;
const CANVAS = CP.canvas;

/**
 * Colours of the dark band beside the form. The default is the company
 * portal's navy; the expert login passes the forest gradient.
 */
export type OtpLoginBand = {
  /** Gradient start (top). */
  from: string;
  /** Gradient end (bottom). */
  to: string;
  /** Radial glow colour in the band's corner, rgb triplet as "r,g,b". Default gold. */
  glow?: string;
};

const DEFAULT_BAND: OtpLoginBand = { from: NAVY, to: CP.sidebarEnd, glow: "217,168,75" };

export default function OtpLoginForm({ config, band }: { config: OtpLoginConfig; band?: OtpLoginBand }) {
  const bandColors = band ?? DEFAULT_BAND;
  const glow = bandColors.glow ?? "217,168,75";
  const router = useRouter();
  const params = useSearchParams();
  const initialError = params?.get("error") ?? null;
  const prefilledEmail = (params?.get("email") ?? "").toLowerCase();
  const prefillOnlyEmail = (params?.get("prefill") ?? "").toLowerCase();
  const isWelcome = params?.get("welcome") === "1";

  type Step = "email" | "code";
  const [step, setStep] = useState<Step>(prefilledEmail ? "code" : "email");
  const [email, setEmail] = useState(prefilledEmail || prefillOnlyEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(
    prefilledEmail
      ? `Sending a 6-digit code to ${prefilledEmail}...`
      : isWelcome
        ? "Payment confirmed. Check your inbox for your confirmation email, then enter your email below and we'll send you a 6-digit sign-in code."
        : null,
  );

  const codeInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  const sendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErr("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch(config.sendEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        const isNotFound = res.status === 404;
        const safe = isNotFound
          ? config.unknownEmailMessage ??
            "We couldn't find an account for that email."
          : body.error && res.status >= 400 && res.status < 500
            ? body.error
            : "Couldn't send your code. Please try again.";
        setErr(safe);
        return;
      }
      setStep("code");
      setInfo(`We sent a 6-digit code to ${email}. It expires in 5 minutes.`);
      setCode("");
    } catch (err) {
      if (process.env.NODE_ENV !== "production")
        console.error("[otp-login] send failed:", err);
      setErr("Couldn't send your code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Auto-send when arriving with ?email= (the pay-first flow sends members
  // here after checkout). We know the email, so fire the code immediately;
  // they land straight on the code entry with a code already on the way. The
  // ref guards against React's double-invoke and any re-render re-firing it.
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (prefilledEmail && !autoSentRef.current) {
      autoSentRef.current = true;
      void sendCode();
    }
    // sendCode is stable for this purpose; we intentionally run this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledEmail]);

  const verifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      setErr("Enter the 6-digit code we emailed you.");
      return;
    }
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch(config.verifyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token: cleaned,
          ...(config.forwardNextParam && params?.get("next")
            ? { next: params.get("next") }
            : {}),
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        next?: string;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.next) {
        setErr(
          body.error ??
            "That code didn't work. Request a new one and try again.",
        );
        return;
      }
      router.push(body.next);
    } catch (err) {
      if (process.env.NODE_ENV !== "production")
        console.error("[otp-login] verify failed:", err);
      setErr("Couldn't verify the code right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const primarySx = {
    minHeight: 44,
    borderRadius: "10px",
    fontWeight: 600,
    fontSize: "0.9375rem",
    fontFamily: PORTAL_FONT,
    textTransform: "none",
    bgcolor: NAVY,
    color: "#FFFFFF",
    backgroundImage: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 2px rgba(10,19,32,0.12)",
    transition: "background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
    "&:hover": { bgcolor: NAVY_HOVER, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 16px -8px rgba(10,19,32,0.45)", transform: "translateY(-1px)" },
    "&.Mui-disabled": { bgcolor: "#E6E2D9", color: CP.faint, backgroundImage: "none", boxShadow: "none" },
  } as const;

  const textSx = {
    minHeight: 34,
    borderRadius: "8px",
    fontSize: "0.8125rem",
    fontWeight: 600,
    fontFamily: PORTAL_FONT,
    textTransform: "none",
    color: NAVY,
    "&:hover": { bgcolor: CP.sand, transform: "none" },
  } as const;

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "10px",
      minHeight: 44,
      fontSize: "0.9375rem",
      fontFamily: PORTAL_FONT,
      bgcolor: "#FFFFFF",
      boxShadow: "none",
      border: 0,
      outline: "none",
      "&.Mui-focused": { boxShadow: "none", outline: "none", border: 0 },
      "&:hover": { boxShadow: "none" },
      "& .MuiOutlinedInput-notchedOutline": { borderColor: LINE_STRONG, borderWidth: 1 },
      "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(10,19,32,0.28)" },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: NAVY, borderWidth: 1 },
      "& input": { outline: "none", boxShadow: "none", border: 0 },
      "& input:focus": { outline: "none", boxShadow: "none" },
    },
    "& .MuiInputLabel-root": { color: BODY, fontWeight: 600, fontSize: "0.875rem", fontFamily: PORTAL_FONT },
    "& .MuiInputLabel-root.Mui-focused": { color: NAVY },
  } as const;

  return (
    <Box
      className={portalFontClassName}
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        bgcolor: CANVAS,
        color: INK,
        fontFamily: PORTAL_FONT,
        WebkitFontSmoothing: "antialiased",
        px: 2,
        py: 6,
      }}
    >
      <Container maxWidth="md" sx={{ px: { xs: 0, sm: 2 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" },
            bgcolor: "#FFFFFF",
            border: `1px solid ${LINE}`,
            borderRadius: "16px",
            boxShadow: "0 1px 2px rgba(10,19,32,0.04), 0 24px 48px -28px rgba(10,19,32,0.35)",
            overflow: "hidden",
            maxWidth: 880,
            mx: "auto",
          }}
        >
          {/* Dark navy band (top on mobile, left half on md+) */}
          <Box
            sx={{
              position: "relative",
              overflow: "hidden",
              bgcolor: bandColors.from,
              backgroundImage: `linear-gradient(180deg, ${bandColors.from} 0%, ${bandColors.to} 100%)`,
              color: CP.ivory,
              p: { xs: 3, md: 4 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: { md: 420 },
              "&::before": {
                content: '""',
                position: "absolute",
                top: -120,
                right: -120,
                width: 360,
                height: 360,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(${glow},0.32) 0%, rgba(${glow},0.10) 40%, transparent 70%)`,
                pointerEvents: "none",
              },
            }}
          >
            <Stack direction={{ xs: "row", md: "column" }} spacing={{ xs: 1.75, md: 2.5 }} sx={{ position: "relative", alignItems: { xs: "center", md: "flex-start" } }}>
              <Box
                component={Link}
                href="/"
                aria-label={`Aesthetic Success Network · ${config.roleLabel} sign in`}
                sx={{
                  position: "relative",
                  width: { xs: 44, md: 56 },
                  height: { xs: 44, md: 56 },
                  borderRadius: "14px",
                  overflow: "hidden",
                  display: "block",
                  flexShrink: 0,
                  boxShadow: "0 8px 20px -8px rgba(0,0,0,0.6)",
                  border: `1px solid ${CP.sidebarLine}`,
                }}
              >
                <Image src="/asn-nav-icon.png" alt="Aesthetic Success Network" fill sizes="56px" priority style={{ objectFit: "cover" }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontFamily: PORTAL_FONT, fontSize: { xs: "0.9375rem", md: "1.0625rem" }, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                  Aesthetic Success Network
                </Typography>
                <Typography sx={{ fontFamily: PORTAL_FONT, fontSize: "0.8125rem", fontWeight: 600, color: CP.gold, mt: 0.35 }}>
                  {capitalise(config.roleLabel)} portal
                </Typography>
              </Box>
            </Stack>
            <Typography
              sx={{
                fontFamily: PORTAL_FONT,
                position: "relative",
                display: { xs: "none", md: "block" },
                fontSize: "0.875rem",
                color: CP.ivory80,
                lineHeight: 1.6,
                mt: 3,
              }}
            >
              Sign in with a one-time code sent to your email. No password to remember.
            </Typography>
          </Box>

          {/* White form panel */}
          <Box sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: PORTAL_FONT,
              fontSize: "1.375rem",
              fontWeight: 800,
              color: NAVY,
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
              mb: 0.75,
            }}
          >
            {step === "email" ? config.emailStepTitle : config.codeStepTitle}
          </Typography>
          <Typography sx={{ fontFamily: PORTAL_FONT, fontSize: "0.875rem", color: MUTED, lineHeight: 1.6, mb: 3 }}>
            {step === "email" ? config.emailStepSubtitle : config.codeStepSubtitle}
          </Typography>

          {info && (
            <Alert
              severity="info"
              icon={false}
              sx={{ mb: 2, fontSize: "0.8125rem", borderRadius: "12px", bgcolor: CP.sand, color: INK, fontFamily: PORTAL_FONT, border: "1px solid rgba(217,168,75,0.35)" }}
            >
              {info}
            </Alert>
          )}
          {err && (
            <Alert
              severity="error"
              onClose={() => setErr(null)}
              sx={{ mb: 2, fontSize: "0.8125rem", borderRadius: "12px", bgcolor: CP.errorBg, color: CP.errorFg, fontFamily: PORTAL_FONT }}
            >
              {err}
            </Alert>
          )}

          {step === "email" ? (
            <Box component="form" onSubmit={sendCode}>
              <TextField
                label="Email address"
                type="email"
                fullWidth
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                autoComplete="email"
                placeholder="you@practice.com"
                sx={{ mb: 2, ...fieldSx }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disableElevation
                disabled={busy}
                endIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : null}
                sx={primarySx}
              >
                {busy ? "Sending code..." : "Send 6-digit code"}
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={verifyCode}>
              <TextField
                inputRef={codeInputRef}
                label="6-digit code"
                fullWidth
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6 && !busy) {
                    setTimeout(() => {
                      const form = (e.target as HTMLInputElement).form;
                      form?.requestSubmit();
                    }, 100);
                  }
                }}
                disabled={busy}
                inputMode="numeric"
                autoComplete="one-time-code"
                slotProps={{
                  input: {
                    sx: {
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: "1.375rem",
                      letterSpacing: "0.45em",
                      fontWeight: 600,
                      "& input": { textAlign: "center" },
                    },
                  },
                  htmlInput: {
                    maxLength: 6,
                    pattern: "\\d{6}",
                  },
                }}
                sx={{ mb: 2, ...fieldSx }}
                placeholder="000000"
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disableElevation
                disabled={busy || code.length !== 6}
                endIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : null}
                sx={{ ...primarySx, mb: 1.5 }}
              >
                {busy ? "Verifying..." : "Verify and sign in"}
              </Button>
              <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                <Button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setErr(null);
                    setInfo(null);
                  }}
                  sx={{ ...textSx, color: MUTED, "&:hover": { bgcolor: CP.sand, color: INK, transform: "none" } }}
                >
                  Use a different email
                </Button>
                <Button type="button" onClick={() => sendCode()} disabled={busy} sx={textSx}>
                  Resend code
                </Button>
              </Stack>
            </Box>
          )}
          </Box>
        </Box>

        {config.signupHref && (
          <Typography sx={{ fontFamily: PORTAL_FONT, mt: 2.5, fontSize: "0.875rem", color: MUTED, textAlign: "center" }}>
            {config.signupLabel ?? "Not a member yet?"}{" "}
            <Box
              component={Link}
              href={config.signupHref}
              sx={{ color: NAVY, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              Join the network
            </Box>
          </Typography>
        )}
        <Typography sx={{ fontFamily: PORTAL_FONT, mt: 3, fontSize: "0.75rem", color: MUTED, textAlign: "center" }}>
          © 2026 Aesthetic Success Network · Powered by Business of Aesthetics
        </Typography>
      </Container>
    </Box>
  );
}

function capitalise(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
