import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendTrialEndingReminder } from "@/lib/email/trialEndingReminder";
import { appOrigin, isBillingBypassed } from "@/lib/stripe";
import { FIRST_CHARGE_REMINDER_DAYS } from "@/lib/providerBilling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/cron/provider-reminders
 *
 * Daily Vercel Cron (vercel.json). Sends the ONE "your free founding
 * months end in 7 days" email to every expert and company whose Stripe
 * trial ends within the next 7 days and who has not been reminded yet.
 * Idempotent: the send is stamped on the row
 * (free_period_reminder_sent_at) so overlapping or manual runs are safe.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when the CRON_SECRET env var exists. In production the secret is
 * REQUIRED; locally (no secret set) the route runs open for testing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 503 });
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const sb = getSupabaseAdmin();
  const now = Date.now();
  const windowEnd = now + FIRST_CHARGE_REMINDER_DAYS * DAY_MS;
  const sent: string[] = [];
  const skipped: string[] = [];
  const origin = appOrigin();

  const inWindow = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t > now && t <= windowEnd;
  };
  const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - now) / DAY_MS));

  // Experts
  const { data: experts } = await sb
    .from("experts")
    .select("id, full_name, email, subscription_status, current_period_end, billing_exempt, free_period_reminder_sent_at")
    .eq("subscription_status", "trialing")
    .is("free_period_reminder_sent_at", null)
    .not("current_period_end", "is", null);
  for (const e of experts ?? []) {
    if (e.billing_exempt || isBillingBypassed(e.email) || !inWindow(e.current_period_end)) continue;
    const ok = await sendTrialEndingReminder({
      role: "expert",
      to: e.email,
      contactName: e.full_name ?? "there",
      daysLeft: daysLeft(e.current_period_end!),
      trialEndDate: new Date(e.current_period_end!),
      portalUrl: `${origin}/expert/billing`,
    });
    if (ok) {
      await sb.from("experts").update({ free_period_reminder_sent_at: new Date().toISOString() } as never).eq("id", e.id);
      sent.push(`expert:${e.email}`);
    } else {
      skipped.push(`expert:${e.email}`);
    }
  }

  // Companies
  const { data: vendors } = await sb
    .from("vendors")
    .select("id, contact_name, contact_email, billing_email, subscription_status, current_period_end, billing_plan, billing_parent_id, free_period_reminder_sent_at")
    .eq("subscription_status", "trialing")
    .is("free_period_reminder_sent_at", null)
    .is("billing_parent_id", null)
    .not("current_period_end", "is", null);
  for (const v of vendors ?? []) {
    if (isBillingBypassed(v.contact_email) || !inWindow(v.current_period_end)) continue;
    const ok = await sendTrialEndingReminder({
      role: "partner",
      to: v.billing_email ?? v.contact_email,
      contactName: v.contact_name ?? "there",
      daysLeft: daysLeft(v.current_period_end!),
      trialEndDate: new Date(v.current_period_end!),
      portalUrl: `${origin}/vendor/account`,
      rate: v.billing_plan,
    });
    if (ok) {
      await sb.from("vendors").update({ free_period_reminder_sent_at: new Date().toISOString() } as never).eq("id", v.id);
      sent.push(`company:${v.contact_email}`);
    } else {
      skipped.push(`company:${v.contact_email}`);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
