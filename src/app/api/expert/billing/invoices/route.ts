import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireExpert } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/expert/billing/invoices
 *
 * Returns the expert's Stripe invoice history, newest first. Mirrors the
 * member version — invoices live in Stripe and we never cache them in
 * our own DB; the billing UI fetches the authoritative list on mount.
 */
type InvoiceItem = {
  id: string;
  number: string | null;
  createdAt: string;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: string | null;
  description: string | null;
  pdfUrl: string | null;
  hostedUrl: string | null;
};

export async function GET() {
  const guard = await requireExpert();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data: expert } = await sb
    .from("experts")
    .select("stripe_customer_id")
    .eq("id", guard.expertId)
    .single();

  if (!expert?.stripe_customer_id) {
    return NextResponse.json({ invoices: [] as InvoiceItem[] });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return serverError(err, { route: "GET /api/expert/billing/invoices", status: 503 });
  }

  const list = await stripe.invoices.list({
    customer: expert.stripe_customer_id,
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
