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

/**
 * Shared 2-step OTP login form used by every portal (member, expert,
 * company, admin, job seeker). Each role's /login page passes the endpoints + copy;
 * the rest of the UX (auto-advance to code step, auto-submit at 6 digits,
 * resend, change-email) is identical.
 *
 * Why one component for all roles: the only meaningful difference
 * between the role logins is where they POST (their own send + verify
 * endpoints) and where they land after success. Visual chrome stays
 * consistent: a plain centred white card with a navy primary button.
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

const NAVY = "#0E2A3D";
const NAVY_HOVER = "#0B2232";
const INK = "#111827";
const BODY = "#374151";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const CANVAS = "#F7F7F5";
const INTER = "var(--font-body), 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function OtpLoginForm({ config }: { config: OtpLoginConfig }) {
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
    minHeight: 40,
    borderRadius: "6px",
    fontWeight: 500,
    fontSize: "0.875rem",
    textTransform: "none",
    bgcolor: NAVY,
    color: "#FFFFFF",
    backgroundImage: "none",
    boxShadow: "none",
    "&:hover": { bgcolor: NAVY_HOVER, boxShadow: "none", transform: "none" },
    "&.Mui-disabled": { bgcolor: "#E5E7EB", color: "#9CA3AF", backgroundImage: "none" },
  } as const;

  const textSx = {
    minHeight: 32,
    borderRadius: "6px",
    fontSize: "0.8125rem",
    fontWeight: 500,
    textTransform: "none",
    color: NAVY,
    "&:hover": { bgcolor: "#F3F4F6", transform: "none" },
  } as const;

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "8px",
      minHeight: 40,
      fontSize: "0.875rem",
      bgcolor: "#FFFFFF",
      boxShadow: "none",
      "& .MuiOutlinedInput-notchedOutline": { borderColor: "#D1D5DB" },
      "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#9CA3AF" },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: NAVY, borderWidth: 1 },
      "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(14,42,61,0.12)" },
    },
    "& .MuiInputLabel-root": { color: BODY, fontWeight: 500, fontSize: "0.875rem" },
    "& .MuiInputLabel-root.Mui-focused": { color: NAVY },
  } as const;

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        bgcolor: CANVAS,
        color: INK,
        fontFamily: INTER,
        px: 2,
        py: 6,
      }}
    >
      <Container maxWidth="xs" sx={{ px: { xs: 0, sm: 2 } }}>
        {/* Brand row: logo tile + wordmark */}
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", justifyContent: "center", mb: 3 }}>
          <Box
            component={Link}
            href="/"
            aria-label={`Aesthetic Success Network · ${config.roleLabel} sign in`}
            sx={{ position: "relative", width: 32, height: 32, borderRadius: "6px", overflow: "hidden", display: "block", flexShrink: 0 }}
          >
            <Image src="/asn-nav-icon.png" alt="Aesthetic Success Network" fill sizes="32px" priority style={{ objectFit: "cover" }} />
          </Box>
          <Typography sx={{ fontFamily: INTER, fontSize: "0.9375rem", fontWeight: 600, color: INK, lineHeight: 1 }}>
            Aesthetic Success Network
          </Typography>
        </Stack>

        <Box
          sx={{
            bgcolor: "#FFFFFF",
            border: `1px solid ${LINE}`,
            borderRadius: "8px",
            p: { xs: 3, sm: 4 },
          }}
        >
          <Typography sx={{ fontFamily: INTER, fontSize: "0.8125rem", color: MUTED, mb: 0.5 }}>
            {capitalise(config.roleLabel)} sign in
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: INTER,
              fontSize: "1.25rem",
              fontWeight: 600,
              color: INK,
              letterSpacing: 0,
              lineHeight: 1.3,
              mb: 0.75,
            }}
          >
            {step === "email" ? config.emailStepTitle : config.codeStepTitle}
          </Typography>
          <Typography sx={{ fontFamily: INTER, fontSize: "0.875rem", color: MUTED, lineHeight: 1.55, mb: 3 }}>
            {step === "email" ? config.emailStepSubtitle : config.codeStepSubtitle}
          </Typography>

          {info && (
            <Alert severity="info" sx={{ mb: 2, fontSize: "0.8125rem", borderRadius: "6px", bgcolor: "rgba(14,42,61,0.06)", color: NAVY }}>
              {info}
            </Alert>
          )}
          {err && (
            <Alert
              severity="error"
              onClose={() => setErr(null)}
              sx={{ mb: 2, fontSize: "0.8125rem", borderRadius: "6px", bgcolor: "#FEE2E2", color: "#991B1B" }}
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
                      fontFamily: "var(--font-mono, ui-monospace, Menlo, monospace)",
                      fontSize: "1.25rem",
                      letterSpacing: "0.5em",
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
                  sx={{ ...textSx, color: MUTED, "&:hover": { bgcolor: "#F3F4F6", color: INK, transform: "none" } }}
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

        {config.signupHref && (
          <Typography sx={{ fontFamily: INTER, mt: 2.5, fontSize: "0.875rem", color: MUTED, textAlign: "center" }}>
            {config.signupLabel ?? "Not a member yet?"}{" "}
            <Box
              component={Link}
              href={config.signupHref}
              sx={{ color: NAVY, fontWeight: 500, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              Join the network
            </Box>
          </Typography>
        )}
        <Typography sx={{ fontFamily: INTER, mt: 3, fontSize: "0.75rem", color: MUTED, textAlign: "center" }}>
          © 2026 Aesthetic Success Network · Powered by Business of Aesthetics
        </Typography>
      </Container>
    </Box>
  );
}

function capitalise(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
