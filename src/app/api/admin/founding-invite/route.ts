import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { appOrigin } from "@/lib/stripe";
import type { FoundingInviteRole, FoundingInviteCompany } from "@/lib/supabase/types";
import { serverError } from "@/lib/api/errorResponse";
import { insertNotification } from "@/lib/api/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGREEMENT_VERSION = "v4";

/**
 * /api/admin/founding-invite
 *
 * GET  — list all founding invites for the admin management page.
 * POST — create a DRAFT invite for a hand-picked expert / partner (or
 *        both). This ONLY writes a row to the database. It does NOT
 *        render a PDF, does NOT email anyone, and does NOT approve or
 *        provision anything. These are real people — sending is a
 *        separate, explicit admin action
 *        (POST /api/admin/founding-invite/[id] { action: "send" }).
 */
type Body = {
  role?: FoundingInviteRole;
  /**
   * Company plan after the 6 free months: "ladder" ($39 x 12 then $149,
   * default) or "flat" ($39, no increase). Ignored on expert invites.
   */
  pricing_plan?: string;
  full_name?: string;
  email?: string;
  company_name?: string;
  member_offer?: string;
  phone?: string;
  notes?: string;
  website?: string;
  category?: string;
  calendar_link?: string;
  description?: string;
  secondary_email?: string;
  secondary_phone?: string;
  signer_name?: string;
  signer_title?: string;
  companies?: FoundingInviteCompany[];
};

function clean(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

/** Keep only well-formed company entries (a non-empty name). */
function cleanCompanies(input: unknown): FoundingInviteCompany[] | null {
  if (!Array.isArray(input)) return null;
  const out = input
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      name: String((c as { name?: unknown }).name ?? "").trim(),
      category: clean((c as { category?: string }).category),
      website: clean((c as { website?: string }).website),
      description: clean((c as { description?: string }).description),
      member_offer: clean((c as { member_offer?: string }).member_offer),
      contact_name: clean((c as { contact_name?: string }).contact_name),
      contact_email: clean((c as { contact_email?: string }).contact_email)?.toLowerCase() ?? null,
      calendar_link: clean((c as { calendar_link?: string }).calendar_link),
    }))
    .filter((c) => c.name);
  return out.length ? out : null;
}

function genCode(): string {
  // 18 bytes → 24-char base64url. ~144 bits of entropy — unguessable.
  return crypto.randomBytes(18).toString("base64url");
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("founding_invites")
    .select(
      "id, code, role, pricing_plan, full_name, email, company_name, member_offer, phone, notes, website, category, calendar_link, description, secondary_email, secondary_phone, signer_name, signer_title, companies, status, agreement_pdf_path, viewed_at, accepted_at, expires_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    return serverError(error, { route: "GET /api/admin/founding-invite" });
  }

  const origin = appOrigin();
  const rows = (data ?? []).map((r) => ({
    ...r,
    invite_url: `${origin}/founding/${r.code}`,
  }));
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const role = body.role;
  if (role !== "expert" && role !== "partner" && role !== "both") {
    return NextResponse.json({ error: "role must be expert, partner or both." }, { status: 400 });
  }
  // Company plan: ladder unless the admin picked flat. Expert invites store
  // "ladder" (ignored; experts are 12 months free, then $39).
  const pricingPlan = role === "expert" ? "ladder" : body.pricing_plan === "flat" ? "flat" : "ladder";
  const fullName = (body.full_name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const companyName = (body.company_name ?? "").trim() || null;
  const memberOffer = (body.member_offer ?? "").trim() || null;

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  // A draft may be saved with a placeholder email (details still TBD) —
  // we only require a plausible address shape here. The send step
  // enforces a real, deliverable address before anything is emailed.
  if (!email || email.length > 320) {
    return NextResponse.json({ error: "Email is required (a placeholder is fine for a draft)." }, { status: 400 });
  }
  if ((role === "partner" || role === "both") && !companyName) {
    return NextResponse.json(
      { error: "Company name is required for partner / both invites." },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const code = genCode();

  const { data: inserted, error: insErr } = await sb
    .from("founding_invites")
    .insert({
      pricing_plan: pricingPlan,
      code,
      role,
      full_name: fullName,
      email,
      company_name: companyName,
      member_offer: memberOffer,
      phone: clean(body.phone),
      notes: clean(body.notes),
      website: clean(body.website),
      category: clean(body.category),
      calendar_link: clean(body.calendar_link),
      description: clean(body.description),
      secondary_email: clean(body.secondary_email)?.toLowerCase() ?? null,
      secondary_phone: clean(body.secondary_phone),
      signer_name: clean(body.signer_name),
      signer_title: clean(body.signer_title),
      companies: cleanCompanies(body.companies),
      agreement_version: AGREEMENT_VERSION,
      agreement_pdf_path: null,
      status: "draft",
      created_by: guard.adminId,
    } as never)
    .select("id")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json(
      { error: insErr?.message ?? "Couldn't save the invite." },
      { status: 500 },
    );
  }

  // Internal admin notification only — no email to the invitee.
  await insertNotification(sb, {
    audience: "admin",
    admin_id: null,
    kind: "founding_invite_drafted",
    title: `Founding invite drafted: ${fullName}`,
    body: `${role} draft saved. No email sent yet. Review it and click "Send invite" when ready.`,
    link: "/admin/founding",
    metadata: { invite_id: inserted.id, role },
  });

  return NextResponse.json({ ok: true, id: inserted.id, code, status: "draft" });
}
