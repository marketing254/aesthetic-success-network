import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { insertNotification } from "@/lib/api/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REPLY = 4000;

type RouteCtx = { params: Promise<{ id: string; inquiryId: string }> };

/**
 * GET /api/resources/[id]/inquiries/[inquiryId]/replies
 *
 * Returns the full reply thread for an inquiry, oldest first. No pagination
 * here — threads are short by design. If a thread ever grows past ~50
 * replies we'd add windowed pagination, but at v1 we just stream them all.
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { id: resourceId, inquiryId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) return apiError.unauthorized();
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) return apiError.forbidden();

  try {
    const admin = getSupabaseAdmin();
    // Confirm the inquiry belongs to the resource — guards against
    // crafted URLs trying to leak threads from other resources.
    const { data: inquiry } = await admin
      .from("resource_inquiries")
      .select("id, resource_id, hidden_at")
      .eq("id", inquiryId)
      .maybeSingle();
    if (!inquiry || inquiry.resource_id !== resourceId || inquiry.hidden_at !== null) {
      return apiError.notFound();
    }

    const { data, error } = await admin
      .from("resource_inquiry_replies")
      .select(
        "id, inquiry_id, author_kind, author_auth_user_id, author_display_name, author_subtitle, body, created_at",
      )
      .eq("inquiry_id", inquiryId)
      .is("hidden_at", null)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;

    return NextResponse.json({
      replies: data ?? [],
      viewer: { authUserId: author.authUserId, kind: author.kind },
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/resources/[id]/inquiries/[inquiryId]/replies" });
  }
}

/**
 * POST /api/resources/[id]/inquiries/[inquiryId]/replies
 *
 * Posts a reply. Open to any network participant — members chime in, the
 * originating expert answers, partners weigh in, admin clarifies. Author
 * identity is server-resolved from the session via resolveNetworkAuthor
 * so clients can't spoof who they are.
 *
 * Body: { body: string }
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const { id: resourceId, inquiryId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) return apiError.unauthorized();
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) return apiError.forbidden();

  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest();
  }
  const content = (body.body ?? "").trim();
  if (content.length < 1 || content.length > MAX_REPLY) {
    return apiError.validation(
      `Reply must be between 1 and ${MAX_REPLY} characters.`,
    );
  }

  try {
    const admin = getSupabaseAdmin();

    // Confirm the inquiry exists and lives on this resource.
    const { data: inquiry } = await admin
      .from("resource_inquiries")
      .select(
        "id, resource_id, author_auth_user_id, author_display_name, hidden_at",
      )
      .eq("id", inquiryId)
      .maybeSingle();
    if (!inquiry || inquiry.resource_id !== resourceId || inquiry.hidden_at !== null) {
      return apiError.notFound();
    }

    const { data: inserted, error } = await admin
      .from("resource_inquiry_replies")
      .insert({
        inquiry_id: inquiryId,
        author_kind: author.kind,
        author_auth_user_id: author.authUserId,
        author_id: author.roleId,
        author_display_name: author.displayName,
        author_subtitle: author.subtitle,
        body: content,
      })
      .select(
        "id, inquiry_id, author_kind, author_auth_user_id, author_display_name, author_subtitle, body, created_at",
      )
      .single();
    if (error) throw error;

    // Look up the resource to surface its title in the notification.
    const { data: resource } = await admin
      .from("resources")
      .select("topic_title, title, originating_expert_id, originating_vendor_id")
      .eq("id", resourceId)
      .maybeSingle();

    // Notify the inquiry author IF the replier isn't them (so people
    // don't get pinged about their own typing). Also notify the
    // originating expert if the reply isn't theirs.
    if (inquiry.author_auth_user_id !== author.authUserId) {
      await insertNotification(admin, {
        audience: "member",
        recipient_auth_user_id: inquiry.author_auth_user_id,
        kind: "resource_inquiry_reply",
        title: `New reply on your inquiry`,
        body: content.slice(0, 240),
        link: `/dashboard/network/inquiries?inquiry=${inquiryId}`,
        metadata: { resource_id: resourceId, inquiry_id: inquiryId },
      });
    }
    if (
      resource?.originating_expert_id &&
      author.kind !== "expert"
    ) {
      const { data: expertRow } = await admin
        .from("experts")
        .select("auth_user_id")
        .eq("id", resource.originating_expert_id)
        .maybeSingle();
      if (
        expertRow?.auth_user_id &&
        expertRow.auth_user_id !== author.authUserId
      ) {
        await insertNotification(admin, {
          audience: "expert",
          recipient_auth_user_id: expertRow.auth_user_id,
          kind: "resource_inquiry_reply",
          title: `New reply on "${resource.topic_title}: ${resource.title}"`,
          body: content.slice(0, 240),
          link: `/expert/inquiries?inquiry=${inquiryId}`,
          metadata: { resource_id: resourceId, inquiry_id: inquiryId },
        });
      }
    }
    // Same fan-out for vendor-originated resources — route to the partner
    // portal inbox so they see the question on their own resource.
    if (
      resource?.originating_vendor_id &&
      author.kind !== "partner"
    ) {
      const { data: vendorRow } = await admin
        .from("vendors")
        .select("id, auth_user_id")
        .eq("id", resource.originating_vendor_id)
        .maybeSingle();
      if (
        vendorRow?.auth_user_id &&
        vendorRow.auth_user_id !== author.authUserId
      ) {
        await insertNotification(admin, {
          audience: "vendor",
          vendor_id: vendorRow.id,
          recipient_auth_user_id: vendorRow.auth_user_id,
          kind: "resource_inquiry_reply",
          title: `New reply on "${resource.topic_title}: ${resource.title}"`,
          body: content.slice(0, 240),
          link: `/vendor/inquiries?inquiry=${inquiryId}`,
          metadata: { resource_id: resourceId, inquiry_id: inquiryId },
        });
      }
    }

    return NextResponse.json({ ok: true, reply: inserted });
  } catch (err) {
    return serverError(err, { route: "POST /api/resources/[id]/inquiries/[inquiryId]/replies" });
  }
}
