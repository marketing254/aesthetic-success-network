import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_MIN_LEN = 4;
const CODE_MAX_LEN = 16;

function randomSuffix(len = 3): string {
  return Math.random()
    .toString(36)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(len, "X")
    .slice(0, len);
}

/** Sanitize to uppercase alphanumerics and clamp into [CODE_MIN_LEN, CODE_MAX_LEN]. */
function normalizeCode(raw: string, fallbackSource: string): string {
  let code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_MAX_LEN);
  if (!code) {
    code = fallbackSource.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_MAX_LEN) || "CODE";
  }
  while (code.length < CODE_MIN_LEN) code += randomSuffix(1);
  return code;
}

const SLUG_RE = /^[a-z0-9-]+$/;

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const [codesRes, expertsRes, partnersRes, signupsRes] = await Promise.all([
      supabase
        .from("referral_codes")
        .select(
          "id, code, slug, expert_application_id, partner_application_id, active, created_by, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("expert_applications")
        .select("id, full_name, company")
        .eq("status", "approved"),
      supabase
        .from("partner_applications")
        .select("id, company_name, contact_name")
        .eq("status", "approved"),
      supabase
        .from("referral_signups")
        .select("id, code_id, member_id, referred_name, referred_email, converted_at, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (codesRes.error) throw codesRes.error;
    if (expertsRes.error) throw expertsRes.error;
    if (partnersRes.error) throw partnersRes.error;
    if (signupsRes.error) throw signupsRes.error;

    return NextResponse.json({
      rows: codesRes.data ?? [],
      experts: expertsRes.data ?? [],
      partners: partnersRes.data ?? [],
      signups: signupsRes.data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * POST — mint a referral code for an approved expert or partner. Body:
 *   { ownerType: "expert" | "partner", ownerId, code?, slug? }
 * A code is auto-derived from the owner's name when omitted, matching
 * referral_codes' 4–16 char check constraint and de-duplicated
 * case-insensitively (referral_codes_code_uidx). Slug is optional,
 * lowercase alphanumeric+hyphen, and must be unique (referral_codes_slug_uidx).
 */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const ownerType = asString(body.ownerType);
  const ownerId = asString(body.ownerId);
  if ((ownerType !== "expert" && ownerType !== "partner") || !ownerId) {
    return NextResponse.json({ error: "ownerType (expert or partner) and ownerId are required." }, {
      status: 400,
    });
  }

  const slug = asString(body.slug).toLowerCase();
  if (slug && !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "Slug can only contain lowercase letters, numbers, and hyphens." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    let ownerName = "";
    if (ownerType === "expert") {
      const { data: owner, error } = await supabase
        .from("expert_applications")
        .select("id, full_name")
        .eq("id", ownerId)
        .maybeSingle();
      if (error) throw error;
      if (!owner) {
        return NextResponse.json({ error: "Expert application not found." }, { status: 404 });
      }
      ownerName = owner.full_name as string;
    } else {
      const { data: owner, error } = await supabase
        .from("partner_applications")
        .select("id, company_name")
        .eq("id", ownerId)
        .maybeSingle();
      if (error) throw error;
      if (!owner) {
        return NextResponse.json({ error: "Partner application not found." }, { status: 404 });
      }
      ownerName = owner.company_name as string;
    }

    const code = normalizeCode(asString(body.code), ownerName);

    let finalCode = code;
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabase
        .from("referral_codes")
        .select("id")
        .ilike("code", finalCode)
        .maybeSingle();
      if (!clash) break;
      finalCode = normalizeCode(`${code}${randomSuffix()}`, ownerName);
    }

    const { data: inserted, error } = await supabase
      .from("referral_codes")
      .insert({
        code: finalCode,
        slug: slug || null,
        expert_application_id: ownerType === "expert" ? ownerId : null,
        partner_application_id: ownerType === "partner" ? ownerId : null,
        created_by: guard.adminId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit(guard, "referral_code", inserted.id as string, "create", `code ${finalCode}`);
    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "That code or slug is already taken." }, { status: 400 });
    }
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** PATCH { id, action: "activate" | "deactivate" } */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const allowed = ["activate", "deactivate"];
  if (!body.id || !body.action || !allowed.includes(body.action)) {
    return NextResponse.json({ error: "id and a valid action are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("referral_codes")
      .update({ active: body.action === "activate" })
      .eq("id", body.id);
    if (error) throw error;

    await writeAudit(guard, "referral_code", body.id, body.action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
