import { getSupabaseAdmin } from "@/lib/supabase/server";
import { renderDmnPackPdf } from "@/lib/pdf/dmnPack";
import { sendInquiryPackEmail } from "@/lib/email/inquiryPack";

const BUCKET = "inquiry-packs";

/**
 * Generate the "everything ASN offers" PDF pack for a member inquiry,
 * store it, email it, and mark the inquiry emailed. Best-effort: the
 * inquiry row already exists, so any single failure here is logged and
 * the team can still act on the inquiry. Returns the public PDF URL when
 * it got that far (also used to link the member Inbox).
 */
export async function deliverInquiryPack(input: {
  inquiryId: string;
  memberName: string;
  email: string;
  question: string;
}): Promise<{ pdfUrl: string | null; emailed: boolean }> {
  const sb = getSupabaseAdmin();
  const dateLabel = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderDmnPackPdf({ memberName: input.memberName, question: input.question, dateLabel });
  } catch (err) {
    console.error("[inquiry-pack] PDF render failed", err);
    return { pdfUrl: null, emailed: false };
  }

  // Upload (public bucket → stable public URL for the email + Inbox).
  let pdfUrl: string | null = null;
  try {
    const path = `${input.inquiryId}.pdf`;
    const { error } = await sb.storage.from(BUCKET).upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw error;
    pdfUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    await sb.from("member_inquiries").update({ pdf_url: pdfUrl }).eq("id", input.inquiryId);
  } catch (err) {
    console.error("[inquiry-pack] storage upload failed", err);
  }

  // Email (attaches the PDF and links the stored copy).
  let emailed = false;
  try {
    const res = await sendInquiryPackEmail({
      to: input.email,
      memberName: input.memberName,
      pdfUrl: pdfUrl ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.aestheticsuccessnetwork.com"}/dashboard/inbox`,
      pdfBuffer,
      question: input.question,
    });
    emailed = res.sent;
  } catch (err) {
    console.error("[inquiry-pack] email send failed", err);
  }

  if (emailed) {
    await sb
      .from("member_inquiries")
      .update({ status: "emailed", pdf_sent_at: new Date().toISOString() })
      .eq("id", input.inquiryId);
  }

  return { pdfUrl, emailed };
}
