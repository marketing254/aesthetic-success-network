import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/join/expert/agreement?expert=<uuid>
 *
 * Mints a 15-minute signed URL for the expert's signed agreement PDF.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const expertId = url.searchParams.get("expert");
  if (!expertId) {
    return NextResponse.json({ error: "Missing expert id." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: expert } = await sb
    .from("experts")
    .select("agreement_pdf_path")
    .eq("id", expertId)
    .maybeSingle();

  if (!expert?.agreement_pdf_path) {
    return NextResponse.json({ error: "No agreement PDF on file yet." }, { status: 404 });
  }

  const { data: signed, error } = await sb.storage
    .from("agreements")
    .createSignedUrl(expert.agreement_pdf_path, 60 * 15);

  if (error || !signed?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Couldn't sign URL." },
      { status: 500 },
    );
  }
  return NextResponse.json({ url: signed.signedUrl });
}
