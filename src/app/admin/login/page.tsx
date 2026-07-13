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
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { createBrowserSupabase } from "@/lib/supabase/browser";

function AdminLoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialError = params.get("error");
  const redirect = params.get("redirect") ?? "/admin";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(initialError);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErr("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setErr(null);

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        // Admins must be pre-created in Supabase Authentication → Users
        // (and have a matching admin_users row). No auto-create.
        shouldCreateUser: false,
      },
    });

    if (error) {
      const msg = error.message ?? "";
      const isUserNotFound =
        /not allowed|not found|invalid/i.test(msg) || error.status === 422 || error.status === 400;
      setErr(
        isUserNotFound
          ? "That email isn't on the admin allow-list. Ask an owner-role admin to add you, then try again."
          : msg || "Could not send the sign-in code. Please try again.",
      );
    } else {
      setStep("code");
      setCode("");
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

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });

    if (error) {
      setErr(
        /expired/i.test(error.message ?? "")
          ? "That code has expired. Send a new one and try again."
          : "That code isn't right. Check the email and try again.",
      );
      setBusy(false);
      return;
    }

    // First-sign-in bootstrap: link the admin row + audit. A 403 means the
    // email isn't an active admin — sign straight back out.
    try {
      const res = await fetch("/api/admin/link-session", { method: "POST" });
      if (res.status === 403) {
        await supabase.auth.signOut();
        setErr("Your account is not an admin.");
        setStep("email");
        setBusy(false);
        return;
      }
    } catch {
      // Non-fatal — middleware still gates by email.
    }

    router.replace(redirect);
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
          <LockOutlinedIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography
          variant="overline"
          sx={{ color: "#A87D2C", letterSpacing: "0.18em", fontSize: "0.66rem", fontWeight: 700 }}
        >
          ADMIN CONSOLE
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
          Internal team sign-in
        </Typography>
        <Typography sx={{ color: "#5C6673", fontSize: "0.88rem", lineHeight: 1.55, maxWidth: 360 }}>
          {step === "email"
            ? "We'll email you a 6-digit sign-in code. Only emails on the admin allow-list can access the console."
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
              label="Admin email"
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

      <Typography sx={{ color: "#9CA3AB", fontSize: "0.78rem", textAlign: "center" }}>
        Not an admin?{" "}
        <Box
          component={Link}
          href="/"
          sx={{ color: "#5C6673", textDecoration: "underline", "&:hover": { color: "#0A1320" } }}
        >
          Go back to the homepage
        </Box>
      </Typography>
    </Stack>
  );
}

export default function AdminLoginPage() {
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
            <Box component={Link} href="/" sx={{ textDecoration: "none" }}>
              <Typography
                sx={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", color: "#0A1320" }}
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
            <AdminLoginInner />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}
