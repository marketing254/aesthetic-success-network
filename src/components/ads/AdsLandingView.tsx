"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import Logo from "@/components/brand/Logo";
import { initMetaPixel, trackMeta } from "@/components/ads/metaPixel";
import { trackEvent } from "@/lib/analytics";
import { memberRoles } from "@/lib/content";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";

/**
 * /start — the Meta paid-ads direct-purchase page (ported from the approved
 * DMN prototype "Paid Ads Developer Package - 2026-08-27", ASN copy). One
 * page: pitch → short form → Stripe EMBEDDED checkout → /welcome.
 *
 * ASN rules: founding $49/$490 only (no early tier, no private offer), no
 * named experts or photos, no em-dashes in rendered copy, and the
 * "Resource library" nav pill + library strip render only when
 * NEXT_PUBLIC_SHOW_JUST_DROPPED === "true".
 *
 * Traffic & security posture:
 *   - This page is fully static (no DB reads on view) so ad spikes hit
 *     the CDN, not the database. The only server work happens on submit.
 *   - Card entry is Stripe's iframe — card data never exists in our DOM
 *     or JS, so the console/network/application tabs have nothing to take.
 *   - The client only ever sends a plan KEY; prices and activation are
 *     decided server-side. PUBLIC OFFER ONLY — no promo/trial UI exists
 *     on this page by design (the 3-month arrangement is private).
 */

const INK = "#0a1320";
const NAVY = "#173650";
const CREAM = "#f7f5f0";
const GOLD = "#d9aa3f";
const GOLD_DARK = "#9b7420";
const GREEN = "#2c7a52";
const MUTED = "#68717b";
const LINE = "#ded9ce";

const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

// Role options come from the canonical ASN list (single source of truth).
const ROLES = memberRoles;

// The library strip and its nav pill are held back until the first kits
// exist (NEXT_PUBLIC_SHOW_JUST_DROPPED=true). No named experts, no photos.
const SHOW_LIBRARY = process.env.NEXT_PUBLIC_SHOW_JUST_DROPPED === "true";

// Un-named value cards for the library strip (replaces the DMN expert cards).
const VALUE_CARDS = [
  { Icon: ForumOutlinedIcon, title: "Expert Hotline", body: "Leave a voicemail. Get a written action plan by text and email within 2 to 3 business days, with the experts worth talking to." },
  { Icon: MenuBookOutlinedIcon, title: "Resource library", body: "A growing library of expert kits: training video, action guide, checklist, worksheet and slide deck, produced from real expert sessions." },
  { Icon: StorefrontOutlinedIcon, title: "Partner deals", body: "Member-only offers from vetted partners, each at least as good as any deal they make comparable customers." },
];

// Ad-creative hero variants (?creative=…). Applied on mount so the page
// itself stays fully static. No named experts.
const CREATIVE_VARIANTS: Record<string, { badge: string; title: [string, string]; copy: string }> = {
  savings: {
    badge: "Vetted partner savings",
    title: ["Membership savings for your ", "practice."],
    copy: "Access confirmed member-only offers from vetted partners alongside ASN's experts, expert kits, tools and the wider partner network.",
  },
  hotline: {
    badge: "The ASN Expert Hotline",
    title: ["When your practice gets stuck, get a ", "written next step."],
    copy: "Describe the problem in plain English. Get a first answer right away, and when you need a person, our team comes back in writing within 2 to 3 business days with the right experts to talk to.",
  },
};

const DEFAULT_HERO = {
  badge: "Curated by the Business of Aesthetics team, not an algorithm",
  title: ["Never solve a practice problem ", "alone again."] as [string, string],
  copy: "Bring ASN any practice problem. Get a written answer, and the right expert to talk to. Plus a growing library of expert kits from vetted experts.",
};

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

const kicker = {
  color: GOLD_DARK,
  fontSize: "0.7rem",
  fontWeight: 800,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
} as const;

const display = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.03em",
  lineHeight: 1.06,
  fontWeight: 600,
  color: INK,
} as const;

export default function AdsLandingView() {
  const [hero, setHero] = useState(DEFAULT_HERO);
  const [plan, setPlan] = useState<"founding_monthly" | "founding_annual">("founding_monthly");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    practiceName: "",
    role: "",
    agree: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const tracking = useRef<{ utm: Record<string, string>; fbclid: string | null; landingUrl: string | null }>({
    utm: {},
    fbclid: null,
    landingUrl: null,
  });
  // Abandoned-registration resume: token from the recovery emails.
  // codeState mirrors the server's verdict on the one-month-free code —
  // the code VALUE never reaches the browser; it is applied server-side.
  const [resumeToken, setResumeToken] = useState<string | null>(null);
  const [codeState, setCodeState] = useState<"none" | "active" | "expired">("none");
  const abandonCaptured = useRef<string>("");

  // Campaign context + pixel — read once on mount so the page itself is
  // static/CDN-cacheable no matter what query string the ad appends.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const creative = q.get("creative");
    if (creative && CREATIVE_VARIANTS[creative]) setHero(CREATIVE_VARIANTS[creative]);
    const utm: Record<string, string> = {};
    for (const k of ["source", "medium", "campaign", "content", "term"]) {
      const v = q.get(`utm_${k}`);
      if (v) utm[k] = v.slice(0, 200);
    }
    if (!utm.source) utm.source = "meta";
    if (!utm.medium) utm.medium = "paid_social";
    if (!utm.content && creative) utm.content = creative;
    tracking.current = {
      utm,
      fbclid: q.get("fbclid"),
      landingUrl: window.location.origin + window.location.pathname,
    };
    initMetaPixel();
    trackMeta("PageView");
    trackMeta("ViewContent", { content_name: "asn_founding_membership" });

    // Resume link from the recovery emails: prefill everything they had
    // filled and take them straight to the payment section.
    const resume = q.get("resume");
    if (resume && /^[A-Za-z0-9_-]{16,64}$/.test(resume)) {
      (async () => {
        try {
          const res = await fetch(`/api/ads/resume?token=${encodeURIComponent(resume)}`);
          const body = (await res.json().catch(() => ({}))) as {
            ok?: boolean; firstName?: string | null; lastName?: string | null; email?: string;
            practiceName?: string | null; role?: string | null; plan?: string | null;
            codeState?: "none" | "active" | "expired";
          };
          if (!body.ok) return;
          setResumeToken(resume);
          setCodeState(body.codeState ?? "none");
          setForm((f) => ({
            ...f,
            firstName: body.firstName ?? f.firstName,
            lastName: body.lastName ?? f.lastName,
            email: body.email ?? f.email,
            practiceName: body.practiceName ?? f.practiceName,
            role: body.role && ROLES.includes(body.role) ? body.role : f.role,
          }));
          if (body.plan === "founding_annual" || body.plan === "founding_monthly") setPlan(body.plan);
          document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
        } catch {
          /* resume is best-effort — the plain form still works */
        }
      })();
    }
  }, []);

  const monthly = plan === "founding_monthly";
  const priceLabel = monthly ? "$49/month" : "$490/year";

  const canSubmit =
    form.firstName.trim() &&
    form.lastName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()) &&
    form.practiceName.trim() &&
    form.role &&
    form.agree;

  // Partial-registration capture — fires once the work email is valid
  // (and refreshes on Continue). keepalive so a tab close doesn't lose
  // it. The server enforces the 30-day one-sequence rule; a repeat here
  // never restarts anything.
  const captureAbandon = useCallback((f: typeof form, planNow: string) => {
    const email = f.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
    const snapshot = JSON.stringify([email, f.firstName, f.lastName, f.practiceName, f.role, planNow]);
    if (abandonCaptured.current === snapshot) return;
    abandonCaptured.current = snapshot;
    try {
      void fetch("/api/ads/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          email,
          firstName: f.firstName.trim() || null,
          lastName: f.lastName.trim() || null,
          practiceName: f.practiceName.trim() || null,
          role: f.role || null,
          plan: planNow,
          utm: tracking.current.utm,
        }),
      });
    } catch {
      /* capture must never affect the visitor */
    }
  }, []);

  const startCheckout = useCallback(async () => {
    if (!canSubmit || submitting) return;
    captureAbandon(form, plan);
    setSubmitting(true);
    setErrorMsg(null);
    setAlreadyMember(false);
    try {
      const res = await fetch("/api/ads/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          practiceName: form.practiceName.trim(),
          role: form.role,
          plan,
          agreementAccepted: form.agree,
          utm: tracking.current.utm,
          fbclid: tracking.current.fbclid,
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc"),
          landingUrl: tracking.current.landingUrl,
          resumeToken,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        clientSecret?: string;
        error?: string;
        alreadyMember?: boolean;
      };
      if (!res.ok || !body.clientSecret) {
        if (body.alreadyMember) setAlreadyMember(true);
        setErrorMsg(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      // GA4 key events: account created + embedded checkout opened.
      trackEvent("sign_up", { method: "meta_ads" });
      trackEvent("begin_checkout", {
        currency: "USD",
        value: plan === "founding_annual" ? 490 : 49,
        items: [{ item_id: plan, item_name: plan }],
      });
      // Meta standard InitiateCheckout — fired exactly once per checkout
      // attempt (this success path runs once per Continue click that
      // actually opens the Stripe form), with plan value + an eventID.
      trackMeta(
        "InitiateCheckout",
        { value: plan === "founding_annual" ? 490 : 49, currency: "USD", content_name: plan },
        (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `ic-${Date.now()}`,
      );
      setClientSecret(body.clientSecret);
    } catch {
      setErrorMsg("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitting, form, plan, resumeToken, captureAbandon]);

  const field = (label: string, key: keyof typeof form, opts?: { type?: string; auto?: string; onBlur?: () => void }) => (
    <Box>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#44505c", mb: 0.6 }}>
        {label} *
      </Typography>
      <TextField
        fullWidth
        size="small"
        type={opts?.type}
        autoComplete={opts?.auto}
        onBlur={opts?.onBlur}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: "14px",
            bgcolor: "#fff",
            // 16px on phones: anything smaller makes iOS Safari zoom in
            // when the field is focused, and the zoom sticks.
            fontSize: { xs: "1rem", md: "0.85rem" },
            height: { xs: 42, md: 44 },
          },
          "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: GOLD_DARK,
          },
        }}
      />
    </Box>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: CREAM, color: INK, fontFamily: "var(--font-body), Manrope, sans-serif" }}>
      <Box sx={{ height: 4, bgcolor: GOLD }} />

      {/* Header */}
      <Container maxWidth="lg">
        <Stack
          direction="row"
          sx={{ height: { xs: 72, md: 86 }, alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${LINE}` }}
        >
          <Box sx={{ mt: -1.5, mb: -4 }}>
            <Logo href="/start" height={120} ariaLabel="Aesthetic Success Network" />
          </Box>

          {/* Section nav pill (desktop) — in-page anchors, matching the
              approved prototype's navbar. */}
          <Stack
            direction="row"
            component="nav"
            aria-label="Page sections"
            sx={{
              display: { xs: "none", lg: "flex" },
              alignItems: "center",
              gap: 0.5,
              p: 0.6,
              border: `1px solid ${LINE}`,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.62)",
            }}
          >
            {(
              [
                ...(SHOW_LIBRARY ? ([["Resource library", "#library"]] as const) : []),
                ["Expert Hotline", "#hotline"],
                ["What is included", "#inside"],
                ["Pricing", "#checkout"],
                ["FAQ", "#faq"],
              ] as ReadonlyArray<readonly [string, string]>
            ).map(([label, href]) => (
              <Box
                key={href}
                component="a"
                href={href}
                sx={{
                  px: 1.75,
                  py: 1.1,
                  borderRadius: 999,
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  color: INK,
                  textDecoration: "none",
                  transition: "background-color 180ms ease",
                  "&:hover": { bgcolor: "#fff" },
                }}
              >
                {label}
              </Box>
            ))}
          </Stack>

          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.76rem", fontWeight: 700, color: MUTED }}>
              Founding membership
            </Typography>
            <Button
              href="#checkout"
              sx={{
                "&&": {
                  bgcolor: GOLD,
                  color: "#111",
                  fontWeight: 800,
                  borderRadius: 999,
                  px: 3,
                  py: 1.1,
                  textTransform: "none",
                  fontSize: "0.85rem",
                },
                "&&:hover": { bgcolor: "#e4b95f" },
              }}
            >
              Start membership
            </Button>
          </Stack>
        </Stack>
      </Container>

      {/* Hero */}
      <Box component="section" sx={{ position: "relative", overflow: "hidden", textAlign: "center", pt: { xs: 3.5, md: 6 }, pb: { xs: 4.5, md: 6 } }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              px: 1.75,
              py: 1,
              border: `1px solid ${LINE}`,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.55)",
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#56606b",
              "&::before": { content: '"✦"', color: GOLD_DARK },
            }}
          >
            {hero.badge}
          </Box>
          <Typography component="h1" sx={{ ...display, fontSize: { xs: "2.8rem", md: "4.4rem" }, maxWidth: 980, mx: "auto", mt: { xs: 2, md: 2.5 } }}>
            {hero.title[0]}
            <Box component="span" sx={{ color: GOLD_DARK, fontStyle: "italic" }}>{hero.title[1]}</Box>
          </Typography>
          <Typography sx={{ maxWidth: 900, mx: "auto", mt: 2, color: "#59636e", fontSize: { xs: "0.95rem", md: "1.1rem" }, lineHeight: 1.6 }}>
            {hero.copy}
          </Typography>
          <Stack sx={{ alignItems: "center", mt: { xs: 3, md: 3.5 } }}>
            <Button
              href="#checkout"
              sx={{
                "&&": { bgcolor: GOLD, color: "#111", fontWeight: 800, borderRadius: 999, px: 3.5, py: 1.5, textTransform: "none", fontSize: "0.95rem" },
                "&&:hover": { bgcolor: "#e4b95f" },
              }}
            >
              Start your membership ›
            </Button>
            <Typography sx={{ mt: 1.5, fontSize: { xs: "1.05rem", md: "1.15rem" }, fontWeight: 700, color: INK, lineHeight: 1.3 }}>
              Membership from $49/month
            </Typography>
            <Typography sx={{ mt: 0.4, fontSize: "0.8rem", fontWeight: 600, color: "#5b6570" }}>
              Founding rate · locked while active
            </Typography>
          </Stack>
          <Stack direction="row" sx={{ justifyContent: "center", flexWrap: "wrap", gap: "10px 26px", mt: 2.75, color: "#333d47", fontSize: { xs: "0.88rem", md: "0.92rem" }, fontWeight: 600 }}>
            {["30-day money-back guarantee", "Cancel anytime", "Real human replies"].map((t) => (
              <Box key={t} component="span" sx={{ "&::before": { content: '"✓"', mr: 0.9, color: GREEN, fontWeight: 900 } }}>
                {t}
              </Box>
            ))}
          </Stack>
          <Typography sx={{ maxWidth: 900, mx: "auto", mt: 3, pt: 2, borderTop: `1px solid ${LINE}`, fontSize: "0.8rem", color: "#717780" }}>
            One short form. Choose monthly or annual and pay securely on this page, no registration detour.
          </Typography>

          {/* Founded-by endorsement — a quiet, engraved lockup between the
              hero and the library. */}
          <Stack
            direction="row"
            spacing={{ xs: 2, md: 3.5 }}
            sx={{ alignItems: "center", justifyContent: "center", mt: { xs: 3.5, md: 4.5 } }}
          >
            <Box
              sx={{
                height: "1px",
                width: { xs: 48, sm: 120, md: 170 },
                background: `linear-gradient(to right, transparent, ${GOLD})`,
              }}
            />
            <Box sx={{ textAlign: "center", whiteSpace: "nowrap" }}>
              <Typography
                sx={{
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  letterSpacing: "0.42em",
                  textIndent: "0.42em",
                  textTransform: "uppercase",
                  color: MUTED,
                  mb: 0.5,
                }}
              >
                Powered by
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: { xs: "1.35rem", md: "1.7rem" },
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                  color: INK,
                }}
              >
                Business of{" "}
                <Box component="span" sx={{ color: GOLD_DARK, fontStyle: "italic" }}>
                  Aesthetics
                </Box>
              </Typography>
            </Box>
            <Box
              sx={{
                height: "1px",
                width: { xs: 48, sm: 120, md: 170 },
                background: `linear-gradient(to left, transparent, ${GOLD})`,
              }}
            />
          </Stack>
        </Container>
      </Box>

      {/* Library strip (held back until NEXT_PUBLIC_SHOW_JUST_DROPPED=true):
          three un-named value cards, no expert names, no photos. */}
      {SHOW_LIBRARY && (
        <Box component="section" id="library" sx={{ bgcolor: "#eee9de", borderTop: "1px solid #e2dccf", borderBottom: "1px solid #e2dccf", py: { xs: 6, md: 8 }, scrollMarginTop: 16 }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", maxWidth: 900, mx: "auto", mb: 4 }}>
              <Typography sx={kicker}>Resource library</Typography>
              <Typography component="h2" sx={{ ...display, fontSize: { xs: "2.2rem", md: "3.2rem" }, mt: 1.25 }}>
                Expert advice your team can run on Monday.
              </Typography>
              <Typography sx={{ mt: 2, color: MUTED, fontSize: "1rem" }}>
                Each kit turns one expert session into a short training video, a guide, a checklist, a worksheet and a wall poster.
              </Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
              {VALUE_CARDS.map(({ Icon, title, body }) => (
                <Box key={title} sx={{ p: { xs: 2.75, md: 3.25 }, borderRadius: "18px", bgcolor: "#fff", border: `1px solid ${LINE}`, boxShadow: "0 16px 38px rgba(23,35,49,0.08)" }}>
                  <Icon sx={{ fontSize: 26, color: GOLD_DARK }} />
                  <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.35rem", mt: 1.5, lineHeight: 1.15 }}>{title}</Typography>
                  <Typography sx={{ color: MUTED, fontSize: "0.88rem", mt: 1, lineHeight: 1.6 }}>{body}</Typography>
                </Box>
              ))}
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 3, justifyContent: "center", alignItems: "center" }}>
              <Button
                href="#checkout"
                sx={{
                  "&&": { bgcolor: GOLD, color: "#111", fontWeight: 800, borderRadius: 999, px: 3, py: 1.2, textTransform: "none", fontSize: "0.9rem" },
                  "&&:hover": { bgcolor: "#e4b95f" },
                }}
              >
                Join ASN: $49/month
              </Button>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Annual option: $490 · 30-day money-back guarantee</Typography>
            </Stack>
          </Container>
        </Box>
      )}

      {/* Hotline */}
      <Box component="section" id="hotline" sx={{ pt: { xs: 6, md: 7 }, pb: { xs: 6, md: 8 }, scrollMarginTop: 16 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "0.9fr 1.1fr" }, alignItems: "center", gap: { xs: 5, md: 8.5 } }}>
            <Box>
              <Typography sx={kicker}>The Expert Hotline</Typography>
              <Typography component="h2" sx={{ ...display, fontSize: { xs: "2.4rem", md: "3.4rem" }, my: 2 }}>
                Stuck? Put a human on it.
              </Typography>
              <Typography sx={{ color: MUTED, fontSize: "1rem" }}>
                ASN does not leave you with another search box. Bring us the practice problem in plain English.
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 3.25 }}>
                {[
                  ["Describe the problem", "Financial, team or operational. Leave a voicemail or type it in the portal."],
                  ["Get a first answer right away", "Beacon answers from our experts’ own sessions, with links to the right page."],
                  ["Need a person?", "Our team comes back to you in writing within 2 to 3 business days, with the experts worth calling."],
                ].map(([title, sub], i) => (
                  <Stack key={title} direction="row" spacing={1.6} sx={{ alignItems: "flex-start" }}>
                    <Box sx={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: "50%", bgcolor: GOLD, fontSize: "0.8rem", fontWeight: 800, flexShrink: 0 }}>
                      {i + 1}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</Typography>
                      <Typography sx={{ color: MUTED, fontSize: "0.82rem" }}>{sub}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>
            <Box sx={{ p: { xs: 3, md: 4.25 }, borderRadius: "28px", bgcolor: "#fff", boxShadow: "0 20px 60px rgba(25,31,38,0.10)", border: "1px solid rgba(255,255,255,0.85)" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: GOLD_DARK }}>
                <span>Illustrative example</span>
                <span>ASN</span>
              </Stack>
              <Typography sx={{ my: { xs: 3, md: 4 }, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: "1.5rem", md: "1.9rem" }, lineHeight: 1.22 }}>
                “Our injectables bookings have been flat for six months.”
              </Typography>
              <Typography sx={{ p: 2.25, borderRadius: "16px", bgcolor: "#f1eee6", color: "#53606c", fontSize: "0.82rem" }}>
                A written answer, the kit that fits, and the expert worth calling, so the practice can decide what to do next.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Value */}
      <Box component="section" id="inside" sx={{ bgcolor: NAVY, color: "#fff", py: { xs: 6, md: 8 }, scrollMarginTop: 16 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", maxWidth: 900, mx: "auto", mb: 4 }}>
            <Typography sx={{ ...kicker, color: "#e9c979" }}>One membership</Typography>
            <Typography component="h2" sx={{ ...display, color: "#fff", fontSize: { xs: "2.2rem", md: "3.2rem" }, mt: 1.25 }}>
              What your practice unlocks.
            </Typography>
            <Typography sx={{ mt: 2, color: "rgba(255,255,255,0.64)", fontSize: "1rem" }}>
              Practical tools, expert support and more ways to learn and connect.
            </Typography>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 2 }}>
            {(
              [
                ["Put into practice", MenuBookOutlinedIcon, "Resource library", "Expert kits: training videos, guides, checklists and worksheets your team can put to use."],
                ["Ask an expert", ForumOutlinedIcon, "Expert Hotline", "Ask any practice problem in plain English. Beacon answers right away, and our team follows up in writing within 2 to 3 business days when you need a person."],
                ["Run the numbers", CalculateOutlinedIcon, "Tools and templates", "Practice calculators and templates built for aesthetic practice owners, ready in the portal."],
                ["Save on what you already buy", StorefrontOutlinedIcon, "Partner deals and member offers", "Explore the expert and partner directories and claim confirmed member-only offers from vetted partners."],
              ] as const
            ).map(([b, Icon, h, p]) => (
              <Box key={h} sx={{ p: { xs: 2.75, md: 3.25 }, border: "1px solid rgba(255,255,255,0.14)", borderRadius: "20px", bgcolor: "rgba(255,255,255,0.06)" }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1.5 }}>
                  <Typography sx={{ color: "#e9c979", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", lineHeight: 1.5 }}>{b}</Typography>
                  <Icon sx={{ fontSize: 20, color: "#e9c979", flexShrink: 0 }} />
                </Stack>
                <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.45rem", mt: 2, color: "#fff", lineHeight: 1.15 }}>{h}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.68)", fontSize: "0.86rem", mt: 1.25, lineHeight: 1.6 }}>{p}</Typography>
              </Box>
            ))}
          </Box>
          <Stack sx={{ alignItems: "center", mt: { xs: 4, md: 5 } }}>
            <Button
              href="#checkout"
              sx={{
                "&&": { bgcolor: GOLD, color: "#111", fontWeight: 800, borderRadius: 999, px: 3.75, py: 1.4, textTransform: "none", fontSize: "0.95rem" },
                "&&:hover": { bgcolor: "#e4b95f" },
              }}
            >
              Explore membership: $49/month
            </Button>
            <Typography sx={{ mt: 1.5, fontSize: "0.8rem", color: "rgba(255,255,255,0.62)" }}>
              Annual option: $490 · 30-day money-back guarantee
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Checkout */}
      <Box component="section" id="checkout" sx={{ pt: { xs: 5, md: 6 }, pb: { xs: 6, md: 8 }, scrollMarginTop: 18 }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "0.82fr 1.18fr" },
              overflow: "hidden",
              borderRadius: { xs: "23px", md: "30px" },
              bgcolor: "#fff",
              boxShadow: "0 20px 60px rgba(25,31,38,0.10)",
              border: "1px solid rgba(10,19,32,0.08)",
              // Small phones (320–359px, e.g. iPhone SE 1st gen and compact
              // Androids): Stripe's embedded checkout lays itself out at a
              // minimum of roughly 290px, so the card runs edge to edge
              // here to give it that room. Standard phones are untouched.
              "@media (max-width: 359px)": { mx: -2, borderRadius: 0 },
            }}
          >
            {/* Summary */}
            <Box sx={{ p: { xs: 2.5, sm: 3, md: 6 }, minWidth: 0, bgcolor: "#111820", color: "#fff" }}>
              <Typography sx={{ ...kicker, color: "#e9c979" }}>Founding membership</Typography>
              <Typography component="h2" sx={{ ...display, color: "#fff", fontSize: { xs: "2.4rem", md: "3.2rem" }, mt: 1.25 }}>
                Join ASN today.
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.67)", fontSize: "0.88rem", my: 2.5 }}>
                One short form. Choose your plan and pay securely without leaving this page.
              </Typography>

              {/* Plan toggle */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, p: 0.6, border: "1px solid rgba(255,255,255,0.16)", borderRadius: 999, bgcolor: "rgba(255,255,255,0.06)" }}>
                {(
                  [
                    ["founding_monthly", "Monthly · $49"],
                    ["founding_annual", "Annual · $490"],
                  ] as const
                ).map(([key, label]) => (
                  <Box
                    key={key}
                    component="button"
                    type="button"
                    onClick={() => {
                      if (!clientSecret) setPlan(key);
                    }}
                    disabled={!!clientSecret}
                    sx={{
                      border: 0,
                      cursor: clientSecret ? "default" : "pointer",
                      py: 1.4,
                      px: 1,
                      borderRadius: 999,
                      textAlign: "center",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      fontFamily: "inherit",
                      bgcolor: plan === key ? "#fff" : "transparent",
                      color: plan === key ? "#111820" : "rgba(255,255,255,0.65)",
                      opacity: clientSecret && plan !== key ? 0.4 : 1,
                      transition: "all 180ms ease",
                    }}
                  >
                    {label}
                  </Box>
                ))}
              </Box>

              <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "3.4rem", mt: 3.5, mb: 0.75, lineHeight: 1, color: "#FFFFFF" }}>
                {monthly ? "$49" : "$490"}{" "}
                <Box component="span" sx={{ fontFamily: "var(--font-body), Manrope, sans-serif", fontWeight: 700, fontSize: "0.82rem", color: "rgba(255,255,255,0.68)" }}>
                  {monthly ? "/month" : "/year"}
                </Box>
              </Typography>
              <Typography sx={{ minHeight: 20, color: "#e8c76f", fontSize: "0.7rem", fontWeight: 700 }}>
                {monthly
                  ? "Founding rate locked while your membership stays active"
                  : "Save two months · equivalent to $40.83/month"}
              </Typography>

              <Box component="ul" sx={{ listStyle: "none", p: 0, mt: 3, mb: 0, color: "rgba(255,255,255,0.77)", fontSize: "0.76rem" }}>
                {[
                  "Expert Hotline and written practice support",
                  "Expert kits, tools and templates",
                  "Vetted partners and member offers",
                  "30-day money-back guarantee",
                  "Cancel anytime",
                ].map((li) => (
                  <Box key={li} component="li" sx={{ py: 1.25, borderBottom: "1px solid rgba(255,255,255,0.1)", "&::before": { content: '"✓"', color: "#e5c570", fontWeight: 900, mr: 1.1 } }}>
                    {li}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Form / embedded payment */}
            <Box sx={{ p: { xs: 2, sm: 3, md: 6 }, minWidth: 0, bgcolor: "#fff", "@media (max-width: 359px)": { px: 1.25 } }}>
              {clientSecret && stripePromise ? (
                <>
                  <Typography sx={{ ...kicker, fontSize: "0.64rem" }}>Secure payment · Stripe</Typography>
                  <Typography component="h3" sx={{ ...display, fontSize: { xs: "1.8rem", md: "2.2rem" }, mt: 0.75, mb: 1 }}>
                    Complete your payment
                  </Typography>
                  <Typography sx={{ mb: 2.5, color: MUTED, fontSize: "0.82rem", overflowWrap: "anywhere" }}>
                    {form.email} · {priceLabel}.{" "}
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setClientSecret(null)}
                      sx={{ border: 0, p: 0, bgcolor: "transparent", color: GOLD_DARK, fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: "inherit" }}
                    >
                      Edit details
                    </Box>
                  </Typography>
                  <Box
                    sx={{
                      width: "100%",
                      maxWidth: "100%",
                      minWidth: 0,
                      "& > div": { width: "100%", maxWidth: "100%" },
                      "& iframe": { width: "100% !important", maxWidth: "100%" },
                    }}
                  >
                    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                      <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                  </Box>
                </>
              ) : (
                <>
                  <Typography sx={{ ...kicker, fontSize: "0.64rem" }}>Secure one-page registration</Typography>
                  <Typography component="h3" sx={{ ...display, fontSize: { xs: "1.8rem", md: "2.2rem" }, mt: 0.75, mb: 1 }}>
                    Create your membership
                  </Typography>
                  {codeState === "active" && (
                    <Box sx={{ mb: 2.5, p: 1.75, borderRadius: "12px", bgcolor: "rgba(44,122,82,0.09)", border: "1px solid rgba(44,122,82,0.35)", color: "#1F5238", fontSize: "0.82rem", fontWeight: 600 }}>
                      Your first month is free. The code from our email is applied automatically at checkout. After that it is $49 a month, locked while you stay.
                    </Box>
                  )}
                  {codeState === "expired" && (
                    <Box sx={{ mb: 2.5, p: 1.75, borderRadius: "12px", bgcolor: "#F4F1E9", border: `1px solid ${LINE}`, color: "#53606C", fontSize: "0.82rem" }}>
                      Your one-month-free code has expired. The founding rate below still stands.
                    </Box>
                  )}
                  <Typography sx={{ mb: 3, color: MUTED, fontSize: "0.82rem" }}>
                    Your membership details and payment stay together, with no extra registration screens.
                  </Typography>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: { xs: 1.25, sm: 1.75 }, maxWidth: 560 }}>
                    {field("First name", "firstName", { auto: "given-name" })}
                    {field("Last name", "lastName", { auto: "family-name" })}
                    <Box sx={{ gridColumn: "1 / -1" }}>
                      {field("Work email", "email", { type: "email", auto: "email", onBlur: () => captureAbandon(form, plan) })}
                    </Box>
                    {field("Practice name", "practiceName", { auto: "organization" })}
                    <Box>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#44505c", mb: 0.6 }}>
                        Your role *
                      </Typography>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={form.role}
                                        onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                        sx={{
                          "& .MuiOutlinedInput-root": { borderRadius: "14px", bgcolor: "#fff", fontSize: { xs: "1rem", md: "0.85rem" }, height: { xs: 42, md: 44 } },
                        }}
                      >
                        {ROLES.map((r) => (
                          <MenuItem key={r} value={r} sx={{ fontSize: "0.85rem" }}>
                            {r}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  </Box>

                  {/* Payment note — the real Stripe fields render after this step */}
                  <Stack direction="row" sx={{ mt: 3.25, pt: 3, borderTop: `1px solid ${LINE}`, justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                    <Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>Payment</Typography>
                    <Typography sx={{ fontSize: "0.66rem", color: MUTED }}>Secured by Stripe</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 2 }}>
                    Card, Apple Pay and Link open in Stripe’s secure payment window on this page after you continue. Card details are entered with Stripe only. They never touch our servers.
                  </Typography>

                  <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start", my: 2.25 }}>
                    <Box
                      component="input"
                      type="checkbox"
                      id="ads-agreement"
                      checked={form.agree}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, agree: e.target.checked }))}
                      sx={{ width: 16, height: 16, mt: "3px", accentColor: GOLD_DARK, flexShrink: 0 }}
                    />
                    <Typography component="label" htmlFor="ads-agreement" sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#44505c", cursor: "pointer" }}>
                      I agree to the{" "}
                      <Box component="a" href="/agreement/member" target="_blank" rel="noopener" sx={{ color: GOLD_DARK, textDecoration: "underline" }}>
                        Member Agreement
                      </Box>{" "}
                      and recurring membership billing.
                    </Typography>
                  </Stack>

                  {errorMsg && (
                    <Box sx={{ mb: 2, p: 1.75, borderRadius: "11px", bgcolor: "#fdf0ee", color: "#8a2f24", fontSize: "0.78rem" }}>
                      {errorMsg}{" "}
                      {alreadyMember && (
                        <Box component="a" href="/member/login" sx={{ color: "#8a2f24", fontWeight: 800, textDecoration: "underline" }}>
                          Sign in →
                        </Box>
                      )}
                    </Box>
                  )}

                  <Button
                    fullWidth
                    disabled={!canSubmit || submitting}
                    onClick={startCheckout}
                    sx={{
                      "&&": {
                        bgcolor: GOLD,
                        color: "#111",
                        fontWeight: 800,
                        borderRadius: 999,
                        py: 1.3,
                        textTransform: "none",
                        fontSize: "0.95rem",
                        boxShadow: "0 10px 25px rgba(188,137,30,0.18)",
                      },
                      "&&:hover": { bgcolor: "#e4b95f" },
                      "&&.Mui-disabled": { bgcolor: "#eadfc4", color: "#9a8f75" },
                    }}
                  >
                    {submitting ? (
                      <CircularProgress size={20} sx={{ color: "#111" }} />
                    ) : (
                      `Continue to secure payment: ${priceLabel}`
                    )}
                  </Button>
                  <Typography sx={{ textAlign: "center", mt: 1.4, color: "#7b8289", fontSize: "0.66rem" }}>
                    You are covered by ASN’s 30-day money-back guarantee.
                  </Typography>
                </>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* FAQ */}
      <Box component="section" id="faq" sx={{ pb: { xs: 7, md: 9 }, scrollMarginTop: 16 }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography sx={kicker}>Questions</Typography>
            <Typography component="h2" sx={{ ...display, fontSize: { xs: "2.2rem", md: "3rem" }, mt: 1 }}>
              Everything else.
            </Typography>
          </Box>
          {[
            ["Who is ASN membership for?", "Aesthetic practice owners, med spa operators, injectors, practice managers, and their clinical and administrative teams."],
            ["What is included?", "The Expert Hotline, a curated expert directory, a growing library of expert kits, practical tools and templates, a vetted partner directory, and confirmed member offers."],
            ["How does the Expert Hotline work?", "Ask in plain English, typed or spoken. Beacon answers right away from our experts’ own sessions. Anything clinical, legal or personal never gets a guess: it goes to our team, and you get a written answer by text and email within 2 to 3 business days, plus the right experts to talk to. A person, not a search box."],
            ["How does registration work?", "Complete your essential membership details, choose monthly or annual billing, agree to the member terms, and pay securely, all on the same page."],
            ["When will I be charged?", "Payment is collected securely in the payment section on this page. Your ASN portal unlocks once Stripe confirms the payment."],
            ["Can I cancel?", "Yes. Membership can be cancelled anytime and includes a 30-day money-back guarantee."],
          ].map(([q, a]) => (
            <Box key={q} component="details" sx={{ borderBottom: `1px solid ${LINE}`, py: 2.75, "& summary": { cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "0.95rem" }, "& summary::after": { content: '"+"', color: GOLD_DARK, fontSize: "1.4rem", lineHeight: 1 }, "&[open] summary::after": { content: '"–"' } }}>
              <Box component="summary">{q}</Box>
              <Typography sx={{ color: MUTED, fontSize: "0.88rem", mt: 1.25, maxWidth: 760 }}>{a}</Typography>
            </Box>
          ))}
        </Container>
      </Box>

      {/* Footer */}
      <Box component="footer" sx={{ borderTop: `1px solid ${LINE}`, py: 4, pb: { xs: 12, md: 4 }, color: "#777e86", fontSize: "0.7rem" }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between" }}>
            <span>© Aesthetic Success Network · Powered by Business of Aesthetics</span>
            <Stack direction="row" spacing={2}>
              <Box component="a" href="/legal/privacy" sx={{ color: "inherit", textDecoration: "none", "&:hover": { color: INK } }}>Privacy</Box>
              <Box component="a" href="/legal/refund" sx={{ color: "inherit", textDecoration: "none", "&:hover": { color: INK } }}>Cancellation</Box>
              <Box component="a" href="mailto:founding@aestheticsuccessnetwork.com" sx={{ color: "inherit", textDecoration: "none", "&:hover": { color: INK } }}>Membership support</Box>
            </Stack>
          </Stack>
        </Container>
      </Box>

    </Box>
  );
}
