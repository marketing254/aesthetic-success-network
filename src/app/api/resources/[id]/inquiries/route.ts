import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveNetworkAuthor } from "@/lib/network/author";
import { apiError, serverError } from "@/lib/api/errorResponse";
import { insertNotification } from "@/lib/api/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INQUIRY = 2000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * GET /api/resources/[id]/inquiries
 *
 * Lists inquiries on a resource, newest first.
 *
 * Query params:
 *   limit  — page size (default 10, max 50)
 *   before — ISO cursor; returns inquiries with created_at < this value
 *
 * Visible to any authenticated network participant — member, expert,
 * partner, admin — so a member viewing the resource sees the same thread
 * the experts and other members do.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: resourceId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) {
    return apiError.unauthorized();
  }
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) {
    return apiError.forbidden();
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT),
  );
  const before = url.searchParams.get("before");

  try {
    const admin = getSupabaseAdmin();
    let query = admin
      .from("resource_inquiries")
      .select(
        "id, resource_id, author_auth_user_id, author_display_name, author_subtitle, body, reply_count, status, created_at, updated_at",
      )
      .eq("resource_id", resourceId)
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (before) query = query.lt("created_at", before);

    const { data, error } = await query;
    if (error) throw error;

    const inquiries = data ?? [];
    const cursor =
      inquiries.length === limit
        ? inquiries[inquiries.length - 1]!.created_at
        : null;

    return NextResponse.json({
      inquiries,
      cursor,
      viewer: { authUserId: author.authUserId, kind: author.kind },
    });
  } catch (err) {
    return serverError(err, { route: "GET /api/resources/[id]/inquiries" });
  }
}

/**
 * POST /api/resources/[id]/inquiries
 *
 * Creates an inquiry on a resource. Only members can start new inquiries
 * — experts and partners can only reply to existing ones. This keeps
 * the entry point in the right voice: the member is asking a question
 * about the resource they're using.
 *
 * Body: { body: string }
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: resourceId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) {
    return apiError.unauthorized();
  }
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) {
    return apiError.forbidden();
  }
  // Anyone in the network can start an inquiry — member, expert,
  // partner, admin. The author_kind is captured on the row so other
  // viewers see who asked (members ask their peers questions too;
  // experts/admins can post worked examples or call out clarifications).
  // Note: the author identity is server-resolved via resolveNetworkAuthor
  // above, so clients can't spoof their kind.

  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return apiError.badRequest();
  }
  const content = (body.body ?? "").trim();
  if (content.length < 1 || content.length > MAX_INQUIRY) {
    return apiError.validation(
      `Inquiry must be between 1 and ${MAX_INQUIRY} characters.`,
    );
  }

  try {
    const admin = getSupabaseAdmin();

    // Confirm the resource exists, is published, and grab the
    // originating expert / vendor so we know who to notify.
    const { data: resource } = await admin
      .from("resources")
      .select("id, topic_title, title, is_published, submission_status, originating_expert_id, originating_vendor_id")
      .eq("id", resourceId)
      .maybeSingle();
    if (
      !resource ||
      !resource.is_published ||
      resource.submission_status !== "approved"
    ) {
      return apiError.notFound();
    }

    // `author_member_id` is a FK to public.members. Only fill it when
    // the author actually resolved as a member; for expert/partner/admin
    // authors, `author.roleId` belongs to a different table (experts /
    // vendors / admin_users) and would fail the FK check. The
    // author_auth_user_id + author_display_name are still recorded so
    // attribution + de-dup work the same.
    const memberIdForRow =
      author.kind === "member" ? author.roleId : null;

    const { data: inserted, error } = await admin
      .from("resource_inquiries")
      .insert({
        resource_id: resourceId,
        author_auth_user_id: author.authUserId,
        author_member_id: memberIdForRow,
        author_display_name: author.displayName,
        author_subtitle: author.subtitle,
        body: content,
      })
      .select(
        "id, resource_id, author_auth_user_id, author_display_name, author_subtitle, body, reply_count, status, created_at, updated_at",
      )
      .single();
    if (error) throw error;

    // Notify the originating expert if there is one; admin always sees it.
    if (resource.originating_expert_id) {
      const { data: expertRow } = await admin
        .from("experts")
        .select("auth_user_id")
        .eq("id", resource.originating_expert_id)
        .maybeSingle();
      if (expertRow?.auth_user_id) {
        await insertNotification(admin, {
          audience: "expert",
          admin_id: null,
          recipient_auth_user_id: expertRow.auth_user_id,
          kind: "resource_inquiry_new",
          title: `New inquiry on "${resource.topic_title}: ${resource.title}"`,
          body: content.slice(0, 240),
          link: `/expert/inquiries?inquiry=${inserted.id}`,
          metadata: {
            resource_id: resourceId,
            inquiry_id: inserted.id,
            member_display_name: author.displayName,
          },
        });
      }
    }
    // Same fan-out for the originating vendor (partner) on a partner-
    // published resource. Routes to /vendor/inquiries inbox.
    if (resource.originating_vendor_id) {
      const { data: vendorRow } = await admin
        .from("vendors")
        .select("id, auth_user_id")
        .eq("id", resource.originating_vendor_id)
        .maybeSingle();
      if (vendorRow?.auth_user_id) {
        await insertNotification(admin, {
          audience: "vendor",
          vendor_id: vendorRow.id,
          recipient_auth_user_id: vendorRow.auth_user_id,
          kind: "resource_inquiry_new",
          title: `New inquiry on "${resource.topic_title}: ${resource.title}"`,
          body: content.slice(0, 240),
          link: `/vendor/inquiries?inquiry=${inserted.id}`,
          metadata: {
            resource_id: resourceId,
            inquiry_id: inserted.id,
            member_display_name: author.displayName,
          },
        });
      }
    }
    await insertNotification(admin, {
      audience: "admin",
      admin_id: null,
      kind: "resource_inquiry_new",
      title: `New inquiry: ${resource.topic_title} (${author.displayName})`,
      body: content.slice(0, 240),
      link: `/admin/inquiries?inquiry=${inserted.id}`,
      metadata: { resource_id: resourceId, inquiry_id: inserted.id },
    });

    return NextResponse.json({ ok: true, inquiry: inserted });
  } catch (err) {
    return serverError(err, { route: "POST /api/resources/[id]/inquiries" });
  }
}

/**
 * DELETE /api/resources/[id]/inquiries?inquiry_id=<uuid>
 *
 * Soft-deletes an inquiry. Allowed for the original author or any admin.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: resourceId } = await ctx.params;

  const cookieClient = await createServerSupabase();
  const { data: userData } = await cookieClient.auth.getUser();
  if (!userData?.user) {
    return apiError.unauthorized();
  }
  const author = await resolveNetworkAuthor(userData.user.id, userData.user.email ?? null);
  if (!author) {
    return apiError.forbidden();
  }

  const url = new URL(req.url);
  const inquiryId = url.searchParams.get("inquiry_id");
  if (!inquiryId) return apiError.badRequest();

  try {
    const admin = getSupabaseAdmin();
    const { data: row } = await admin
      .from("resource_inquiries")
      .select("id, resource_id, author_auth_user_id, hidden_at")
      .eq("id", inquiryId)
      .maybeSingle();
    if (!row || row.hidden_at !== null) return apiError.notFound();
    if (row.resource_id !== resourceId) return apiError.badRequest();
    if (row.author_auth_user_id !== author.authUserId && author.kind !== "admin") {
      return apiError.forbidden();
    }

    const { error } = await admin
      .from("resource_inquiries")
      .update({ hidden_at: new Date().toISOString() })
      .eq("id", inquiryId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, { route: "DELETE /api/resources/[id]/inquiries" });
  }
}
