// Moves every provider subscription's free period to the real launch-based
// date once MEMBER_LAUNCH_DATE is known.
//
//   node scripts/stripe-sync-free-period.mjs            # dry run (prints what would change)
//   node scripts/stripe-sync-free-period.mjs --apply    # updates Stripe
//   node scripts/stripe-sync-free-period.mjs --live --apply   # live account (STRIPE_LIVE_SECRET_KEY)
//
// Reads STRIPE_SECRET_KEY (test) or STRIPE_LIVE_SECRET_KEY (--live) and
// MEMBER_LAUNCH_DATE (YYYY-MM-DD) from .env.local. Every subscription the
// app created carries metadata.audience = "expert" | "vendor"; those that
// are still `trialing` get trial_end = MEMBER_LAUNCH_DATE + 6 months.
// Subscriptions already past their free period are left alone.
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
const raw = (process.env.MEMBER_LAUNCH_DATE ?? "").trim();
if (!raw) {
  console.error("MEMBER_LAUNCH_DATE is not set in .env.local (YYYY-MM-DD). Aborting.");
  process.exit(1);
}
const launch = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
if (Number.isNaN(launch.getTime())) {
  console.error(`MEMBER_LAUNCH_DATE "${raw}" is not a valid date. Aborting.`);
  process.exit(1);
}
const FREE_MONTHS = 6;
const end = new Date(launch.getTime());
end.setUTCMonth(end.getUTCMonth() + FREE_MONTHS);
const endSec = Math.floor(end.getTime() / 1000);
if (end.getTime() <= Date.now()) {
  console.error(`Free period end ${end.toISOString()} is in the past. Nothing to do.`);
  process.exit(1);
}

console.log(`MODE: ${live ? "LIVE account" : "test sandbox"} ${apply ? "(APPLY)" : "(dry run)"}`);
console.log(`Member launch ${launch.toISOString().slice(0, 10)} -> free period ends ${end.toISOString().slice(0, 10)}`);
const stripe = new Stripe(key);

let changed = 0;
let skipped = 0;
for await (const sub of stripe.subscriptions.list({ status: "trialing", limit: 100 })) {
  const audience = sub.metadata?.audience;
  if (audience !== "expert" && audience !== "vendor") continue;
  const current = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString().slice(0, 10) : "none";
  if (sub.trial_end === endSec) {
    skipped += 1;
    continue;
  }
  console.log(`${apply ? "update" : "would update"}  ${sub.id}  ${audience}  trial_end ${current} -> ${end.toISOString().slice(0, 10)}`);
  if (apply) {
    await stripe.subscriptions.update(sub.id, {
      trial_end: endSec,
      proration_behavior: "none",
      metadata: { ...sub.metadata, free_period: "launch_based", free_period_ends_at: end.toISOString() },
    });
  }
  changed += 1;
}
console.log(`\n${changed} subscription(s) ${apply ? "updated" : "to update"}, ${skipped} already correct.`);
if (!apply && changed > 0) console.log("Re-run with --apply to write the changes.");
console.log("The app mirrors the new dates on the next Stripe webhook (customer.subscription.updated).");
