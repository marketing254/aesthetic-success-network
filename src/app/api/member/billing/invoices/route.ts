import { NextResponse } from "next/server";
import { requirePortalMember } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalMember();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data: member } = await supabase
      .from("members")
      .select("stripe_customer_id")
      .eq("id", guard.rowId)
      .maybeSingle();

    if (!member?.stripe_customer_id) {
      return NextResponse.json({ invoices: [] });
    }

    const invoices = await getStripe().invoices.list({
      customer: member.stripe_customer_id as string,
      limit: 24,
    });

    return NextResponse.json({
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        createdAt: new Date(inv.created * 1000).toISOString(),
        amountPaid: inv.amount_paid,
        amountDue: inv.amount_due,
        currency: inv.currency,
        status: inv.status,
        description: inv.description,
        pdfUrl: inv.invoice_pdf,
        hostedUrl: inv.hosted_invoice_url,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
