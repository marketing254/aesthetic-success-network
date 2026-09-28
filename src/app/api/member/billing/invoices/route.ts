import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/billing/invoices
 *
 * Returns the member's Stripe invoice history, newest first. We never
 * cache or mirror the invoices in our own DB — they live in Stripe.
 * Whenever the billing UI mounts it asks Stripe directly for the
 * authoritative list (cheap call, easy to keep in sync).
 *
 * If the member doesn't have a Stripe customer yet (never subscribed),
 * returns an empty array — the UI shows the empty state.
 */
type InvoiceItem = {
  id: string;
  number: string | null;
  createdAt: string;
  amountPaid: number;        // in dollars (not cents)
  amountDue: number;         // in dollars
  currency: string;          // "USD"
  status: string | null;     // paid / open / void / draft / uncollectible
  description: string | null;
  pdfUrl: string | null;
  hostedUrl: string | null;
};

export async function GET() {
  const guard = await requireMember();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data: member } = await sb
    .from("members")
    .select("stripe_customer_id")
    .eq("id", guard.memberId)
    .single();

  if (!member?.stripe_customer_id) {
    return NextResponse.json({ invoices: [] as InvoiceItem[] });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return serverError(err, { route: "GET /api/member/billing/invoices", status: 503 });
  }

  const list = await stripe.invoices.list({
    customer: member.stripe_customer_id,
    limit: 24,
  });

  const invoices: InvoiceItem[] = list.data.map((inv) => ({
    id: inv.id ?? "",
    number: inv.number ?? null,
    createdAt: inv.created ? new Date(inv.created * 1000).toISOString() : "",
    amountPaid: (inv.amount_paid ?? 0) / 100,
    amountDue: (inv.amount_due ?? 0) / 100,
    currency: (inv.currency ?? "usd").toUpperCase(),
    status: inv.status ?? null,
    description:
      inv.lines.data[0]?.description ??
      inv.lines.data[0]?.pricing?.price_details?.product?.toString() ??
      null,
    pdfUrl: inv.invoice_pdf ?? null,
    hostedUrl: inv.hosted_invoice_url ?? null,
  }));

  return NextResponse.json({ invoices });
}
