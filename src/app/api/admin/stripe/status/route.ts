import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getStripe, appOrigin } from "@/lib/stripe";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stripe/status
 *
 * One screen that answers "is Stripe wired up on THIS deployment?":
 *   - which account the secret key belongs to and whether it is LIVE or test
 *   - whether the publishable key matches that mode
 *   - every STRIPE_PRICE_* env var: set, found in this account, amount, active
 *   - whether a webhook endpoint exists for this deployment's URL and the
 *     signing secret is set
 * Read-only: nothing is created or changed in Stripe. Admin only.
 */

const PRICE_ENVS = [
  "STRIPE_PRICE_FOUNDING_MONTHLY",
  "STRIPE_PRICE_FOUNDING_ANNUAL",
  "STRIPE_PRICE_FOUNDING_ANNUAL_PROMO",
  "STRIPE_PRICE_STANDARD_MONTHLY",
  "STRIPE_PRICE_STANDARD_ANNUAL",
  "STRIPE_PRICE_EARLY_MONTHLY",
  "STRIPE_PRICE_EARLY_ANNUAL",
  "STRIPE_PRICE_PARTNER_GROWTH_MONTHLY",
  "STRIPE_PRICE_PARTNER_GROWTH_ANNUAL",
  "STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_MONTHLY",
  "STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_ANNUAL",
  "STRIPE_PRICE_EXPERT_GROWTH_MONTHLY",
  "STRIPE_PRICE_EXPERT_GROWTH_ANNUAL",
] as const;

/** The prices a provider acceptance actually uses. */
const REQUIRED_FOR_PROVIDERS = new Set([
  "STRIPE_PRICE_PARTNER_GROWTH_MONTHLY",
  "STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_MONTHLY",
  "STRIPE_PRICE_EXPERT_GROWTH_MONTHLY",
]);

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const secretMode = secret.startsWith("sk_live_") || secret.startsWith("rk_live_") ? "live" : secret.startsWith("sk_test_") || secret.startsWith("rk_test_") ? "test" : "missing";
  const publishableMode = publishable.startsWith("pk_live_") ? "live" : publishable.startsWith("pk_test_") ? "test" : "missing";

  const out: Record<string, unknown> = {
    deployment: appOrigin(),
    vercelEnv: process.env.VERCEL_ENV ?? "local",
    secretKey: { mode: secretMode, prefix: secret.slice(0, 8) },
    publishableKey: { mode: publishableMode, prefix: publishable.slice(0, 8), matchesSecret: secretMode !== "missing" && secretMode === publishableMode },
    webhookSecretSet: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    memberLaunchDate: process.env.MEMBER_LAUNCH_DATE || null,
  };
  if (secretMode === "missing") {
    return NextResponse.json({ ...out, ok: false, problems: ["STRIPE_SECRET_KEY is not set on this deployment."] });
  }

  try {
    const stripe = getStripe();
    const problems: string[] = [];

    // Account + mode (balance is the cheapest live-mode call).
    const balance = await stripe.balance.retrieve();
    out.livemode = balance.livemode;
    if (secretMode === "live" && !balance.livemode) problems.push("Secret key looks live but Stripe reports test mode.");
    if (!out.publishableKey || !(out.publishableKey as { matchesSecret: boolean }).matchesSecret) {
      problems.push("Publishable key mode does not match the secret key (one is live, the other test).");
    }

    // Prices
    const prices: Record<string, unknown>[] = [];
    for (const env of PRICE_ENVS) {
      const id = process.env[env];
      if (!id) {
        prices.push({ env, set: false, required: REQUIRED_FOR_PROVIDERS.has(env) });
        if (REQUIRED_FOR_PROVIDERS.has(env)) problems.push(`${env} is not set.`);
        continue;
      }
      try {
        const p = await stripe.prices.retrieve(id, { expand: ["product"] });
        const product = typeof p.product === "object" && p.product && "name" in p.product ? (p.product as { name: string }).name : null;
        prices.push({
          env,
          set: true,
          id,
          found: true,
          active: p.active,
          amount: p.unit_amount != null ? `$${(p.unit_amount / 100).toFixed(2)}/${p.recurring?.interval ?? "once"}` : null,
          product,
          livemode: p.livemode,
          required: REQUIRED_FOR_PROVIDERS.has(env),
        });
        if (!p.active && REQUIRED_FOR_PROVIDERS.has(env)) problems.push(`${env} points at an archived price.`);
        if (p.livemode !== balance.livemode) problems.push(`${env} belongs to the other mode (${p.livemode ? "live" : "test"}).`);
      } catch (err) {
        prices.push({ env, set: true, id, found: false, error: err instanceof Error ? err.message : String(err), required: REQUIRED_FOR_PROVIDERS.has(env) });
        problems.push(`${env} (${id}) was not found in this Stripe account.`);
      }
    }
    out.prices = prices;

    // Webhook for this deployment
    const expected = `${appOrigin().replace(/\/$/, "")}/api/stripe/webhook`;
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const match = endpoints.data.find((w) => w.url === expected);
    out.webhook = {
      expectedUrl: expected,
      found: Boolean(match),
      status: match?.status ?? null,
      events: match?.enabled_events ?? null,
      others: endpoints.data.filter((w) => w.url !== expected).map((w) => ({ url: w.url, status: w.status })),
    };
    if (!match) problems.push(`No webhook endpoint for ${expected}. Create one in Stripe (Developers → Webhooks) and set STRIPE_WEBHOOK_SECRET.`);
    else if (match.status !== "enabled") problems.push("The webhook endpoint for this deployment is disabled.");
    if (!process.env.STRIPE_WEBHOOK_SECRET) problems.push("STRIPE_WEBHOOK_SECRET is not set; signed events will be rejected.");
    for (const ev of ["customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed", "customer.subscription.trial_will_end"]) {
      if (match && !match.enabled_events.includes("*") && !match.enabled_events.includes(ev)) problems.push(`Webhook is missing the event ${ev}.`);
    }

    return NextResponse.json({ ...out, ok: problems.length === 0, problems });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/stripe/status" });
  }
}
