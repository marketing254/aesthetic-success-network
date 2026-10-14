// Lines up provider free periods with the member launch date.
//
//   node scripts/stripe-sync-free-period.mjs                 # dry run, test account
//   node scripts/stripe-sync-free-period.mjs --apply         # write, test account
//   node scripts/stripe-sync-free-period.mjs --live          # dry run, LIVE (STRIPE_LIVE_SECRET_KEY)
//   node scripts/stripe-sync-free-period.mjs --live --apply  # write, LIVE
//   --only=sub_123,sub_456   limit to these subscriptions
//
// Launch date: MEMBER_LAUNCH_DATE in .env.local, else 2026-11-01.
// Founding experts (metadata ramp=founding-expert) get launch + 12 months;
// everyone else launch + 6 months.
// SAFETY: a first charge is never moved EARLIER than it is now (that date
// was printed in the provider's welcome email) unless --allow-earlier.
// Subscription-schedule companies are listed for a manual change only.
import "dotenv/config";
import { config } from "dotenv";
import Stripe from "stripe";

config({ path: ".env.local", override: true });

const live = process.argv.includes("--live");
const apply = process.argv.includes("--apply");
const key = (live ? process.env.STRIPE_LIVE_SECRET_KEY : process.env.STRIPE_SECRET_KEY) ?? "";
if (live && !(key.startsWith("sk_live_") || key.startsWith("rk_live_"))) {
  console.error("--live needs STRIPE_LIVE_SECRET_KEY=sk_live_... in .env.local. Aborting.");
  process.exit(1);
}
if (!live && !(key.startsWith("sk_test_") || key.startsWith("rk_test_"))) {
  console.error("STRIPE_SECRET_KEY must be a TEST key (sk_test_...). Aborting. (Use --live for the live account.)");
  process.exit(1);
}
// Launch date: MEMBER_LAUNCH_DATE, else the app default (src/lib/providerBilling.ts).
const raw = (process.env.MEMBER_LAUNCH_DATE ?? "").trim() || "2026-11-01";
const launch = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
if (Number.isNaN(launch.getTime())) {
  console.error(`MEMBER_LAUNCH_DATE "${raw}" is not a valid date. Aborting.`);
  process.exit(1);
}

// Optional: --only=sub_123,sub_456 limits the run to those subscriptions.
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map((s) => s.trim()).filter(Boolean)) : null;
// Moving a first charge EARLIER than what the provider was told (their
// welcome email prints the date) is refused unless --allow-earlier.
const allowEarlier = process.argv.includes("--allow-earlier");

/** Founding experts get 12 free months; everyone else 6 (providerBilling.ts). */
function freeMonthsFor(sub) {
  const m = sub.metadata ?? {};
  const foundingExpert =
    m.audience === "expert" && (m.ramp === "founding-expert" || m.rate === "founding_expert" || m.founding === "true");
  return foundingExpert ? 12 : 6;
}
function endFor(months) {
  const e = new Date(launch.getTime());
  e.setUTCMonth(e.getUTCMonth() + months);
  return e;
}
const day = (d) => d.toISOString().slice(0, 10);

console.log(`MODE: ${live ? "LIVE account" : "test sandbox"} ${apply ? "(APPLY)" : "(dry run, nothing changes)"}`);
console.log(`Member launch ${day(launch)}: founding experts free until ${day(endFor(12))}, everyone else until ${day(endFor(6))}`);
const stripe = new Stripe(key);

let changed = 0;
let kept = 0;
for await (const sub of stripe.subscriptions.list({ status: "trialing", limit: 100 })) {
  const audience = sub.metadata?.audience;
  if (audience !== "expert" && audience !== "vendor") continue;
  if (only && !only.has(sub.id)) continue;
  const months = freeMonthsFor(sub);
  const target = endFor(months);
  const targetSec = Math.floor(target.getTime() / 1000);
  const current = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const label = `${sub.id}  ${audience}  ${sub.metadata?.ramp ?? "-"}  (${months} months)`;

  if (sub.trial_end === targetSec) {
    kept += 1;
    continue;
  }
  if (target.getTime() <= Date.now()) {
    console.log(`skip    ${label}: target ${day(target)} is in the past`);
    kept += 1;
    continue;
  }
  if (current && targetSec < sub.trial_end && !allowEarlier) {
    console.log(`keep    ${label}: first charge stays ${day(current)} (target ${day(target)} would be EARLIER than they were told)`);
    kept += 1;
    continue;
  }
  if (sub.schedule) {
    console.log(`manual  ${label}: on a subscription schedule; change phase 1 in the Stripe dashboard (${current ? day(current) : "none"} -> ${day(target)})`);
    kept += 1;
    continue;
  }
  console.log(`${apply ? "update " : "would  "} ${label}: trial_end ${current ? day(current) : "none"} -> ${day(target)}`);
  if (apply) {
    await stripe.subscriptions.update(sub.id, {
      trial_end: targetSec,
      proration_behavior: "none",
      metadata: { ...sub.metadata, free_period: "launch_based", free_period_ends_at: target.toISOString() },
    });
  }
  changed += 1;
}
console.log(`
${changed} subscription(s) ${apply ? "updated" : "to update"}, ${kept} left as they are.`);
if (!apply && changed > 0) console.log("Re-run with --apply to write the changes.");
console.log("The app mirrors the new dates on the next Stripe webhook (customer.subscription.updated).");
