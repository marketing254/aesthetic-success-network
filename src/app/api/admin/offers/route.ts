import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import type { ReviewStatus } from "@/lib/supabase/types";
import { serverError } from "@/lib/api/errorResponse";
import { insertNotification } from "@/lib/api/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/offers?status=pending_review|approved|rejected|all */
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "pending_review";
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("offers")
      .select(
        "id, headline, discount_value, promo_code, description, terms, valid_from, valid_to, redemption_limit_per_member, review_status, review_note, reviewed_at, submitted_for_review_at, approved_at, created_at, updated_at, vendor_id, catalog_item_id, catalog_items(id, name, category, type, tagline, price_label), vendors(id, company_name, contact_name, contact_email, contact_phone, website, logo_url, status, verified), offer_media(id, kind, url, thumbnail_url, caption, position)",
      )
      .order("submitted_for_review_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (status !== "all") {
      query = query.eq("review_status", status as ReviewStatus);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/offers" });
  }
}

/** PATCH body { id, action: 'approve'|'reject', note? } */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ error: "id and a valid action are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: readErr } = await supabase
      .from("offers")
      .select("id, headline, description, discount_value, vendor_id")
      .eq("id", body.id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!existing) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

    const newStatus: ReviewStatus = body.action === "approve" ? "approved" : "rejected";
    const patch: { review_status: ReviewStatus; review_note: string | null; reviewed_at: string; approved_at?: string } = {
      review_status: newStatus,
      review_note: body.note ?? null,
      reviewed_at: new Date().toISOString(),
    };
    if (body.action === "approve") patch.approved_at = new Date().toISOString();

    const { error: upErr } = await supabase.from("offers").update(patch).eq("id", body.id);
    if (upErr) throw upErr;

    await supabase.from("review_actions").insert({
      target_type: "offer",
      target_id: body.id,
      action: body.action,
      note: body.note ?? null,
      admin_id: guard.adminId,
    });

    // Notify vendor
    if (existing.vendor_id) {
      await insertNotification(supabase, {
        audience: "vendor",
        vendor_id: existing.vendor_id,
        kind: body.action === "approve" ? "offer_approved" : "offer_rejected",
        title:
          body.action === "approve"
            ? `Offer approved: ${existing.headline}`
            : `Offer rejected: ${existing.headline}`,
        body: body.note ?? null,
        link: "/vendor/offers",
        metadata: { offer_id: body.id },
      });
    }

    // Announce the new offer to the MEMBER network — kind "update" (NOT
    // "feature": feature spotlights render inside Member offers and would
    // duplicate the real offer row). Lands on the dashboard "What's new"
    // showcase and the partner profile carousel. Best-effort.
    if (body.action === "approve" && existing.vendor_id) {
      try {
        const { data: v } = await supabase
          .from("vendors")
          .select("display_name, company_name")
          .eq("id", existing.vendor_id)
          .maybeSingle();
        const vendorName = v?.display_name || v?.company_name || "An ASN partner";
        await supabase.from("profile_spotlights").insert({
          vendor_id: existing.vendor_id,
          kind: "update",
          title: `New member offer from ${vendorName}: ${existing.headline}`,
          body:
            existing.description ||
            `${existing.discount_value ? `${existing.discount_value}. ` : ""}See the full offer on their profile.`,
          link_url: `/dashboard/partners/${existing.vendor_id}`,
          link_label: "See the offer",
          is_published: true,
          posted_to_feed: true,
          published_at: new Date().toISOString(),
          created_by: guard.adminId,
        });
      } catch (err) {
        console.error("[admin offers] member announcement failed:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/admin/offers" });
  }
}
