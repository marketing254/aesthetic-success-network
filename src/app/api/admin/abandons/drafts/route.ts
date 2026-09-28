import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { sendDraftEmails } from "@/lib/abandoned";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/abandons/drafts — sends the three abandoned-sequence
 * emails, rendered with sample data and a [DRAFT] subject prefix, to the
 * review inbox (EMAIL_SANDBOX_TO, bcc EMAIL_AUDIT_BCC) for design/copy approval.
 * Touches no DB rows and never emails a member.
 *
 * Auth: an admin session, or `Authorization: Bearer ${CRON_SECRET}` so it
 * can be triggered from the terminal during local review.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearerOk = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!bearerOk) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;
  }
  try {
    const { sent, liveLinks } = await sendDraftEmails();
    return NextResponse.json({
      ok: true,
      sent,
      liveLinks,
      to: process.env.EMAIL_SANDBOX_TO || "rushdhaakbar82@gmail.com",
      bcc: process.env.EMAIL_AUDIT_BCC || "",
    });
  } catch (err) {
    return serverError(err, { route: "POST /api/admin/abandons/drafts" });
  }
}
