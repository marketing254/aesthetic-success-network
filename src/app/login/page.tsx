"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PinOutlinedIcon from "@mui/icons-material/PinOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";

function PortalLoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialError = params.get("error");
  const redirect = params.get("redirect");

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(initialError);

  // The server route resolves portal roles first, so an email with no
  // active membership / approved application never receives a code.
  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErr("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setErr(null);

    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Could not send the sign-in code. Please try again.");
      } else {
        setStep("code");
        setCode("");
      }
    } catch {
      setErr("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\s+/g, "");
    if (token.length < 6) {
      setErr("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setErr(null);

    let home = "/dashboard";
    try {
      const res = await fetch("/api/portal/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), token }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        home?: string;
      };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "That code isn't right. Check the email and try again.");
        if (res.status === 403) setStep("email");
        setBusy(false);
        return;
      }
      if (body.home) home = body.home;
    } catch {
      setErr("Could not reach the server. Check your connection and try again.");
      setBusy(false);
      return;
    }

    // Only honour ?redirect= when it points back into the app.
    const safeRedirect = redirect && redirect.startsWith("/") && !redirect.startsWith("//");
    router.replace(safeRedirect ? redirect : home);
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={0.75} sx={{ alignItems: "center", textAlign: "center" }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(217,168,75,0.14)",
            border: "1px solid rgba(217,168,75,0.32)",
            color: "#A87D2C",
            mb: 1,
          }}
        >
          <WorkspacePremiumOutlinedIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography
          variant="overline"
          sx={{ color: "#A87D2C", letterSpacing: "0.18em", fontSize: "0.66rem", fontWeight: 700 }}
        >
          MEMBER · EXPERT · PARTNER
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "1.55rem", md: "1.8rem" },
            fontWeight: 500,
            color: "#0A1320",
            letterSpacing: "-0.015em",
            lineHeight: 1.2,
          }}
        >
          Sign in to your portal
        </Typography>
        <Typography sx={{ color: "#5C6673", fontSize: "0.88rem", lineHeight: 1.55, maxWidth: 380 }}>
          {step === "email"
            ? "We'll email you a 6-digit code. No password to remember. Your portal opens once your membership is active or your application is approved."
            : `Enter the 6-digit code we sent to ${email}.`}
        </Typography>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ fontSize: "0.82rem" }} onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}

      {step === "email" ? (
        <Box component="form" onSubmit={sendCode}>
          <Stack spacing={2}>
            <TextField
              label="Your email"
              type="email"
              size="small"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon sx={{ fontSize: 18, color: "#7A8590" }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={busy}
              endIcon={
                busy ? (
                  <CircularProgress size={14} sx={{ color: "inherit" }} />
                ) : (
                  <PinOutlinedIcon sx={{ fontSize: 18 }} />
                )
              }
              sx={{ py: 1.25, fontSize: "0.9rem", fontWeight: 600 }}
            >
              {busy ? "Sending…" : "Email me a sign-in code"}
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box component="form" onSubmit={verifyCode}>
          <Stack spacing={2}>
            <TextField
              label="6-digit code"
              size="small"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
              required
              fullWidth
              autoFocus
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PinOutlinedIcon sx={{ fontSize: 18, color: "#7A8590" }} />
                    </InputAdornment>
                  ),
                },
                htmlInput: {
                  inputMode: "numeric",
                  maxLength: 8,
                  style: { letterSpacing: "0.35em", fontWeight: 700 },
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={busy}
              endIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined}
              sx={{ py: 1.25, fontSize: "0.9rem", fontWeight: 600 }}
            >
              {busy ? "Verifying…" : "Verify & sign in"}
            </Button>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
              <Button
                size="small"
                onClick={() => {
                  setStep("email");
                  setErr(null);
                }}
                sx={{ color: "#5C6673", fontWeight: 600, fontSize: "0.8rem", px: 0 }}
              >
                Use a different email
              </Button>
              <Button
                size="small"
                onClick={() => void sendCode()}
                disabled={busy}
                sx={{ color: "#A87D2C", fontWeight: 600, fontSize: "0.8rem", px: 0 }}
              >
                Resend code
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      <Stack spacing={0.75} sx={{ textAlign: "center" }}>
        <Typography sx={{ color: "#9CA3AB", fontSize: "0.78rem" }}>
          Not a member yet?{" "}
          <Box
            component={Link}
            href="/#join"
            sx={{ color: "#5C6673", textDecoration: "underline", "&:hover": { color: "#0A1320" } }}
          >
            Join the founding waitlist
          </Box>
        </Typography>
        <Typography sx={{ color: "#9CA3AB", fontSize: "0.78rem" }}>
          Looking for the{" "}
          <Box
            component={Link}
            href="/admin/login"
            sx={{ color: "#5C6673", textDecoration: "underline", "&:hover": { color: "#0A1320" } }}
          >
            admin console
          </Box>
          ?
        </Typography>
      </Stack>
    </Stack>
  );
}

export default function PortalLoginPage() {
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "#F7F5F0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "relative",
          flexShrink: 0,
          borderBottom: "1px solid rgba(10,19,32,0.06)",
          bgcolor: "rgba(251,248,241,0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            sx={{
              minHeight: { xs: 56, md: 64 },
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box
              component={Link}
              href="/"
              sx={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 1.25 }}
            >
              <Box
                component="img"
                src="/asn-nav-icon.png"
                alt="Aesthetic Success Network"
                sx={{ width: 36, height: 36, borderRadius: "8px", flexShrink: 0 }}
              />
              <Box>
                <Typography
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.1rem",
                    color: "#0A1320",
                    lineHeight: 1.15,
                  }}
                >
                  Aesthetic Success Network
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.55rem",
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: "#A87D2C",
                    fontWeight: 700,
                  }}
                >
                  Powered by Business of Aesthetics
                </Typography>
              </Box>
            </Box>
            <Box
              component={Link}
              href="/"
              sx={{
                fontSize: "0.82rem",
                color: "#5C6673",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                "&:hover": { color: "#0A1320" },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: 14 }} /> Back to home
            </Box>
          </Stack>
        </Container>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: { xs: 4, md: 6 },
          overflow: "auto",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 420,
            bgcolor: "#FFFFFF",
            borderRadius: 3,
            border: "1px solid rgba(10,19,32,0.08)",
            boxShadow:
              "0 40px 80px -32px rgba(10,19,32,0.25), 0 12px 28px -18px rgba(10,19,32,0.12)",
            p: { xs: 3, md: 4 },
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: 0,
              left: "8%",
              right: "8%",
              height: 2,
              background: "linear-gradient(90deg, transparent, rgba(217,168,75,0.7), transparent)",
            }}
          />
          <Suspense
            fallback={
              <Stack spacing={2} sx={{ alignItems: "center", py: 4 }}>
                <CircularProgress size={24} sx={{ color: "#A87D2C" }} />
              </Stack>
            }
          >
            <PortalLoginInner />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}
