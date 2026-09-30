// Archives every ACTIVE price on the three ASN products that is not one of
// the eleven prices the app uses (monthly + yearly = 10 months for providers). Archiving (active=false) is what
// Stripe allows; prices cannot be deleted. Existing subscriptions on an
// archived price keep working. TEST keys only.
//
//   node scripts/stripe-archive-unused.mjs            (dry run: lists only)
//   node scripts/stripe-archive-unused.mjs --apply    (archives)
import "dotenv/config";
import { config } from "dotenv";
import Stripe from "stripe";
config({ path: ".env.local", override: true });

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) { console.error("TEST key only (sk_test_...)."); process.exit(1); }
const stripe = new Stripe(key);
const apply = process.argv.includes("--apply");

// plan -> amount in cents (must match both to be kept)
const KEEP = {
  founding_monthly: 2900, founding_annual: 29000, founding_annual_promo: 26100,
  standard_monthly: 9900, standard_annual: 99000,
  partner_growth_monthly: 3900, partner_growth_annual: 39000,
  partner_founding_standard_monthly: 14900, partner_founding_standard_annual: 149000,
  expert_growth_monthly: 3900, expert_growth_annual: 39000,
};

const products = (await stripe.products.search({ query: "active:'true' AND metadata['asn_key']:'member'" })).data
  .concat((await stripe.products.search({ query: "active:'true' AND metadata['asn_key']:'vendor'" })).data)
  .concat((await stripe.products.search({ query: "active:'true' AND metadata['asn_key']:'expert'" })).data);

let kept = 0, archived = 0;
for (const product of products) {
  const prices = (await stripe.prices.list({ product: product.id, active: true, limit: 100 })).data;
  for (const p of prices) {
    const plan = p.metadata?.plan ?? "";
    const ok = KEEP[plan] !== undefined && p.unit_amount === KEEP[plan];
    const label = `${p.id}  ${plan || "(no plan)"}  $${((p.unit_amount ?? 0) / 100).toFixed(2)}/${p.recurring?.interval}`;
    if (ok) { kept++; console.log(`keep     ${label}`); continue; }
    if (apply) { await stripe.prices.update(p.id, { active: false }); archived++; console.log(`ARCHIVED ${label}`); }
    else { archived++; console.log(`would archive ${label}`); }
  }
}
console.log(`\n${kept} kept, ${archived} ${apply ? "archived" : "to archive (re-run with --apply)"}.`);
