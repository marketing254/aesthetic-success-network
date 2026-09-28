import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { createOrReuseInviteLink, inviteOrigin } from "@/lib/inviteLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Standard (non-founding) personalized invite links.
 *
 * Two creation modes:
 *  - EXISTING PROFILE (preferred): pick an expert/partner already created
 *    in the admin portal → the link greets them and has them accept the
 *    STANDARD agreement on their existing row; they then sign in and the
 *    billing gate collects their card. One live link per profile (reused).
 *  - NEW PROSPECT: free-text name → the link pre-fills the standard
 *    application form; accepting creates the pending-review profile.
 *
 * Nothing is ever auto-emailed — the admin pastes the URL into their own
 * manually written email.
 *
 *   GET             → all links, newest first, decorated with invite_url.
 *   GET ?owners=1   → dropdown lists of existing experts + partners.
 *   POST            → { kind, owner_id? , full_name?, email?, company_name?, notes? }
 *   PATCH           → { id, action: "revoke" | "reactivate" }.
 *   DELETE          → ?id= (only while unaccepted).
 */

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const url = new URL(req.url);
  try {
    const sb = getSupabaseAdmin();

    if (url.searchParams.get("owners") === "1") {
      const [{ data: experts }, { data: vendors }] = await Promise.all([
        sb.from("experts").select("id, display_name, full_name, email, status")
          .not("status", "in", "(archived,suspended)")
          .order("full_name"),
        sb.from("vendors").select("id, company_name, display_name, contact_name, contact_email, status")
          .neq("status", "suspended")
          .order("company_name"),
      ]);
      return NextResponse.json({
        experts: (experts ?? []).map((e) => ({
          id: e.id,
          name: e.display_name || e.full_name || "(unnamed)",
          email: e.email,
          status: e.status,
        })),
        partners: (vendors ?? []).map((v) => ({
          id: v.id,
          name: v.display_name || v.company_name || "(unnamed)",
          contact_name: v.contact_name,
          email: v.contact_email,
          status: v.status,
        })),
      });
    }

    const { data, error } = await sb
      .from("invite_links")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    const origin = inviteOrigin();
    return NextResponse.json({
      links: (data ?? []).map((r) => ({ ...r, invite_url: `${origin}/invite/${r.code}` })),
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/admin/invite-links" });
  }
}

type CreateBody = {
  kind?: "expert" | "partner";
  /** Existing profile id (experts.id or vendors.id) — preferred mode. */
  owner_id?: string;
  full_name?: string;
  email?: string;
  company_name?: string;
  notes?: string;
};

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "POST /api/admin/invite-links";
  let b: CreateBody;
  try {
    b = (await req.json()) as CreateBody;
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }
  if (b.kind !== "expert" && b.kind !== "partner") return apiError.badRequest("Pick expert or partner.", route);

  try {
    const sb = getSupabaseAdmin();

    // ── Existing-profile mode ──
    if (b.owner_id) {
      let fullName = "";
      let email: string | null = null;
      let company: string | null = null;
      if (b.kind === "expert") {
        const { data: e } = await sb.from("experts").select("id, display_name, full_name, email").eq("id", b.owner_id).maybeSingle();
        if (!e) return apiError.badRequest("Expert not found.", route);
        fullName = e.display_name || e.full_name || "(unnamed)";
        email = e.email;
      } else {
        const { data: v } = await sb.from("vendors").select("id, company_name, display_name, contact_name, contact_email").eq("id", b.owner_id).maybeSingle();
        if (!v) return apiError.badRequest("Partner not found.", route);
        fullName = v.contact_name || v.display_name || v.company_name || "(unnamed)";
        company = v.display_name || v.company_name;
        email = v.contact_email;
      }
      const link = await createOrReuseInviteLink(sb, {
        kind: b.kind,
        expertId: b.kind === "expert" ? b.owner_id : null,
        vendorId: b.kind === "partner" ? b.owner_id : null,
        fullName,
        email,
        companyName: company,
        notes: b.notes?.trim() || null,
        createdBy: guard.adminId,
      });
      if (!link) return serverError(new Error("insert failed"), { route });
      return NextResponse.json({ ok: true, link, reused: link.reused });
    }

    // ── New-prospect mode ──
    const fullName = (b.full_name ?? "").trim();
    if (fullName.length < 2) return apiError.badRequest("Add the person's name.", route);
    const email = b.email?.trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return apiError.badRequest("That email doesn't look right.", route);

    const link = await createOrReuseInviteLink(sb, {
      kind: b.kind,
      fullName,
      email,
      companyName: b.company_name?.trim() || null,
      notes: b.notes?.trim() || null,
      createdBy: guard.adminId,
    });
    if (!link) return serverError(new Error("insert failed"), { route });
    return NextResponse.json({ ok: true, link });
  } catch (err) {
    return serverError(err, { route });
  }
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "PATCH /api/admin/invite-links";
  let b: { id?: string; action?: string };
  try {
    b = (await req.json()) as { id?: string; action?: string };
  } catch {
    return apiError.badRequest("Invalid JSON.", route);
  }
  if (!b.id) return apiError.badRequest("Missing id.", route);

  try {
    const sb = getSupabaseAdmin();
    const { data: existing } = await sb.from("invite_links").select("id, status").eq("id", b.id).maybeSingle();
    if (!existing) return apiError.notFound(route);
    if (existing.status === "accepted") return apiError.badRequest("Already accepted. Nothing to change.", route);

    if (b.action === "revoke") {
      await sb.from("invite_links").update({ status: "revoked" }).eq("id", b.id);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "reactivate") {
      await sb
        .from("invite_links")
        .update({ status: "active", expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("id", b.id);
      return NextResponse.json({ ok: true });
    }
    return apiError.badRequest("Unknown action.", route);
  } catch (err) {
    return serverError(err, { route });
  }
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const route = "DELETE /api/admin/invite-links";
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return apiError.badRequest("Missing id.", route);
  try {
    const sb = getSupabaseAdmin();
    const { data: existing } = await sb.from("invite_links").select("id, status").eq("id", id).maybeSingle();
    if (!existing) return apiError.notFound(route);
    if (existing.status === "accepted") return apiError.badRequest("Accepted invites are kept for the record.", route);
    await sb.from("invite_links").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route });
  }
}
