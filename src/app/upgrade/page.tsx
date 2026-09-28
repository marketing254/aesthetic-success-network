"use client";

import { trackEventOnce } from "@/lib/analytics";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import Logo from "@/components/brand/Logo";
import { SubscribeCard } from "@/components/member/SubscribeCard";
import { useSignOut } from "@/lib/auth/identity";

/**
 * /upgrade — the post-login paywall for members who haven't paid yet.
 *
 * Flow:
 *   1. Member finishes magic-link login → middleware sees no active sub →
 *      redirects /dashboard → /upgrade.
 *   2. Member picks a plan → /api/stripe/checkout returns a Stripe URL →
 *      browser redirects to Stripe Checkout.
 *   3. Stripe success → redirects back to /upgrade?subscribed=1.
 *      We poll /api/member/me; once webhook marks status='active',
 *      we forward to /dashboard.
 *   4. Stripe cancel → /upgrade?subscribed=0 → show a friendly note.
 */
export default function UpgradePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UpgradeInner />
    </Suspense>
  );
}

type Ctx = {
  firstName: string | null;
  email: string | null;
  subscriptionStatus: string | null;
  authed: boolean;
};

function UpgradeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const signOut = useSignOut();
  const justSubscribed = params.get("subscribed") === "1";
  const checkoutCanceled = params.get("subscribed") === "0";

  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [paidReady, setPaidReady] = useState(false); // cookie flow: payment landed, prompt login

  // Works for BOTH a logged-in member (session) and a just-signed-up member
  // who hasn't logged in yet (asn_checkout cookie). Returns null when neither.
  useEffect(() => {
    let active = true;
    fetch("/api/member/checkout-context", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: Ctx | null) => { if (active) setCtx(body); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const isActive =
    ctx?.subscriptionStatus === "active" || ctx?.subscriptionStatus === "trialing";

  // Already active + logged in → they belong in the portal, not here.
  // (Dev preview mode is exempt so a leftover test session can't bounce
  // the card view to /dashboard.)
  const previewMode = process.env.NODE_ENV !== "production" && params.get("preview") === "1";
  useEffect(() => {
    if (!previewMode && !loading && ctx?.authed && isActive && !justSubscribed) {
      router.replace("/dashboard");
    }
  }, [previewMode, loading, ctx?.authed, isActive, justSubscribed, router]);

  // Post-payment polling. Two tails:
  //  • Logged-in: once the webhook flips status→active, go to /dashboard.
  //  • Cookie flow (no session): once it's active, prompt them to LOG IN
  //    (they can't be sent to the portal without a session).
  useEffect(() => {
    if (!justSubscribed || !ctx) return;
    let attempts = 0;
    let cancelled = false;
    const tick = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch("/api/member/checkout-context", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as Ctx;
          if (body.subscriptionStatus === "active" || body.subscriptionStatus === "trialing") {
            clearInterval(tick);
            if (cancelled) return;
            // GA4 key event: subscription confirmed SERVER-SIDE (the
            // webhook flipped the status) — never fired off the redirect
            // param alone, and deduped across refreshes.
            trackEventOnce("upgrade_purchase", "purchase", { currency: "USD", method: "stripe_checkout" });
            if (body.authed) router.replace("/dashboard");
            else setPaidReady(true);
            return;
          }
        }
      } catch {
        /* retry next tick */
      }
      if (attempts >= 15) {
        clearInterval(tick);
        if (!cancelled) setPollExhausted(true);
      }
    }, 2000);
    return () => { cancelled = true; clearInterval(tick); };
  }, [justSubscribed, ctx, router]);

  if (loading) return <PageSkeleton />;

  // DEV ONLY: /upgrade?preview=1 renders the plan card with a fake context
  // so the page can be checked without doing a signup — it wins even over
  // a leftover test session in the browser. Compiled out of production
  // builds (NODE_ENV is inlined), so no bypass ships.
  if (process.env.NODE_ENV !== "production" && params.get("preview") === "1") {
    return (
      <PageShell signOut={() => router.push("/")}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Dev preview: fake member context, checkout will fail.
        </Alert>
        <SubscribeCard firstName="Preview" />
      </PageShell>
    );
  }

  const authed = !!ctx?.authed;
  const shellSignOut = authed ? signOut : () => router.push("/");

  if (!ctx) {
    return (
      <PageShell signOut={() => router.push("/join")}>
        <Alert severity="info" sx={{ mt: 4 }}>
          To choose a plan, start by{" "}
          <Link href="/join" style={{ color: "inherit", fontWeight: 700 }}>
            signing up
          </Link>
          . Already a member?{" "}
          <Link href="/member/login" style={{ color: "inherit", fontWeight: 700 }}>
            Log in
          </Link>
          .
        </Alert>
      </PageShell>
    );
  }

  // Cookie-flow member who is already paid (post-payment, or a re-signup of
  // an existing paid member) — they can't be sent to the portal without a
  // session, so prompt them to log in.
  if (!authed && (isActive || paidReady)) {
    return (
      <PageShell signOut={shellSignOut}>
        <PaymentDoneLogIn email={ctx.email} />
      </PageShell>
    );
  }

  return (
    <PageShell signOut={shellSignOut}>
      {justSubscribed && (
        <Box sx={{ mb: 3 }}>
          <ProcessingBanner variant={pollExhausted ? "stuck" : "pending"} authed={authed} email={ctx.email} />
        </Box>
      )}
      {checkoutCanceled && (
        <Box sx={{ mb: 3 }}>
          <CheckoutCanceledNote />
        </Box>
      )}
      <SubscribeCard firstName={ctx.firstName ?? "there"} />
    </PageShell>
  );
}

function PageShell({
  children,
  signOut,
}: {
  children: React.ReactNode;
  signOut: () => void;
}) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F7F5F0" }}>
      <Box
        sx={{
          borderBottom: "1px solid",
          borderColor: "rgba(14,42,61,0.08)",
          bgcolor: "rgba(255,255,255,0.7)",
          backdropFilter: "saturate(140%) blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", py: 1.5 }}
          >
            <Link href="/" style={{ display: "inline-flex", alignItems: "center" }}>
              <Logo height={32} />
            </Link>
            <Button
              variant="text"
              startIcon={<LogoutOutlinedIcon sx={{ fontSize: 18 }} />}
              onClick={signOut}
              sx={{
                color: "#0A1A2F",
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.86rem",
              }}
            >
              Sign out
            </Button>
          </Stack>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 3.5 } }}>
        {children}
      </Container>
    </Box>
  );
}

function PageSkeleton() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "#F7F5F0",
      }}
    >
      <CircularProgress sx={{ color: "#A07823" }} />
    </Box>
  );
}

function ProcessingBanner({
  variant,
  authed,
  email,
}: {
  variant: "pending" | "stuck";
  authed: boolean;
  email: string | null;
}) {
  const isStuck = variant === "stuck";
  const loginHref = email ? `/member/login?email=${encodeURIComponent(email)}` : "/member/login";
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor: isStuck ? "rgba(160,120,35,0.35)" : "rgba(31,92,64,0.25)",
        bgcolor: isStuck ? "rgba(217,168,75,0.08)" : "rgba(34,108,78,0.06)",
        p: 2.5,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <CircularProgress size={22} sx={{ color: isStuck ? "#A07823" : "#1F5C40" }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#0A1A2F" }}>
            {isStuck
              ? "Payment received: still confirming"
              : "Payment received: activating your membership…"}
          </Typography>
          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", mt: 0.5 }}>
            {isStuck
              ? "Stripe is taking a little longer than usual to confirm. Refresh in a moment. If it doesn't clear within 5 minutes, email hello@aestheticsuccessnetwork.com."
              : authed
                ? "Stripe just confirmed your payment. We're flipping the switch on your portal. You'll be redirected automatically."
                : "Stripe just confirmed your payment. As soon as it's active you'll be able to log in to your portal."}
          </Typography>
          {isStuck &&
            (authed ? (
              <Button
                variant="outlined"
                size="small"
                sx={{ mt: 1.25, textTransform: "none", fontWeight: 600 }}
                onClick={() => window.location.reload()}
              >
                Refresh now
              </Button>
            ) : (
              <Button
                component={Link}
                href={loginHref}
                variant="outlined"
                size="small"
                sx={{ mt: 1.25, textTransform: "none", fontWeight: 600 }}
              >
                Log in to your portal
              </Button>
            ))}
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * Pay-first flow: the member has paid but has no session yet. Send them to
 * log in — they're now a paid member, so login lands them on /dashboard.
 */
function PaymentDoneLogIn({ email }: { email: string | null }) {
  const loginHref = email ? `/member/login?email=${encodeURIComponent(email)}` : "/member/login";
  return (
    <Box sx={{ maxWidth: 520, mx: "auto", textAlign: "center", py: { xs: 4, md: 8 } }}>
      <CheckCircleRoundedIcon sx={{ fontSize: 56, color: "#1F5C40", mb: 1.5 }} />
      <Typography
        sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.7rem", md: "2.1rem" }, fontWeight: 500, color: "#0A1A2F", letterSpacing: "-0.01em", mb: 1 }}
      >
        You&apos;re in. Payment complete.
      </Typography>
      <Typography sx={{ fontSize: "1rem", color: "text.secondary", lineHeight: 1.6, mb: 3 }}>
        Your founding membership is active. Log in to enter your portal and we&apos;ll
        email you a 6-digit code{email ? ` at ${email}` : ""}.
      </Typography>
      <Button
        component={Link}
        href={loginHref}
        variant="contained"
        size="large"
        sx={{ bgcolor: "#0A1A2F", textTransform: "none", fontWeight: 700, borderRadius: 999, px: 4, py: 1.25, "&:hover": { bgcolor: "#132a44" } }}
      >
        Log in to your portal →
      </Button>
    </Box>
  );
}

function CheckoutCanceledNote() {
  return (
    <Alert
      severity="info"
      icon={<CheckCircleRoundedIcon sx={{ color: "#0A1A2F" }} />}
      sx={{
        borderRadius: 2,
        bgcolor: "rgba(14,42,61,0.06)",
        color: "#0A1A2F",
        border: "1px solid rgba(14,42,61,0.12)",
        "& .MuiAlert-icon": { color: "#0A1A2F" },
      }}
    >
      No payment was taken. Whenever you&apos;re ready, pick a plan below.
    </Alert>
  );
}
