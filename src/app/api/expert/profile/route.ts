import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePaidExpert } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/expert/profile
 *
 * Returns the signed-in expert's full profile row. Server-rendered into
 * the profile edit page on load.
 */
export async function GET() {
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("experts")
      .select(
        "id, email, full_name, display_name, phone, company_name, specialty, bio, topics, website, booking_link, headshot_url, status, activated_at",
      )
      .eq("id", guard.expertId)
      .single();
    if (error) throw error;
    return NextResponse.json({ expert: data });
  } catch (err) {
    return serverError(err, { route: "GET /api/expert/profile" });
  }
}

/**
 * PATCH /api/expert/profile
 *
 * Updates the editable fields of the expert's profile. Status, email, and
 * identity columns are never accepted from the client (admin-managed).
 */
const EDITABLE_FIELDS = [
  "display_name",
  "phone",
  "company_name",
  "specialty",
  "bio",
  "topics",
  "website",
  "booking_link",
  "headshot_url",
] as const;

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

const FIELD_LIMITS: Record<(typeof EDITABLE_FIELDS)[number], number> = {
  display_name: 120,
  phone: 32,
  company_name: 160,
  specialty: 240,
  bio: 4000,
  topics: 2000,
  website: 240,
  booking_link: 240,
  headshot_url: 500,
};

export async function PATCH(req: Request) {
  const guard = await requirePaidExpert();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Loose typing here is intentional: the Supabase Update<ExpertsRow> type
  // is strict and we're building the patch dynamically from an allowlist.
  // The cast at .update() below narrows it back into the right shape.
  const patch: Record<string, string | null> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === undefined || raw === "") {
      patch[field] = null;
      continue;
    }
    if (typeof raw !== "string") {
      return NextResponse.json(
        { error: `Field "${field}" must be a string.` },
        { status: 400 },
      );
    }
    const trimmed = raw.trim();
    const limit = FIELD_LIMITS[field];
    if (trimmed.length > limit) {
      return NextResponse.json(
        { error: `Field "${field}" is too long (max ${limit} chars).` },
        { status: 400 },
      );
    }
    if (field === "website" || field === "booking_link" || field === "headshot_url") {
      if (trimmed && !URL_RE.test(trimmed)) {
        return NextResponse.json(
          { error: `"${field}" must be a full https:// URL.` },
          { status: 400 },
        );
      }
    }
    if (field === "specialty" && trimmed.length < 2) {
      return NextResponse.json(
        { error: "Specialty is required (at least 2 characters)." },
        { status: 400 },
      );
    }
    patch[field] = trimmed;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("experts")
      // patch keys are validated against EDITABLE_FIELDS above, so the
      // cast is safe at runtime — the strict generated type just can't
      // infer it from a dynamically-built Record.
      .update(patch as never)
      .eq("id", guard.expertId)
      .select(
        "id, email, display_name, phone, company_name, specialty, bio, topics, website, booking_link, headshot_url",
      )
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, expert: data });
  } catch (err) {
    return serverError(err, { route: "PATCH /api/expert/profile" });
  }
}
