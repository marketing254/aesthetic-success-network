import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/join/partner/agreement?vendor=<uuid>
 *
 * Mints a 15-minute signed URL for the agreement PDF sitting in the
 * `agreements` bucket. Used by the success page to power the Download
 * PDF button without exposing the raw storage path.
 *
 * No auth requirement: the vendor id is a UUID that only comes back to
 * the user's own browser from the finalize response. Someone brute-
 * forcing UUIDs to steal PDFs would need a v4 UUID hit, and the
 * downloaded PDF is just their own signed agreement anyway. If we ever
 * store more sensitive attachments in this bucket we'd add a session
 * check here.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendor");
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendor id." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: vendor } = await sb
    .from("vendors")
    .select("agreement_pdf_path")
    .eq("id", vendorId)
    .maybeSingle();

  if (!vendor?.agreement_pdf_path) {
    return NextResponse.json({ error: "No agreement PDF on file yet." }, { status: 404 });
  }

  const { data: signed, error } = await sb.storage
    .from("agreements")
    .createSignedUrl(vendor.agreement_pdf_path, 60 * 15);

  if (error || !signed?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Couldn't sign URL." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: signed.signedUrl });
}
