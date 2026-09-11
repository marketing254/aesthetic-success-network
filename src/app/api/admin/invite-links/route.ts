import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { appOrigin } from "@/lib/stripe";
import { errMessage } from "@/lib/errMessage";
import { writeAudit } from "@/lib/audit";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/admin/invite-links — personalized expert/partner invite links.
 *
 * GET   — all links, newest first, decorated with invite_url.
 * POST  — { kind: "expert" | "partner", fullName, email?, companyName?, notes? }
 *         Free-text prospect mode only: ASN doesn't have separate
 *         `experts` / `vendors` profile tables (identity IS the
 *         application row, created only once they accept — see
 *         supabase/migrations/0015_invite_links.sql), so there's no
 *         "pick an existing profile" mode to offer here.
 * PATCH — { id, action: "revoke" | "reactivate" }
 * DELETE — ?id= (only while unaccepted)
 */

function genCode(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("invite_links")
      .select(
        "id, code, kind, full_name, email, company_name, notes, status, viewed_at, accepted_at, expert_application_id, partner_application_id, expires_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const origin = appOrigin();
    const rows = (data ?? []).map((r) => ({ ...r, invite_url: `${origin}/invite/${r.code}` }));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const kind = body.kind;
  if (kind !== "expert" && kind !== "partner") {
    return NextResponse.json({ error: "Pick expert or partner." }, { status: 400 });
  }
  const fullName = asString(body.fullName);
  if (fullName.length < 2) {
    return NextResponse.json({ error: "Add the person's name." }, { status: 400 });
  }
  const email = asString(body.email).toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }
  const companyName = asString(body.companyName) || null;
  const notes = asString(body.notes) || null;

  try {
    const supabase = getSupabaseAdmin();
    const code = genCode();

    const { data: inserted, error } = await supabase
      .from("invite_links")
      .insert({
        code,
        kind,
        full_name: fullName,
        email,
        company_name: companyName,
        notes,
        status: "active",
        created_by: guard.adminId,
      })
      .select("id, code")
      .single();
    if (error) throw error;

    await writeAudit(guard, "invite_link", inserted.id as string, "create", `${kind}:${fullName}`);

    const origin = appOrigin();
    return NextResponse.json({
      ok: true,
      id: inserted.id,
      code: inserted.code,
      invite_url: `${origin}/invite/${inserted.code}`,
    });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.id || (body.action !== "revoke" && body.action !== "reactivate")) {
    return NextResponse.json({ error: "id and a valid action are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("invite_links")
      .select("id, status")
      .eq("id", body.id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "Already accepted — nothing to change." }, { status: 400 });
    }

    if (body.action === "revoke") {
      await supabase
        .from("invite_links")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", body.id);
    } else {
      await supabase
        .from("invite_links")
        .update({
          status: "active",
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.id);
    }

    await writeAudit(guard, "invite_link", body.id, body.action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("invite_links")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    if (existing.status === "accepted") {
      return NextResponse.json(
        { error: "Accepted invites are kept for the record." },
        { status: 400 },
      );
    }
    const { error } = await supabase.from("invite_links").delete().eq("id", id);
    if (error) throw error;
    await writeAudit(guard, "invite_link", id, "delete");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
