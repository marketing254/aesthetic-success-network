import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/roles
 *
 * Tells the portal shells whether the currently signed-in user holds
 * MORE than one role, so a "View as Partner / View as Expert" switcher
 * can be shown. A user is dual-role when their email exists in both the
 * `experts` table and the `vendors` table (e.g. a founding "both"
 * invite provisions one auth user + a row in each).
 */
export async function GET() {
  const cookieClient = await createServerSupabase();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ authenticated: false, expert: false, vendor: false, dual: false });
  }
  const email = user.email.toLowerCase();
  const userId = user.id;

  const sb = getSupabaseAdmin();
  const [{ data: expert }, { data: vendor }] = await Promise.all([
    sb.from("experts").select("id, status, auth_user_id").eq("email", email).maybeSingle(),
    sb.from("vendors").select("id, status, auth_user_id").eq("contact_email", email).maybeSingle(),
  ]);

  // Exclude fully retired rows so we don't offer a switch into a dead portal.
  const expertOk = !!expert && expert.status !== "archived";
  const vendorOk = !!vendor && vendor.status !== "churned";

  // Dual-role: make sure BOTH rows are linked to this verified auth user
  // so the middleware gates (expert gate keys off experts.auth_user_id)
  // let them into either portal via the "View as …" switcher. Safe — the
  // session is validated and we only touch the caller's own rows.
  if (expertOk && vendorOk) {
    const links: PromiseLike<unknown>[] = [];
    if (expert && expert.auth_user_id !== userId) {
      links.push(sb.from("experts").update({ auth_user_id: userId } as never).eq("id", expert.id));
    }
    if (vendor && vendor.auth_user_id !== userId) {
      links.push(sb.from("vendors").update({ auth_user_id: userId } as never).eq("id", vendor.id));
    }
    if (links.length) await Promise.all(links);
  }

  return NextResponse.json({
    authenticated: true,
    expert: expertOk,
    vendor: vendorOk,
    dual: expertOk && vendorOk,
  });
}
