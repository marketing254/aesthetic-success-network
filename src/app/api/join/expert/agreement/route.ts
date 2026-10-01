import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, requireExpert } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/join/expert/agreement?expert=<uuid>
 *
 * Mints a 15-minute signed URL for the expert's signed agreement PDF.
 *
 * Owner-or-admin only. The PDF carries the signer's name, email, company
 * and IP fingerprint, so a bare id in the query string is not enough: the
 * caller must be signed in as THAT expert, or as an active admin. Any
 * other caller (including a wrong id) gets the same 404 so the endpoint
 * cannot be used to probe which ids exist.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const expertId = url.searchParams.get("expert");
  if (!expertId) {
    return NextResponse.json({ error: "Missing expert id." }, { status: 400 });
  }

  const expert = await requireExpert();
  let allowed = expert.ok && expert.expertId === expertId;
  if (!allowed) {
    const admin = await requireAdmin();
    allowed = admin.ok;
  }
  if (!allowed) {
    return NextResponse.json({ error: "No agreement PDF on file yet." }, { status: 404 });
  }

  const sb = getSupabaseAdmin();
  const { data: row } = await sb
    .from("experts")
    .select("agreement_pdf_path")
    .eq("id", expertId)
    .maybeSingle();

  if (!row?.agreement_pdf_path) {
    return NextResponse.json({ error: "No agreement PDF on file yet." }, { status: 404 });
  }

  const { data: signed, error } = await sb.storage
    .from("agreements")
    .createSignedUrl(row.agreement_pdf_path, 60 * 15);

  if (error || !signed?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Couldn't sign URL." },
      { status: 500 },
    );
  }
  return NextResponse.json({ url: signed.signedUrl });
}
