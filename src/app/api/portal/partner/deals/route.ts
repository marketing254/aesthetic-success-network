import { NextResponse } from "next/server";
import { requirePortalPartner } from "@/lib/auth/guards";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { asString } from "@/lib/forms/request";
import { errMessage } from "@/lib/errMessage";
import { resolvePortalRoles } from "@/lib/auth/portal";
import { notifyTeam } from "@/lib/email/templates";
import { DEAL_CATEGORIES } from "@/lib/portal/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Partners can move a deal between draft / pending_review / archived.
 * They can NEVER set `published` — every member-facing offer is curated
 * by the ASN team from the admin console. That's the whole promise on the
 * landing page ("curated by our team, never by an algorithm").
 */
const PARTNER_SETTABLE = ["draft", "pending_review", "archived"] as const;

type DealInput = {
  title: string;
  category: string;
  description: string;
  dealTerms: string;
  redemptionUrl: string;
  redemptionNote: string;
  status: string;
};

function readInput(b: Record<string, unknown>): DealInput {
  return {
    title: asString(b.title),
    category: asString(b.category),
    description: asString(b.description),
    dealTerms: asString(b.dealTerms),
    redemptionUrl: asString(b.redemptionUrl),
    redemptionNote: asString(b.redemptionNote),
    status: asString(b.status) || "draft",
  };
}

function validate(input: DealInput): string | null {
  if (input.title.length < 4 || input.title.length > 160) return "Give the deal a title (4–160 characters).";
  if (input.description.length > 1200) return "Keep the description under 1200 characters.";
  if (input.dealTerms.length > 600) return "Keep the deal terms under 600 characters.";
  if (input.redemptionNote.length > 600) return "Keep the redemption note under 600 characters.";
  if (input.redemptionUrl && !/^https?:\/\//i.test(input.redemptionUrl))
    return "The redemption link must start with http:// or https://";
  if (input.category && !(DEAL_CATEGORIES as readonly string[]).includes(input.category))
    return "Pick a category from the list.";
  if (!(PARTNER_SETTABLE as readonly string[]).includes(input.status))
    return "You can save a deal as a draft or submit it for review — our team publishes it.";
  if (input.status === "pending_review" && input.dealTerms.trim().length < 10)
    return "Spell out the member deal before submitting it for review.";
  return null;
}

/** GET /api/portal/partner/deals — the partner's own deals. */
export async function GET() {
  const guard = await requirePortalPartner();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vendor_deals")
      .select(
        "id, title, category, description, deal_terms, redemption_url, redemption_note, status, published_at, created_at, updated_at",
      )
      .eq("partner_id", guard.rowId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ deals: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** POST /api/portal/partner/deals — create a deal. */
export async function POST(req: Request) {
  const guard = await requirePortalPartner();
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const input = readInput((json ?? {}) as Record<string, unknown>);
  const invalid = validate(input);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const identity = await resolvePortalRoles(guard.email);
    const companyName = identity.partner?.companyName || guard.email;
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("vendor_deals")
      .insert({
        partner_id: guard.rowId,
        company_name: companyName,
        title: input.title,
        category: input.category || null,
        description: input.description || null,
        deal_terms: input.dealTerms || null,
        redemption_url: input.redemptionUrl || null,
        redemption_note: input.redemptionNote || null,
        status: input.status,
        updated_at: now,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (input.status === "pending_review") {
      await notifyTeam("Vendor deal submitted for review", [
        ["Partner", companyName],
        ["Contact", guard.email],
        ["Deal", input.title],
        ["Terms", input.dealTerms],
        ["Deal ID", data.id as string],
      ]);
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[portal:partner:deals] insert failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** PATCH /api/portal/partner/deals — update one of the partner's own deals. */
export async function PATCH(req: Request) {
  const guard = await requirePortalPartner();
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const b = (json ?? {}) as Record<string, unknown>;
  const id = asString(b.id);
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const input = readInput(b);
  const invalid = validate(input);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("vendor_deals")
      .select("id, status, company_name")
      .eq("id", id)
      .eq("partner_id", guard.rowId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

    // Editing a live deal pulls it back into review rather than silently
    // changing what members already see.
    const nextStatus =
      existing.status === "published" && input.status !== "archived" ? "pending_review" : input.status;

    const { error } = await supabase
      .from("vendor_deals")
      .update({
        title: input.title,
        category: input.category || null,
        description: input.description || null,
        deal_terms: input.dealTerms || null,
        redemption_url: input.redemptionUrl || null,
        redemption_note: input.redemptionNote || null,
        status: nextStatus,
        // nextStatus is never "published" here (partners can't self-publish),
        // so any edit to a live deal also clears the published stamp.
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("partner_id", guard.rowId);
    if (error) throw error;

    if (nextStatus === "pending_review") {
      await notifyTeam("Vendor deal submitted for review", [
        ["Partner", (existing.company_name as string) ?? ""],
        ["Contact", guard.email],
        ["Deal", input.title],
        ["Terms", input.dealTerms],
        ["Deal ID", id],
        ["Note", existing.status === "published" ? "Edited while live — pulled back into review" : ""],
      ]);
    }

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (err) {
    console.error("[portal:partner:deals] update failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
