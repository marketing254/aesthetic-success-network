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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Logo from "@/components/brand/Logo";
import { JOB_ROLES } from "@/lib/jobs/constants";

/**
 * Free job-seeker registration.
 *
 * Five fields, two of them required. That is deliberate and it is worth
 * defending when someone asks for a sixth: this form stands between a
 * candidate and the job they already decided to apply for, and every
 * field added to it costs applications. Name and email are what make the
 * account work; phone, city and the role they're after are what make the
 * captured list worth having, so they're asked but never enforced.
 *
 * The page also has to answer the unspoken question — "is this the $29
 * thing?" — before it asks for anything. Hence the line under the title.
 */

const JOB_PAGE_RE = /^\/jobs\/[a-z0-9-]{3,160}$/;

function SeekerJoinForm() {
  const router = useRouter();
  const params = useSearchParams();

  // Where they came from, so we can put them back. Validated here for a
  // tidy UI, and validated again server-side at verify time — this copy
  // is convenience, that one is the security boundary.
  const rawNext = params?.get("next") ?? "";
  const nextPath = JOB_PAGE_RE.test(rawNext) ? rawNext : null;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [roleInterest, setRoleInterest] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/seeker/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          city: city.trim() || null,
          job_role_interest: roleInterest || null,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        next?: string;
      };

      if (!res.ok || !body.ok) {
        // The "you're already a member" case ships its own next path.
        if (body.next) {
          setErr(body.error ?? "That email already has an account.");
          return;
        }
        setErr(body.error ?? "Couldn't create your account. Please try again.");
        return;
      }

      const target = body.next ?? "/seeker/login";
      router.push(nextPath ? `${target}&next=${encodeURIComponent(nextPath)}` : target);
    } catch {
      setErr("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={3} sx={{ alignItems: "center" }}>
        <Logo />

        <Paper
          elevation={0}
          sx={{
            width: "100%",
            p: { xs: 3, md: 4 },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          }}
        >
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Create a free account
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              You need an account to apply. It&apos;s free, and it lets you track
              where your applications got to. Membership is a separate,
              paid thing and nobody is asking you to buy it.
            </Typography>
          </Stack>

          {err && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {err}
              {err.includes("member account") && (
                <>
                  {" "}
                  <Link href="/member/login">Sign in instead</Link>.
                </>
              )}
            </Alert>
          )}

          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              <TextField
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                helperText="Your sign-in code comes here, and practices reply to it."
                fullWidth
              />
              <TextField
                label="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                helperText="Most practices call before they email."
                fullWidth
              />
              <TextField
                label="City or state (optional)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
                fullWidth
              />
              <TextField
                select
                label="Role you're looking for (optional)"
                value={roleInterest}
                onChange={(e) => setRoleInterest(e.target.value)}
                fullWidth
              >
                <MenuItem value="">
                  <em>Not sure yet</em>
                </MenuItem>
                {JOB_ROLES.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={busy}
                startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {busy ? "Creating your account…" : "Create free account"}
              </Button>

              <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
                Already have one? <Link href="/seeker/login">Sign in</Link>
              </Typography>
            </Stack>
          </Box>
        </Paper>
      </Stack>
    </Container>
  );
}

export default function SeekerJoinPage() {
  return (
    <Suspense fallback={null}>
      <SeekerJoinForm />
    </Suspense>
  );
}
