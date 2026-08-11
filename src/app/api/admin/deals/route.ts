import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { asString } from "@/lib/forms/request";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/deals — every partner deal, newest first. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vendor_deals")
      .select(
        "id, partner_id, company_name, title, category, description, deal_terms, redemption_url, redemption_note, status, published_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ deals: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/deals
 * Body: { id, action: "publish" | "send_back" | "archive" }
 *
 * Publishing is admin-only by design — partners can submit, but the
 * curation promise means a human decides what members see.
 */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const id = asString(body.id);
  const action = asString(body.action);
  const note = asString(body.note);
  const allowed = ["publish", "send_back", "archive"];
  if (!id || !allowed.includes(action)) {
    return NextResponse.json({ error: "id and a valid action are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: deal } = await supabase
      .from("vendor_deals")
      .select("id, published_at, deal_terms")
      .eq("id", id)
      .maybeSingle();
    if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

    if (action === "publish" && !String(deal.deal_terms ?? "").trim()) {
      return NextResponse.json(
        { error: "This deal has no member terms — send it back instead." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const patch =
      action === "publish"
        ? { status: "published", published_at: (deal.published_at as string | null) ?? now, updated_at: now }
        : action === "send_back"
          ? { status: "draft", published_at: null, updated_at: now }
          : { status: "archived", published_at: null, updated_at: now };

    const { error } = await supabase.from("vendor_deals").update(patch).eq("id", id);
    if (error) throw error;

    await writeAudit(guard, "vendor_deal", id, action, note || undefined);
    return NextResponse.json({ ok: true, status: patch.status });
  } catch (err) {
    console.error("[admin:deals] update failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
