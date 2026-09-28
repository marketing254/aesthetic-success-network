import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/waitlist/rateLimit";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { notifyTeam, sendLeadMagnetEmail } from "@/lib/email/teamNotify";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { clientIp, hashIp } from "@/lib/security/hashIp";
import { normalizeEmail, asStringMax } from "@/lib/waitlist/validate";
import { appUrl } from "@/lib/stripe";
import { getLeadMagnet, LEAD_MAGNET_SLUG_RE } from "@/lib/leadMagnets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LEN = 120;

/**
 * POST /api/lead-magnets/[slug]
 *
 * Body: { email, fullName? }
 *
 * - `slug` must exist in LEAD_MAGNETS (src/lib/leadMagnets.ts); anything
 *   else is a 404 so the route cannot be probed for files.
 * - Records the lead in `lead_magnet_leads` (unique on magnet_slug+email,
 *   re-asking is idempotent: the email still goes out, no duplicate row).
 * - Emails the PDF attachment to the requester.
 * - Notifies the team distribution list so they can follow up.
 *
 * Rate-limited per IP+email so a bot can't drain the team's inbox.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const route = `POST /api/lead-magnets/${slug}`;

  if (!LEAD_MAGNET_SLUG_RE.test(slug)) return apiError.notFound(route);
  const magnet = getLeadMagnet(slug);
  if (!magnet) return apiError.notFound(route);

  let body: { email?: unknown; fullName?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest();
  }

  const email = normalizeEmail(body.email);
  const fullName = asStringMax(body.fullName, MAX_NAME_LEN) || null;

  if (!email) {
    return apiError.validation("Enter a valid email address.");
  }

  const ip = clientIp(req);
  const rl = await checkRateLimit(`lead-magnet:${slug}:${ip}:${email}`);
  if (!rl.allowed) {
    return apiError.rateLimited(route);
  }

  try {
    const admin = getSupabaseAdmin();

    // Idempotent upsert: re-asking returns the original row id.
    const { data: existing } = await admin
      .from("lead_magnet_leads")
      .select("id, contacted_at")
      .eq("magnet_slug", slug)
      .eq("email", email)
      .maybeSingle();

    if (!existing) {
      await admin.from("lead_magnet_leads").insert({
        magnet_slug: slug,
        email,
        full_name: fullName,
        source: "landing-free-kit",
        ip_hash: hashIp(ip).slice(0, 32),
        user_agent: req.headers.get("user-agent")?.slice(0, 256) ?? null,
      });
    }

    // Fire both sends and SURFACE the outcome. We still don't fail the
    // request when an email bounces (the DB row is saved and the download
    // URL is returned) but the response reports each leg so the form can
    // warn the user.
    const downloadUrl = `/${magnet.filePath.replace(/^\/+/, "")}`;
    const pdfPromise = sendLeadMagnetEmail(email, fullName, {
      slug,
      title: magnet.title,
      filePath: magnet.filePath,
      buttonLabel: magnet.buttonLabel,
      downloadUrl: appUrl(downloadUrl),
    }).catch((err: unknown) => {
      console.error("[lead-magnet] PDF send threw:", err);
      return false;
    });

    // Anonymous input goes into the team alert: escape every value.
    const adminUrl = appUrl("/admin/lead-magnets");
    const teamPromise = notifyTeam({
      tag: "lead-magnet",
      subject: `Lead-magnet download: ${fullName ?? email}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#0A1A2F;">
          <p><strong>New free-kit download.</strong></p>
          <ul>
            <li><strong>Magnet:</strong> ${escapeHtml(magnet.title)} (${escapeHtml(slug)})</li>
            <li><strong>Email:</strong> ${escapeHtml(email)}</li>
            ${fullName ? `<li><strong>Name:</strong> ${escapeHtml(fullName)}</li>` : ""}
            <li><strong>Source:</strong> landing-free-kit</li>
            <li><strong>Time:</strong> ${escapeHtml(new Date().toUTCString())}</li>
          </ul>
          <p>Full list at <a href="${escapeHtml(adminUrl)}">/admin/lead-magnets</a>.</p>
        </div>
      `,
      text: [
        "New free-kit download.",
        `Magnet: ${magnet.title} (${slug})`,
        `Email:  ${email}`,
        fullName ? `Name:   ${fullName}` : null,
        `Source: landing-free-kit`,
        `Time:   ${new Date().toUTCString()}`,
        `Full list at ${adminUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    }).catch((err: unknown) => {
      console.error("[lead-magnet] team notify threw:", err);
      return false;
    });

    const [pdfSent, teamSent] = await Promise.all([pdfPromise, teamPromise]);
    console.info(
      `[lead-magnet] ${slug} dispatch summary: pdf:${pdfSent ? "ok" : "FAIL"} team:${teamSent ? "ok" : "FAIL"}`,
    );

    return NextResponse.json({
      ok: true,
      message: pdfSent
        ? "Check your inbox. The PDF is on its way."
        : "Saved your request. If the email doesn't arrive, use the download button below.",
      // Diagnostic flags: the form reads `pdfSent` to decide whether to
      // surface the download fallback prominently.
      pdfSent,
      teamSent,
      // Direct download path, always returned so the form can offer it
      // even when the email transport succeeded.
      downloadUrl: `/${magnet.filePath.replace(/^\/+/, "")}`,
    });
  } catch (err) {
    return serverError(err, { route });
  }
}
