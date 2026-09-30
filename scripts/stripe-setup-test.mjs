// Creates the ASN products + prices in the Stripe TEST sandbox and prints the
// env lines to paste. Idempotent: re-running finds existing items by metadata.
//
//   node scripts/stripe-setup-test.mjs
//   node scripts/stripe-setup-test.mjs --webhook https://<your-preview>.vercel.app
//
// Reads STRIPE_SECRET_KEY from .env.local. Refuses live keys.
import "dotenv/config";
import { config } from "dotenv";
import Stripe from "stripe";

config({ path: ".env.local", override: true });

// TEST mode (default): uses STRIPE_SECRET_KEY, which must be sk_test_...
// LIVE mode (--live): uses STRIPE_LIVE_SECRET_KEY (sk_live_...), a SEPARATE
// variable so a live key never sits in the normal STRIPE_SECRET_KEY slot on a
// laptop. Creates the same products and prices in the live account and
// prints the live ids for Vercel Production.
const live = process.argv.includes("--live");
const key = (live ? process.env.STRIPE_LIVE_SECRET_KEY : process.env.STRIPE_SECRET_KEY) ?? "";
if (live && !key.startsWith("sk_live_")) {
  console.error("--live needs STRIPE_LIVE_SECRET_KEY=sk_live_... in .env.local. Aborting.");
  process.exit(1);
}
if (!live && !key.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY must be a TEST key (sk_test_...). Aborting. (Use --live for the live account.)");
  process.exit(1);
}
console.log(live ? "MODE: LIVE account (real prices)" : "MODE: test sandbox");
const stripe = new Stripe(key);

const PRODUCTS = [
  {
    key: "member",
    name: "ASN Member Network - Founding Membership",
    description:
      "Membership for aesthetic practice owners: the Expert Hotline, the resource library of expert kits, member-only company deals, live AMAs and CE.",
    statement_descriptor: "ASN MEMBERSHIP",
    metadata: { audience: "member", product: "membership" },
    prices: [
      { env: "STRIPE_PRICE_FOUNDING_MONTHLY", plan: "founding_monthly", amount: 2900, interval: "month" },
      { env: "STRIPE_PRICE_FOUNDING_ANNUAL", plan: "founding_annual", amount: 29000, interval: "year" },
      { env: "STRIPE_PRICE_FOUNDING_ANNUAL_PROMO", plan: "founding_annual_promo", amount: 26100, interval: "year" },
      { env: "STRIPE_PRICE_STANDARD_MONTHLY", plan: "standard_monthly", amount: 9900, interval: "month" },
      { env: "STRIPE_PRICE_STANDARD_ANNUAL", plan: "standard_annual", amount: 99000, interval: "year" },
    ],
  },
  {
    key: "vendor",
    name: "ASN Company Network - Featured Company",
    description:
      "Featured directory listing, member-only offers, lead routing, Verified Company badge, refer and earn. Annual pre-pay is two months free.",
    statement_descriptor: "ASN COMPANY",
    metadata: { audience: "vendor", product: "company_directory" },
    prices: [
      { env: "STRIPE_PRICE_PARTNER_GROWTH_MONTHLY", plan: "partner_growth_monthly", amount: 3900, interval: "month" },
      { env: "STRIPE_PRICE_PARTNER_GROWTH_ANNUAL", plan: "partner_growth_annual", amount: 39000, interval: "year" },
      // Founding company (admin invite): $39/mo for months 1-12, then $149/mo from month 13.
      { env: "STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_MONTHLY", plan: "partner_founding_standard_monthly", amount: 14900, interval: "month" },
      { env: "STRIPE_PRICE_PARTNER_FOUNDING_STANDARD_ANNUAL", plan: "partner_founding_standard_annual", amount: 149000, interval: "year" },
    ],
  },
  {
    key: "expert",
    name: "ASN Expert Bench - Featured Expert",
    description:
      "Featured placement on the expert bench, kits produced and surfaced to members, warm leads, co-marketing. Annual pre-pay is two months free.",
    statement_descriptor: "ASN EXPERT",
    metadata: { audience: "expert", product: "expert_bench" },
    prices: [
      { env: "STRIPE_PRICE_EXPERT_GROWTH_MONTHLY", plan: "expert_growth_monthly", amount: 3900, interval: "month" },
      { env: "STRIPE_PRICE_EXPERT_GROWTH_ANNUAL", plan: "expert_growth_annual", amount: 39000, interval: "year" },
    ],
  },
];

async function findProduct(key) {
  const res = await stripe.products.search({ query: `active:'true' AND metadata['asn_key']:'${key}'` });
  return res.data[0] ?? null;
}
async function findPrice(productId, plan) {
  const res = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  return res.data.find((p) => p.metadata?.plan === plan) ?? null;
}

const envLines = [];
for (const p of PRODUCTS) {
  let product = await findProduct(p.key);
  if (!product) {
    product = await stripe.products.create({
      name: p.name,
      description: p.description,
      statement_descriptor: p.statement_descriptor,
      metadata: { ...p.metadata, asn_key: p.key },
    });
    console.log(`created product  ${product.id}  ${p.name}`);
  } else {
    console.log(`found product    ${product.id}  ${p.name}`);
  }
  for (const pr of p.prices) {
    let price = await findPrice(product.id, pr.plan);
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: pr.amount,
        recurring: { interval: pr.interval },
        nickname: pr.plan,
        metadata: { plan: pr.plan },
      });
      console.log(`  created price  ${price.id}  ${pr.plan}  $${(pr.amount / 100).toFixed(2)}/${pr.interval}`);
    } else {
      console.log(`  found price    ${price.id}  ${pr.plan}`);
    }
    envLines.push(`${pr.env}=${price.id}`);
  }
}

// The early tier is never offered (cap 0); point its keys at the Standard prices.
const std = Object.fromEntries(envLines.map((l) => l.split("=")));
envLines.push(`STRIPE_PRICE_EARLY_MONTHLY=${std.STRIPE_PRICE_STANDARD_MONTHLY}`);
envLines.push(`STRIPE_PRICE_EARLY_ANNUAL=${std.STRIPE_PRICE_STANDARD_ANNUAL}`);

// Optional: register the webhook endpoint for a deployed URL.
const wi = process.argv.indexOf("--webhook");
if (wi > -1 && process.argv[wi + 1]) {
  const base = process.argv[wi + 1].replace(/\/$/, "");
  const url = `${base}/api/stripe/webhook`;
  const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find((w) => w.url === url);
  if (existing) {
    console.log(`\nwebhook already exists for ${url} (${existing.id}). Its secret is only shown once at creation;`);
    console.log("delete it in the Dashboard and re-run, or copy the secret from where you saved it.");
  } else {
    const wh = await stripe.webhookEndpoints.create({
      url,
      enabled_events: [
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "customer.subscription.trial_will_end",
        "invoice.paid",
        "invoice.payment_failed",
      ],
    });
    console.log(`\ncreated webhook  ${wh.id}  ${url}`);
    envLines.push(`STRIPE_WEBHOOK_SECRET=${wh.secret}`);
  }
}

console.log("\n# ---- paste into .env.local and into Vercel (Preview) env ----");
console.log(envLines.join("\n"));
