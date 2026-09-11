import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString } from "@/lib/forms/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Derive an uppercase, alphanumeric-only code from free text, capped at maxLen. */
function deriveCode(source: string, maxLen = 10): string {
  const base = source.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, maxLen);
  return base || "CODE";
}

function randomSuffix(len = 3): string {
  return Math.random()
    .toString(36)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(len, "X")
    .slice(0, len);
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const [codesRes, expertsRes, partnersRes] = await Promise.all([
      supabase
        .from("promo_codes")
        .select(
          "id, code, label, discount_description, expert_application_id, partner_application_id, active, expires_at, max_redemptions, redemption_count, created_by, created_at, updated_at",
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
    ]);
    if (codesRes.error) throw codesRes.error;
    if (expertsRes.error) throw expertsRes.error;
    if (partnersRes.error) throw partnersRes.error;

    return NextResponse.json({
      rows: codesRes.data ?? [],
      experts: expertsRes.data ?? [],
      partners: partnersRes.data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * POST — mint a promo code. Body:
 *   { label, code?, discountDescription?, ownerType?: "expert"|"partner"|"team",
 *     ownerId?, expiresAt?, maxRedemptions? }
 * A code is auto-derived from the label when omitted, and de-duplicated
 * case-insensitively against the existing set (promo_codes_code_uidx).
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

  const label = asString(body.label);
  if (label.length < 2) {
    return NextResponse.json({ error: "Label must be at least 2 characters." }, { status: 400 });
  }

  const ownerType = asString(body.ownerType) || "team";
  if (!["expert", "partner", "team"].includes(ownerType)) {
    return NextResponse.json({ error: "Invalid owner type." }, { status: 400 });
  }
  const ownerId = asString(body.ownerId) || null;
  if ((ownerType === "expert" || ownerType === "partner") && !ownerId) {
    return NextResponse.json({ error: "Choose an owner for that owner type." }, { status: 400 });
  }

  const discountDescription = asString(body.discountDescription) || null;

  const expiresAtRaw = asString(body.expiresAt);
  let expiresAt: string | null = null;
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date." }, { status: 400 });
    }
    expiresAt = parsed.toISOString();
  }

  const maxRedemptionsRaw = body.maxRedemptions;
  let maxRedemptions: number | null = null;
  if (maxRedemptionsRaw !== undefined && maxRedemptionsRaw !== null && maxRedemptionsRaw !== "") {
    const n = Number(maxRedemptionsRaw);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Max redemptions must be a positive number." }, {
        status: 400,
      });
    }
    maxRedemptions = Math.trunc(n);
  }

  try {
    const supabase = getSupabaseAdmin();

    let code = asString(body.code).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) code = deriveCode(label);

    let finalCode = code;
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabase
        .from("promo_codes")
        .select("id")
        .ilike("code", finalCode)
        .maybeSingle();
      if (!clash) break;
      finalCode = `${code}${randomSuffix()}`;
    }

    const { data: inserted, error } = await supabase
      .from("promo_codes")
      .insert({
        code: finalCode,
        label,
        discount_description: discountDescription,
        expert_application_id: ownerType === "expert" ? ownerId : null,
        partner_application_id: ownerType === "partner" ? ownerId : null,
        expires_at: expiresAt,
        max_redemptions: maxRedemptions,
        created_by: guard.adminId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await writeAudit(guard, "promo_code", inserted.id as string, "create", `code ${finalCode}`);
    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "That code is already taken. Try again." }, {
        status: 409,
      });
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
      .from("promo_codes")
      .update({
        active: body.action === "activate",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id);
    if (error) throw error;

    await writeAudit(guard, "promo_code", body.id, body.action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
