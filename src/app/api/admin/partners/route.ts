import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { errMessage } from "@/lib/errMessage";
import { writeAudit } from "@/lib/audit";
import { notifyTeam, sendPartnerApprovalEmail } from "@/lib/email/templates";
import { ensureAuthUser } from "@/lib/auth/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AppStatus = "new" | "in_review" | "approved" | "declined";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("partner_applications")
      .select(
        "id, company_name, website, contact_name, contact_role, contact_email, contact_phone, category, description, member_deal, booking_link, billing_contact, agreement_accepted, source, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    const message = errMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const allowed: AppStatus[] = ["new", "in_review", "approved", "declined"];
  if (!body.id || !body.status || !allowed.includes(body.status as AppStatus)) {
    return NextResponse.json({ error: "id and a valid status are required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Read the previous state so the approval email only fires on the
    // FIRST transition to approved (re-saving approved sends nothing).
    const { data: before } = await supabase
      .from("partner_applications")
      .select("status, contact_email, contact_name, company_name")
      .eq("id", body.id)
      .maybeSingle();

    const { error } = await supabase
      .from("partner_applications")
      .update({
        status: body.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: guard.email,
      })
      .eq("id", body.id);
    if (error) throw error;
    await writeAudit(guard, "partner_application", body.id, `status:${body.status}`);

    if (body.status === "approved" && before && before.status !== "approved") {
      // Approval opens /vendor — provision the auth user so sign-in works.
      if (!(await ensureAuthUser(before.contact_email as string))) {
        console.error("[admin:partners] auth user provisioning failed for", before.contact_email);
      }
      await sendPartnerApprovalEmail(
        before.contact_email as string,
        (before.contact_name as string) ?? "",
        (before.company_name as string) ?? "",
      );
      void notifyTeam("Partner approved", [
        ["Company", (before.company_name as string) ?? ""],
        ["Contact", (before.contact_name as string) ?? ""],
        ["Email", before.contact_email as string],
        ["Approved by", guard.email],
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = errMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
