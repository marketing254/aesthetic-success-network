import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WaitlistStatus = "new" | "contacted" | "converted" | "declined";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("waitlist_signups")
      .select(
        "id, email, first_name, last_name, phone, practice_name, practice_role, locations, challenge, source, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
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

  const allowed: WaitlistStatus[] = ["new", "contacted", "converted", "declined"];
  if (!body.id || !body.status || !allowed.includes(body.status as WaitlistStatus)) {
    return NextResponse.json({ error: "id and a valid status are required." }, { status: 400 });
  }
  const newStatus = body.status as WaitlistStatus;

  try {
    const supabase = getSupabaseAdmin();
    const update: { status: WaitlistStatus; contacted_at?: string } = { status: newStatus };
    if (newStatus === "contacted") update.contacted_at = new Date().toISOString();

    const { error } = await supabase.from("waitlist_signups").update(update).eq("id", body.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
