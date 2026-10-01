"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!STRIPE_PK) return null;
  if (!stripePromise) stripePromise = loadStripe(STRIPE_PK);
  return stripePromise;
}

const NAVY = "#0E2A3D";
/** One calm message for anything that is not a card problem the person can fix. */
const STD_ERR = "We couldn't save your card. Nothing was charged. Please try again in a moment, and if it keeps happening email support@aestheticsuccessnetwork.com.";
const NAVY_DARK = "#06182A";

export type FoundingAcceptProps = {
  code: string;
  fullName: string;
  signerName: string | null;
  role: "expert" | "partner" | "both";
  /** Company plan: "ladder" ($39 x 12 then $149) or "flat" ($39). Experts: 12 months free, then $39 flat. */
  pricing?: string | null;
  companyName: string | null;
  memberOffer: string | null;
  agreementUrl: string | null;
  agreementVersion: string;
};

export default function FoundingAcceptV4(props: FoundingAcceptProps) {
  const roleLabel =
    props.role === "both"
      ? "Founding Expert + Partner"
      : props.role === "partner"
        ? "Founding Partner"
        : "Founding Expert";
  // Every founding role saves a card. Nothing is charged today: the free
  // founding months start the day members can join (experts 12, companies
  // 6), then $39 (experts flat; companies ladder or flat).
  const hasExpert = props.role === "expert" || props.role === "both";
  const hasCompany = props.role === "partner" || props.role === "both";
  const dueToday = "$0.00";
  const displayName = props.signerName?.trim() || props.fullName;
  const showsFeaturedExpert = Boolean(
    props.signerName?.trim() && props.signerName.trim() !== props.fullName,
  );

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/founding/${props.code}/prepare`, { method: "POST" });
        const body = (await res.json().catch(() => ({}))) as { clientSecret?: string; error?: string };
        if (cancelled) return;
        if (!res.ok || !body.clientSecret) {
          setPrepareError(body.error ?? "This invite couldn't be loaded.");
          return;
        }
        setClientSecret(body.clientSecret);
      } catch {
        if (!cancelled) setPrepareError("This invite couldn't be loaded. Refresh to retry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.code]);

  const stripeInstance = useMemo(() => getStripePromise(), []);

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 5, md: 8 }, px: { xs: 1.5, sm: 3 } }}>
      <Stack spacing={0.5} sx={{ textAlign: "center", alignItems: "center", mb: 4 }}>
        <Typography sx={{ fontSize: "0.7rem", letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, color: "#A07823" }}>
          Founding invitation
        </Typography>
        <Typography sx={{ fontFamily: "var(--font-display)", fontSize: { xs: "1.8rem", md: "2.2rem" }, fontWeight: 500, color: "#0A1A2F", letterSpacing: 0 }}>
          Welcome, {displayName.split(/\s+/)[0]}.
        </Typography>
        <Typography sx={{ color: "#5C6770", maxWidth: 460, mt: 1 }}>
          You&apos;ve been invited to join as a <strong>{roleLabel}</strong>. Review your
          agreement below, agree, and save your card.{" "}
          Nothing is charged today. Your free founding months start the day we open to members, and we remind you 7 days before your first charge.
        </Typography>
      </Stack>

      <Box
        sx={{
          borderRadius: 2.5,
          bgcolor: "#FFFFFF",
          border: "1px solid rgba(14,42,61,0.1)",
          boxShadow: "0 16px 40px -28px rgba(14,42,61,0.18)",
          overflow: "hidden",
        }}
      >
        <Box sx={{ p: { xs: 2, md: 3 }, borderBottom: "1px solid rgba(14,42,61,0.07)" }}>
          <Typography sx={{ fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, color: "#7A8590", mb: 1.5 }}>
            Your agreement
          </Typography>
          <MetaRow label="Name" value={displayName} />
          {showsFeaturedExpert && <MetaRow label="Featured expert" value={props.fullName} />}
          {props.companyName && <MetaRow label="Company" value={props.companyName} />}
          <MetaRow label="Role" value={roleLabel} />
          {props.memberOffer && <MetaRow label="Your member offer" value={props.memberOffer} />}
          {props.agreementUrl && (
            <Button
              component="a"
              href={props.agreementUrl}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<DescriptionOutlinedIcon sx={{ fontSize: 17 }} />}
              sx={{ mt: 1.5, textTransform: "none", fontWeight: 600, color: "#A07823", px: 0 }}
            >
              Read your full agreement (PDF)
            </Button>
          )}
        </Box>

        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 2 }}>
            <Typography sx={{ fontSize: "0.9rem", color: "#5C6770", fontWeight: 600 }}>Due today</Typography>
            <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", fontWeight: 600, color: "#0A1A2F", lineHeight: 1 }}>
              {dueToday}
            </Typography>
          </Stack>
          {hasExpert && (
            <Box sx={{ bgcolor: "rgba(44,122,82,0.09)", borderRadius: 1.5, px: 2, py: 1.5, mb: 2 }}>
              <Typography sx={{ fontSize: "0.78rem", color: "#1F5238", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", mb: 0.5 }}>
                Founding expert access
              </Typography>
              <RampLine label="First 12 months, from member launch" price="$0/mo" bold />
              <RampLine label="After that, no increase" price="$39/mo" />
            </Box>
          )}
          {hasCompany && (
            <Box sx={{ bgcolor: "rgba(217,168,75,0.08)", borderRadius: 1.5, px: 2, py: 1.5, mb: 2.5 }}>
              <Typography sx={{ fontSize: "0.78rem", color: "#7A5B17", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", mb: 0.5 }}>
                Founding company listing
              </Typography>
              <RampLine label="First 6 months, from member launch" price="$0/mo" bold />
              {props.pricing === "flat" || props.pricing === "flat_49" ? (
                <RampLine label="After that, no increase" price="$39/mo" />
              ) : (
                <>
                  <RampLine label="Next 12 months, launch rate" price="$39/mo" />
                  <RampLine label="After that, standard rate" price="$149/mo" />
                </>
              )}
            </Box>
          )}

          {prepareError ? (
            <Alert severity="error" sx={{ fontSize: "0.84rem", mb: 2 }}>
              {prepareError}
            </Alert>
          ) : !stripeInstance ? (
            <Alert severity="error" sx={{ fontSize: "0.84rem", mb: 2 }}>
              Payment couldn&apos;t load. Please refresh the page. If this keeps happening,
              contact support@aestheticsuccessnetwork.com so we can save your card another way.
            </Alert>
          ) : clientSecret ? (
            <Elements
              stripe={stripeInstance}
              options={{
                clientSecret,
                appearance: { theme: "stripe", variables: { colorPrimary: NAVY, fontFamily: "system-ui, sans-serif", borderRadius: "8px" } },
              }}
            >
              <PaymentAcceptForm {...props} roleLabel={roleLabel} displayName={displayName} />
            </Elements>
          ) : (
            <Box sx={{ pb: 2 }}>
              <Skeleton variant="rounded" height={44} sx={{ mb: 1.25, borderRadius: "8px" }} />
              <Skeleton variant="rounded" height={24} width="70%" sx={{ mb: 2, borderRadius: "6px" }} />
              <Skeleton variant="rounded" height={46} sx={{ borderRadius: "999px" }} />
            </Box>
          )}
        </Box>

        <Box sx={{ borderTop: "1px solid rgba(14,42,61,0.06)", bgcolor: "#FAFAF7", px: 2.5, py: 1.25 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", justifyContent: "center" }}>
            <LockRoundedIcon sx={{ fontSize: 13, color: "#7A8590" }} />
            <Typography sx={{ fontSize: "0.74rem", color: "#7A8590", textAlign: "center", lineHeight: 1.5 }}>
              Secured by Stripe. Nothing is charged until your free founding months end. Your signed agreement is emailed to you.
            </Typography>
          </Stack>
          <Typography sx={{ fontSize: "0.72rem", color: "#9CA3AB", textAlign: "center", mt: 0.75 }}>
            Aesthetic Success Network, operated by Ekwa Marketing Inc. · Powered by Business of Aesthetics · Questions: founding@aestheticsuccessnetwork.com
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}

function PaymentAcceptForm(props: FoundingAcceptProps & { roleLabel: string; displayName: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !agreed) return;
    setBusy(true);
    setError(null);

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}${window.location.pathname}` },
      redirect: "if_required",
    });
    const already = result.error?.setup_intent;
    const setupIntent = result.setupIntent ?? (already && already.status === "succeeded" ? already : undefined);
    if (!setupIntent) {
      setError(result.error?.type === "card_error" || result.error?.type === "validation_error" ? (result.error.message ?? STD_ERR) : STD_ERR);
      setBusy(false);
      return;
    }
    if (setupIntent.status !== "succeeded" || typeof setupIntent.payment_method !== "string") {
      setError(STD_ERR);
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`/api/founding/${props.code}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupIntentId: setupIntent.id, paymentMethodId: setupIntent.payment_method }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? STD_ERR);
        setBusy(false);
        return;
      }
      router.push(body.next ?? "/");
    } catch {
      setError(STD_ERR);
      setBusy(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit}>
      <PaymentElement options={{ layout: "tabs" }} />
      <AgreementCheckbox
        agreed={agreed}
        setAgreed={setAgreed}
        displayName={props.displayName}
        roleLabel={props.roleLabel}
        agreementVersion={props.agreementVersion}
      />
      <SubmitButton busy={busy} disabled={!stripe || !elements || !agreed || busy} label="Agree and save card" />
      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: "0.82rem" }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

function AgreementCheckbox({
  agreed,
  setAgreed,
  displayName,
  roleLabel,
  agreementVersion,
}: {
  agreed: boolean;
  setAgreed: (agreed: boolean) => void;
  displayName: string;
  roleLabel: string;
  agreementVersion: string;
}) {
  return (
    <Box sx={{ mt: 2, display: "flex", alignItems: "flex-start", gap: 1 }}>
      <Checkbox
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
        size="small"
        disableRipple
        sx={{ p: 0, mt: "1px", color: "#A07823", "&.Mui-checked": { color: "#A07823" } }}
        slotProps={{ input: { "aria-label": "Agree to the ASN Founding Agreement" } }}
      />
      <Typography sx={{ fontSize: "0.84rem", color: "#3B4A55", lineHeight: 1.55 }}>
        I,&nbsp;{displayName}, agree to the{" "}
        <Box component="span" sx={{ fontWeight: 700, color: "#A07823" }}>
          ASN Founding {roleLabel} Agreement ({agreementVersion})
        </Box>
        .
      </Typography>
    </Box>
  );
}

function SubmitButton({ busy, disabled, label }: { busy: boolean; disabled: boolean; label: string }) {
  return (
    <Button
      type="submit"
      fullWidth
      variant="contained"
      disabled={disabled}
      sx={{
        mt: 1.5,
        mb: 2.5,
        borderRadius: 999,
        py: 1.25,
        fontSize: "0.95rem",
        bgcolor: NAVY,
        color: "#FFFFFF",
        backgroundImage: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
        "&:hover": { backgroundImage: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DARK} 100%)` },
        "&.Mui-disabled": { bgcolor: "rgba(14,42,61,0.08)", backgroundImage: "none", color: "rgba(14,42,61,0.4)" },
      }}
      startIcon={busy ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : null}
    >
      {busy ? "Processing..." : label}
    </Button>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ py: 0.5, alignItems: "baseline" }}>
      <Typography sx={{ fontSize: "0.78rem", color: "#9CA3AB", width: { xs: 96, sm: 130 }, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.88rem", color: "#0A1A2F", fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{value}</Typography>
    </Stack>
  );
}

function RampLine({ label, price, bold }: { label: string; price: string; bold?: boolean }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", py: 0.35 }}>
      <Typography sx={{ fontSize: "0.85rem", color: bold ? "#0A1A2F" : "#3B4A55", fontWeight: bold ? 700 : 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.85rem", color: bold ? "#0A1A2F" : "#3B4A55", fontWeight: bold ? 700 : 500 }}>{price}</Typography>
    </Stack>
  );
}
