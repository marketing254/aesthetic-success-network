import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { errMessage } from "@/lib/errMessage";
import { asString, isValidEmail } from "@/lib/forms/request";
import { notifyTeam, sendMemberWelcomeEmail } from "@/lib/email/templates";
import { ensureAuthUser } from "@/lib/auth/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("members")
      .select(
        "id, email, first_name, last_name, practice_name, practice_role, phone, status, tier, waitlist_signup_id, activated_at, activated_by, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/**
 * POST — activate a member (DMN pattern, launch-phase scope).
 * Two modes:
 *   { waitlistSignupId }  — promote a waitlist signup (flips it to "converted")
 *   { email, firstName, lastName, practiceName?, phone? } — manual add
 * Activation also provisions the Supabase auth user, which is what opens
 * /dashboard for them. Billing is still out of scope — no payment flow
 * exists yet, and the site promises members confirm before any charge.
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

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    let email = asString(body.email).toLowerCase();
    let firstName = asString(body.firstName);
    let lastName = asString(body.lastName);
    let practiceName = asString(body.practiceName);
    let practiceRole = "";
    let phone = asString(body.phone);
    const waitlistSignupId = asString(body.waitlistSignupId) || null;

    if (waitlistSignupId) {
      const { data: signup, error } = await supabase
        .from("waitlist_signups")
        .select("id, email, first_name, last_name, practice_name, practice_role, phone, status")
        .eq("id", waitlistSignupId)
        .maybeSingle();
      if (error) throw error;
      if (!signup) {
        return NextResponse.json({ error: "Waitlist signup not found." }, { status: 404 });
      }
      email = String(signup.email).toLowerCase();
      firstName = String(signup.first_name);
      lastName = String(signup.last_name);
      practiceName = (signup.practice_name as string | null) ?? "";
      practiceRole = (signup.practice_role as string | null) ?? "";
      phone = (signup.phone as string | null) ?? "";
    }

    if (!isValidEmail(email) || !firstName || !lastName) {
      return NextResponse.json(
        { error: "email, firstName and lastName are required." },
        { status: 400 },
      );
    }

    // Upsert by email — activating twice is idempotent.
    const { data: existing } = await supabase
      .from("members")
      .select("id, status")
      .ilike("email", email)
      .maybeSingle();

    let memberId: string;
    if (existing) {
      memberId = existing.id as string;
      const { error } = await supabase
        .from("members")
        .update({ status: "active", activated_at: now, activated_by: guard.email })
        .eq("id", memberId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase
        .from("members")
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          practice_name: practiceName || null,
          practice_role: practiceRole || null,
          phone: phone || null,
          status: "active",
          tier: "founding",
          waitlist_signup_id: waitlistSignupId,
          activated_at: now,
          activated_by: guard.email,
          joined_at: now,
        })
        .select("id")
        .single();
      if (error) throw error;
      memberId = inserted.id as string;
    }

    if (waitlistSignupId) {
      await supabase
        .from("waitlist_signups")
        .update({ status: "converted" })
        .eq("id", waitlistSignupId);
    }

    await writeAudit(
      guard,
      "member",
      memberId,
      waitlistSignupId ? "activate_from_waitlist" : "activate_manual",
      waitlistSignupId ? `waitlist_signup ${waitlistSignupId}` : undefined,
    );

    // Provision the auth user so they can actually sign in to /dashboard.
    if (!(await ensureAuthUser(email))) {
      console.error("[admin:members] auth user provisioning failed for", email);
    }

    await sendMemberWelcomeEmail(email, firstName);

    void notifyTeam("Member activated", [
      ["Name", `${firstName} ${lastName}`],
      ["Email", email],
      ["Practice", practiceName],
      ["Activated by", guard.email],
      ["Origin", waitlistSignupId ? "waitlist" : "manual add"],
    ]);

    return NextResponse.json({ ok: true, memberId });
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "That email is already a member." }, { status: 409 });
    }
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}

/** PATCH { id, action: "deactivate" | "reactivate" } */
export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const allowed = ["deactivate", "reactivate"];
  if (!body.id || !body.action || !allowed.includes(body.action)) {
    return NextResponse.json({ error: "id and a valid action are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("members")
      .update({ status: body.action === "deactivate" ? "paused" : "active" })
      .eq("id", body.id);
    if (error) throw error;

    await writeAudit(guard, "member", body.id, body.action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
