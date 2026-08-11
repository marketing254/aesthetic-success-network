import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { resolvePortalRoles } from "@/lib/auth/portal";
import { errMessage } from "@/lib/errMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/portal/me — the signed-in user's portal identity.
 * Powers the shell (display name, role chip, portal switcher). Returns
 * 401 rather than an error page so the shell can bounce to /login.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email?.toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const identity = await resolvePortalRoles(email);
    return NextResponse.json(identity);
  } catch (err) {
    console.error("[portal:me] failed:", err);
    return NextResponse.json({ error: errMessage(err) }, { status: 500 });
  }
}
