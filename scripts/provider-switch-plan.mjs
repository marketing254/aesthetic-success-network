#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * provider-switch-plan.mjs — move a provider (expert and/or company) onto a
 * different founding plan, in Stripe and in the database.
 *
 *   # someone who already ACCEPTED (has Stripe billing):
 *   node scripts/provider-switch-plan.mjs --email arivkin9@gmail.com --plan quarterly_39 [--live] [--dry-run]
 *
 *   # someone whose invite is still open (sent / viewed): the invite's plan
 *   # changes and its PDF is re-rendered at the same path, same link.
 *   # Needs a dev server on :3123 (admin API renders the PDF).
 *   node scripts/provider-switch-plan.mjs --invite x_-K1Uh9r97mGtUXLFODRcoT --plan quarterly_39 [--dry-run]
 *
 * Accepted providers, what happens (owner, 26 Oct 2026):
 *   quarterly_49 / quarterly_39
 *     - every live subscription on their Stripe customer is reduced to ONE:
 *       the first is kept and moved to the quarterly price, the others
 *       (e.g. the second "both" subscription) are cancelled, nothing charged;
 *     - trial_end = 6 months after the member launch (2027-05-01), the same
 *       free period as every quarterly plan; proration off;
 *     - experts.billing_plan / vendors.billing_plan = the plan,
 *       subscription_interval = 'quarter', both rows point at the ONE sub.
 *   ladder / flat: not handled here (use Stripe directly).
 *
 * Keys: STRIPE_SECRET_KEY (test) by default; --live uses STRIPE_LIVE_SECRET_KEY.
 * Production billing lives in the LIVE account, so real people need --live.
 * Price ids: STRIPE_PRICE_PROVIDER_QUARTERLY_49 / _39 (or the _LIVE_ variants
 * STRIPE_LIVE_PRICE_PROVIDER_QUARTERLY_49 / _39 when --live). If the live
 * price is missing the script creates it on the ASN company product.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
const live = args.includes("--live");
const dry = args.includes("--dry-run");
const email = (opt("--email") ?? "").trim().toLowerCase();
const inviteCode = (opt("--invite") ?? "").trim();
const plan = opt("--plan");
const LAUNCH = process.env.MEMBER_LAUNCH_DATE || "2026-11-01";
const FREE_MONTHS = 6;

if (!plan || !["quarterly_49", "quarterly_39"].includes(plan)) {
  console.error("--plan must be quarterly_49 or quarterly_39"); process.exit(1);
}
if (!email && !inviteCode) { console.error("Give --email <accepted provider> or --invite <code>."); process.exit(1); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const amount = plan === "quarterly_39" ? 3900 : 4900;
const dollars = `$${amount / 100}`;

function addMonthsUtc(d, n) { const x = new Date(d.getTime()); x.setUTCMonth(x.getUTCMonth() + n); return x; }
const freeEnd = addMonthsUtc(new Date(`${LAUNCH}T00:00:00Z`), FREE_MONTHS);
const freeEndSec = Math.floor(freeEnd.getTime() / 1000);

// ---------------------------------------------------------------- invites
if (inviteCode) {
  const { data: inv, error } = await sb.from("founding_invites").select("id, code, role, status, pricing_plan, full_name, email, expert_id, agreement_pdf_path").eq("code", inviteCode).single();
  if (error || !inv) { console.error("invite not found", error?.message); process.exit(1); }
  console.log("invite:", inv.full_name, inv.email, inv.role, "status", inv.status, "plan", inv.pricing_plan, "->", plan);
  if (inv.status === "accepted") { console.error("Already accepted: run with --email instead."); process.exit(1); }
  if (inv.status === "revoked") { console.error("Revoked invite."); process.exit(1); }
  if (dry) { console.log("[dry-run] would set pricing_plan and regenerate the PDF"); process.exit(0); }
  const { error: upErr } = await sb.from("founding_invites").update({ pricing_plan: plan, updated_at: new Date().toISOString() }).eq("id", inv.id);
  if (upErr) { console.error("DB update failed (migration 0078 applied?):", upErr.message); process.exit(1); }
  console.log("pricing_plan ->", plan, "(status and viewed_at untouched)");
  // Regenerate the PDF through the admin API on the local dev server.
  const ADMIN = process.env.SWITCH_ADMIN_EMAIL || "rushdha@ekwa.com";
  const BASE = process.env.SWITCH_BASE || "http://localhost:3123";
  const { data: link, error: lErr } = await sb.auth.admin.generateLink({ type: "magiclink", email: ADMIN });
  if (lErr) { console.error("admin link failed:", lErr.message); process.exit(1); }
  const login = await fetch(`${BASE}/api/admin/verify-otp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: ADMIN, token: link.properties.email_otp }) });
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!login.ok || !cookie) { console.error("admin sign-in failed", login.status, "(is the dev server on", BASE, "?)"); process.exit(1); }
  const r = await fetch(`${BASE}/api/admin/founding-invite/${inv.id}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ action: "regenerate_pdf" }) });
  console.log("regenerate_pdf:", r.status, await r.text());
  process.exit(0);
}

// -------------------------------------------------------------- accepted
const key = live ? process.env.STRIPE_LIVE_SECRET_KEY : process.env.STRIPE_SECRET_KEY;
if (!key) { console.error(live ? "STRIPE_LIVE_SECRET_KEY missing in .env.local" : "STRIPE_SECRET_KEY missing"); process.exit(1); }
if (live && !/^(sk|rk)_live_/.test(key)) { console.error("--live needs a live key"); process.exit(1); }
if (!live && !/^(sk|rk)_test_/.test(key)) { console.error("STRIPE_SECRET_KEY must be a test key (use --live for the live account)"); process.exit(1); }
const stripe = new Stripe(key);
console.log(live ? "MODE: LIVE Stripe account" : "MODE: Stripe test sandbox", dry ? "(dry-run)" : "");

const { data: expert } = await sb.from("experts").select("id, email, full_name, billing_exempt, stripe_customer_id, stripe_subscription_id, subscription_status, billing_plan").ilike("email", email).maybeSingle();
const { data: vendor } = await sb.from("vendors").select("id, contact_email, company_name, stripe_customer_id, stripe_subscription_id, subscription_status, billing_plan").ilike("contact_email", email).maybeSingle();
if (!expert && !vendor) { console.error("No expert or vendor row for", email); process.exit(1); }
if (expert?.billing_exempt) { console.error(`${email} is a Free founding expert; nothing to bill.`); process.exit(1); }
console.log("expert:", expert ? `${expert.full_name} sub=${expert.stripe_subscription_id} status=${expert.subscription_status} plan=${expert.billing_plan}` : "none");
console.log("vendor:", vendor ? `${vendor.company_name} sub=${vendor.stripe_subscription_id} status=${vendor.subscription_status} plan=${vendor.billing_plan}` : "none");

const customerId = vendor?.stripe_customer_id || expert?.stripe_customer_id;
if (!customerId) { console.error("No Stripe customer on either row. They have not saved a card; change the invite instead."); process.exit(1); }

// Quarterly price: env, else find/create on the company product.
const envKey = live ? `STRIPE_LIVE_PRICE_PROVIDER_${plan.toUpperCase()}` : `STRIPE_PRICE_PROVIDER_${plan.toUpperCase()}`;
let priceId = process.env[envKey] || null;
if (!priceId) {
  const products = await stripe.products.search({ query: "active:'true' AND metadata['asn_key']:'vendor'" });
  const product = products.data[0];
  if (!product) { console.error("ASN company product not found in this Stripe account; run scripts/stripe-setup-test.mjs" + (live ? " --live" : "") + " first."); process.exit(1); }
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const found = prices.data.find((p) => p.metadata?.plan === `provider_${plan}`);
  if (found) priceId = found.id;
  else if (dry) { console.log(`[dry-run] would create price provider_${plan} ${dollars}/3 months`); priceId = "price_DRYRUN"; }
  else {
    const created = await stripe.prices.create({ product: product.id, currency: "usd", unit_amount: amount, recurring: { interval: "month", interval_count: 3 }, nickname: `provider_${plan}`, metadata: { plan: `provider_${plan}` } });
    priceId = created.id;
    console.log(`created price ${priceId} (${dollars} every 3 months). Add to env: ${envKey}=${priceId}`);
  }
}
console.log("quarterly price:", priceId);

// All live subscriptions on the customer.
const subs = (await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 })).data
  .filter((s) => !["canceled", "incomplete_expired"].includes(s.status));
if (!subs.length) { console.error("No live subscriptions on", customerId); process.exit(1); }
for (const s of subs) console.log(" sub", s.id, s.status, "price", s.items.data[0]?.price.id, s.items.data[0]?.price.unit_amount, "/", s.items.data[0]?.price.recurring?.interval_count ?? 1, s.items.data[0]?.price.recurring?.interval, "trial_end", s.trial_end ? new Date(s.trial_end * 1000).toISOString().slice(0, 10) : null, "schedule", typeof s.schedule === "string" ? s.schedule : s.schedule?.id ?? null);

// Keep the company subscription when there is one (the vendor row is the
// primary mirror for shared subs), else the first.
const keep = subs.find((s) => s.id === vendor?.stripe_subscription_id) ?? subs[0];
const cancel = subs.filter((s) => s.id !== keep.id);
console.log("keep:", keep.id, "| cancel:", cancel.map((s) => s.id).join(", ") || "none", "| trial_end ->", freeEnd.toISOString().slice(0, 10));
if (dry) { console.log("[dry-run] no changes made"); process.exit(0); }

// Database first (reversible, and it proves migration 0078 is applied
// before anything changes in Stripe).
const planPatch = { billing_plan: plan, subscription_interval: "quarter" };
const before = { expert: expert ? { billing_plan: expert.billing_plan } : null, vendor: vendor ? { billing_plan: vendor.billing_plan } : null };
if (expert) { const { error } = await sb.from("experts").update(planPatch).eq("id", expert.id); if (error) { console.error("experts row update failed (migration 0078 applied?):", error.message); process.exit(1); } }
if (vendor) { const { error } = await sb.from("vendors").update(planPatch).eq("id", vendor.id); if (error) { console.error("vendors row update failed (migration 0078 applied?):", error.message); if (expert) await sb.from("experts").update({ billing_plan: before.expert.billing_plan, subscription_interval: "month" }).eq("id", expert.id); process.exit(1); } }

// Stripe: release a schedule so the subscription can be edited directly.
const scheduleId = typeof keep.schedule === "string" ? keep.schedule : keep.schedule?.id;
if (scheduleId) { await stripe.subscriptionSchedules.release(scheduleId); console.log("released schedule", scheduleId); }
for (const s of cancel) {
  const sid = typeof s.schedule === "string" ? s.schedule : s.schedule?.id;
  if (sid) await stripe.subscriptionSchedules.release(sid).catch(() => null);
  await stripe.subscriptions.cancel(s.id, { prorate: false });
  console.log("cancelled", s.id);
}
const nowSec = Math.floor(Date.now() / 1000);
const updated = await stripe.subscriptions.update(keep.id, {
  items: [{ id: keep.items.data[0].id, price: priceId }],
  trial_end: freeEndSec > nowSec + 3600 ? freeEndSec : "now",
  proration_behavior: "none",
  trial_settings: { end_behavior: { missing_payment_method: "pause" } },
  metadata: { ...keep.metadata, plan: `provider_${plan}`, rate: plan, cadence: "quarterly", free_period_ends_at: freeEnd.toISOString(), switched_by: "provider-switch-plan.mjs" },
});
const periodEnd = updated.items.data[0]?.current_period_end ? new Date(updated.items.data[0].current_period_end * 1000).toISOString() : null;
console.log("updated", updated.id, updated.status, "price", updated.items.data[0].price.id, "trial_end", updated.trial_end ? new Date(updated.trial_end * 1000).toISOString().slice(0, 10) : null);

// Mirror the ONE subscription onto both rows.
const rowPatch = { stripe_customer_id: customerId, stripe_subscription_id: updated.id, stripe_price_id: priceId, subscription_status: updated.status, subscription_interval: "quarter", current_period_end: periodEnd, billing_plan: plan };
if (expert) { const { error } = await sb.from("experts").update(rowPatch).eq("id", expert.id); console.log("experts row", error ? "FAILED " + error.message : "updated"); }
if (vendor) { const { error } = await sb.from("vendors").update(rowPatch).eq("id", vendor.id); console.log("vendors row", error ? "FAILED " + error.message : "updated"); }
console.log(`Done: ${email} is on ${dollars} every 3 months, free until ${freeEnd.toISOString().slice(0, 10)}.`);
