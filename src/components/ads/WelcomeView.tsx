"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import Logo from "@/components/brand/Logo";
import { initMetaPixel, trackMeta } from "@/components/ads/metaPixel";
import { trackEventOnce } from "@/lib/analytics";

/**
 * The paid-ads thank-you page UI (approved prototype thank-you.html).
 * All trust decisions were made SERVER-SIDE in /welcome/page.tsx — this
 * component only renders the verdict it was handed:
 *
 *   paid       → confirmation + auto sign-in attempt + portal button
 *   processing → neutral wait state polling the server (never activates
 *                anything client-side — the server stays the authority)
 *   invalid    → generic fallback, no details leaked
 */

export type WelcomeState = "paid" | "processing" | "invalid";

const INK = "#0a1320";
const CREAM = "#f7f5f0";
const GOLD = "#d9aa3f";
const GOLD_DARK = "#9b7420";
const GREEN = "#2c7a52";
const MUTED = "#68717b";
const LINE = "#ded9ce";

const TIMELINE = [
  ["Today", "You’re in", "Open the welcome email and watch the two-minute portal tour."],
  ["Day 3", "Start with one kit", "We point you to one practical resource instead of the whole library."],
  ["Day 7", "Ask one question", "Bring the Expert Hotline a real problem your practice is facing."],
  ["Day 14", "Tell us the truth", "Three short questions help ASN improve around what members need."],
] as const;

export default function WelcomeView({
  state: initialState,
  plan,
  sessionId,
  metaEventId,
  sameBrowser,
}: {
  state: WelcomeState;
  plan: "founding_monthly" | "founding_annual";
  sessionId: string | null;
  metaEventId: string | null;
  sameBrowser: boolean;
}) {
  const [state, setState] = useState<WelcomeState>(initialState);
  const [signedIn, setSignedIn] = useState<boolean | null>(sameBrowser ? null : false);
  const purchaseFired = useRef(false);

  const monthly = plan === "founding_monthly";

  // Browser-side Purchase pixel — ONLY on a server-confirmed page, with
  // the same event id the server's Conversions API call used, so Meta
  // de-duplicates. Refreshes are additionally guarded via sessionStorage.
  useEffect(() => {
    if (state !== "paid" || !metaEventId || purchaseFired.current) return;
    purchaseFired.current = true;
    try {
      const key = `asn_purchase_${metaEventId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable — event id dedup still protects */
    }
    initMetaPixel();
    trackMeta("PageView");
    trackMeta(
      "Purchase",
      { value: monthly ? 49.0 : 490.0, currency: "USD", content_name: plan },
      metaEventId,
    );
    // GA4 key event — same server-verified gate as the Meta Purchase.
    trackEventOnce(`welcome_${metaEventId}`, "purchase", {
      currency: "USD",
      value: monthly ? 49.0 : 490.0,
      method: "meta_ads_embedded",
    });
  }, [state, metaEventId, monthly, plan]);

  // Auto sign-in: server re-verifies the Stripe session AND the signed
  // HttpOnly cookie before minting a portal session. A pasted URL on a
  // different device never auto-signs-in.
  useEffect(() => {
    if (state !== "paid" || !sameBrowser || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ads/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
        if (!cancelled) setSignedIn(!!body.ok);
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, sameBrowser, sessionId]);

  // Processing → poll the server until Stripe confirms, then re-render.
  useEffect(() => {
    if (state !== "processing" || !sessionId) return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts > 40) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await fetch(`/api/ads/session?session_id=${encodeURIComponent(sessionId)}`);
        const body = (await res.json().catch(() => ({}))) as { state?: string };
        if (body.state === "paid") {
          clearInterval(timer);
          window.location.reload();
        }
        if (body.state === "invalid") clearInterval(timer);
      } catch {
        /* transient — keep polling */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [state, sessionId]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: CREAM, color: INK, fontFamily: "var(--font-body), Manrope, sans-serif" }}>
      <Box sx={{ height: 4, bgcolor: GOLD }} />
      <Container maxWidth="lg">
        <Stack direction="row" sx={{ height: { xs: 72, md: 88 }, alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${LINE}` }}>
          <Box sx={{ mt: -1.5, mb: -4 }}>
            <Logo href="/" height={120} ariaLabel="Aesthetic Success Network" />
          </Box>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED }}>
            Membership confirmed securely
          </Typography>
        </Stack>
      </Container>

      <Container maxWidth="lg" sx={{ py: { xs: 4.5, md: 8 } }}>
        {state === "invalid" && (
          <Box sx={{ maxWidth: 560, mx: "auto", textAlign: "center", py: 8 }}>
            <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "2.2rem", letterSpacing: "-0.03em", mb: 2 }}>
              This confirmation link isn’t valid.
            </Typography>
            <Typography sx={{ color: MUTED, fontSize: "0.95rem", mb: 4 }}>
              If you just paid, check your inbox for your welcome email. Your membership is safe.
              Otherwise you can start a membership or sign in below.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "center" }}>
              <Button href="/start" sx={{ "&&": { bgcolor: GOLD, color: "#111", fontWeight: 800, borderRadius: 999, px: 3.5, py: 1.4, textTransform: "none" } }}>
                Start a membership
              </Button>
              <Button href="/member/login" sx={{ "&&": { color: INK, fontWeight: 700, borderRadius: 999, px: 3.5, py: 1.4, textTransform: "none", border: `1px solid ${LINE}` } }}>
                Member sign in
              </Button>
            </Stack>
          </Box>
        )}

        {state === "processing" && (
          <Box sx={{ maxWidth: 560, mx: "auto", textAlign: "center", py: 10 }}>
            <CircularProgress size={28} sx={{ color: GOLD_DARK, mb: 3 }} />
            <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "2rem", letterSpacing: "-0.03em", mb: 1.5 }}>
              Confirming your payment…
            </Typography>
            <Typography sx={{ color: MUTED, fontSize: "0.92rem" }}>
              This usually takes a few seconds. Your membership activates the moment Stripe
              confirms. Don’t refresh or pay again; you won’t be charged twice.
            </Typography>
          </Box>
        )}

        {state === "paid" && (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1.08fr 0.92fr" },
                overflow: "hidden",
                borderRadius: { xs: "23px", md: "30px" },
                bgcolor: "#fff",
                boxShadow: "0 24px 70px rgba(25,31,38,0.12)",
                border: "1px solid rgba(10,19,32,0.08)",
              }}
            >
              <Box sx={{ p: { xs: 4, md: 7 } }}>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.75,
                    py: 1,
                    borderRadius: 999,
                    bgcolor: "#edf7f1",
                    color: "#236142",
                    fontSize: "0.64rem",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    "&::before": {
                      content: '"✓"',
                      display: "grid",
                      placeItems: "center",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      bgcolor: GREEN,
                      color: "#fff",
                    },
                  }}
                >
                  Payment confirmed
                </Box>
                <Typography component="h1" sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: "2.8rem", md: "4rem" }, letterSpacing: "-0.035em", lineHeight: 1.05, mt: 3 }}>
                  You’re in. Welcome to{" "}
                  <Box component="span" sx={{ color: GOLD_DARK, fontStyle: "italic" }}>ASN.</Box>
                </Typography>
                <Typography sx={{ mt: 2.5, color: MUTED, fontSize: "0.95rem", maxWidth: 570 }}>
                  Your membership is active and your founding rate is locked while your membership
                  remains active.
                </Typography>

                <Stack direction="row" spacing={1.6} sx={{ my: 3.25, p: 2.25, borderRadius: "15px", bgcolor: "#f4f1e9", color: "#49545f", fontSize: "0.76rem" }}>
                  <Box sx={{ display: "grid", placeItems: "center", flexShrink: 0, width: 34, height: 34, borderRadius: "50%", bgcolor: "#fff", color: GOLD_DARK }}>
                    ✉
                  </Box>
                  <Box>
                    <strong>Check your work inbox.</strong>
                    <br />
                    Your welcome email is on its way with the two-minute portal tour and a copy of
                    your membership details.
                  </Box>
                </Stack>

                {signedIn === false && !sameBrowser ? (
                  <Button
                    href="/member/login"
                    sx={{ "&&": { bgcolor: GOLD, color: "#111", fontWeight: 800, borderRadius: 999, px: 3.5, py: 1.6, textTransform: "none", fontSize: "0.95rem" }, "&&:hover": { bgcolor: "#e4b95f" } }}
                  >
                    Open my secure sign-in ›
                  </Button>
                ) : (
                  <Button
                    href="/dashboard"
                    disabled={signedIn === null}
                    sx={{
                      "&&": { bgcolor: GOLD, color: "#111", fontWeight: 800, borderRadius: 999, px: 3.5, py: 1.6, textTransform: "none", fontSize: "0.95rem", boxShadow: "0 12px 28px rgba(188,137,30,0.2)" },
                      "&&:hover": { bgcolor: "#e4b95f" },
                      "&&.Mui-disabled": { bgcolor: "#eadfc4", color: "#9a8f75" },
                    }}
                  >
                    {signedIn === null ? "Preparing your portal…" : "Enter the member portal ›"}
                  </Button>
                )}
                {signedIn === false && sameBrowser && (
                  <Typography sx={{ mt: 1.5, fontSize: "0.72rem", color: MUTED }}>
                    We couldn’t sign you in automatically. Use the button above and sign in with
                    your work email. Your membership is active.
                  </Typography>
                )}

                <Typography sx={{ mt: 3.25, pt: 2.75, borderTop: `1px solid ${LINE}`, fontSize: "0.72rem", color: MUTED }}>
                  Need help? Email membership support at{" "}
                  <Box component="a" href="mailto:founding@aestheticsuccessnetwork.com" sx={{ color: "#173650", fontWeight: 800, textDecoration: "none" }}>
                    founding@aestheticsuccessnetwork.com
                  </Box>
                  .
                </Typography>
              </Box>

              <Box sx={{ p: { xs: 4, md: 6 }, bgcolor: "#111820", color: "#fff" }}>
                <Typography sx={{ color: "#e7c66f", fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.13em", textTransform: "uppercase" }}>
                  Your membership
                </Typography>
                <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.9rem", mt: 1.25, mb: 3, color: "#FFFFFF" }}>
                  Founding member
                </Typography>
                <Box sx={{ p: 2.5, border: "1px solid rgba(217,170,63,0.4)", borderRadius: "18px", bgcolor: "#17202a" }}>
                  {(
                    [
                      ["Status", "Active"],
                      ["Billing", monthly ? "Monthly" : "Annual"],
                      ["Charged today", monthly ? "$49" : "$490"],
                      ["Next billing date", "Shown in your portal"],
                    ] as const
                  ).map(([k, v], i, arr) => (
                    <Stack key={k} direction="row" sx={{ justifyContent: "space-between", gap: 2, py: 1.4, borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.1)" : 0, fontSize: "0.72rem", color: "rgba(255,255,255,0.68)" }}>
                      <span>{k}</span>
                      <Box component="strong" sx={{ color: "#fff", textAlign: "right" }}>{v}</Box>
                    </Stack>
                  ))}
                </Box>
                <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "2.8rem", mt: 3, mb: 0.75, lineHeight: 1, color: "#FFFFFF" }}>
                  {monthly ? "$49" : "$490"}{" "}
                  <Box component="span" sx={{ fontFamily: "var(--font-body), Manrope, sans-serif", fontWeight: 700, fontSize: "0.76rem", color: "rgba(255,255,255,0.65)" }}>
                    {monthly ? "/month" : "/year"}
                  </Box>
                </Typography>
                <Typography sx={{ color: "#e7c66f", fontSize: "0.64rem", fontWeight: 700 }}>
                  30-day money-back guarantee · Cancel anytime
                </Typography>
              </Box>
            </Box>

            {/* What happens next */}
            <Box sx={{ pt: { xs: 7, md: 9 } }}>
              <Box sx={{ textAlign: "center", maxWidth: 680, mx: "auto" }}>
                <Typography sx={{ color: GOLD_DARK, fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  What happens next
                </Typography>
                <Typography component="h2" sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: "2.2rem", md: "3rem" }, letterSpacing: "-0.03em", mt: 1 }}>
                  One useful step at a time.
                </Typography>
                <Typography sx={{ color: MUTED, fontSize: "0.88rem", mt: 1.5 }}>
                  Your ASN onboarding sequence begins now. No extra forms are required
                  before entering the portal.
                </Typography>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.6, mt: 4.25 }}>
                {TIMELINE.map(([when, title, body]) => (
                  <Box key={when} sx={{ p: 2.75, border: `1px solid ${LINE}`, borderRadius: "17px", bgcolor: "rgba(255,255,255,0.58)" }}>
                    <Typography sx={{ color: GOLD_DARK, fontSize: "0.64rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>{when}</Typography>
                    <Typography sx={{ mt: 2, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.18rem", lineHeight: 1.1 }}>{title}</Typography>
                    <Typography sx={{ mt: 1.1, color: MUTED, fontSize: "0.72rem" }}>{body}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}
      </Container>

      <Box component="footer" sx={{ py: 4, borderTop: `1px solid ${LINE}`, color: "#7a8189", fontSize: "0.66rem", textAlign: "center" }}>
        © Aesthetic Success Network · Powered by Business of Aesthetics
      </Box>
    </Box>
  );
}
