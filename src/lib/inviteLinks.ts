import "server-only";
import { randomBytes } from "node:crypto";
import type { getSupabaseAdmin } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/stripe";

type SB = ReturnType<typeof getSupabaseAdmin>;

/** Origin for invite URLs: NEXT_PUBLIC_APP_URL, then the shared appOrigin() fallbacks. */
export function inviteOrigin(): string {
  return appOrigin();
}

/** 24-char base64url — same entropy as founding invite codes. */
export function genInviteCode(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Create a standard invite link for a profile (or reuse the live one).
 * One live link per profile: if an active/viewed link already exists for
 * this expert/vendor, return it instead of minting a second URL.
 * Used by /api/admin/invite-links AND by the admin create-profile routes
 * so a fresh profile immediately has a link to copy.
 */
export async function createOrReuseInviteLink(
  sb: SB,
  input: {
    kind: "expert" | "partner";
    expertId?: string | null;
    vendorId?: string | null;
    fullName: string;
    email?: string | null;
    companyName?: string | null;
    notes?: string | null;
    createdBy?: string | null;
  },
): Promise<{ id: string; code: string; invite_url: string; reused: boolean } | null> {
  const fk = input.kind === "expert" ? "expert_id" : "vendor_id";
  const fkVal = input.kind === "expert" ? input.expertId : input.vendorId;

  if (fkVal) {
    const { data: existing } = await sb
      .from("invite_links")
      .select("id, code, status")
      .eq(fk, fkVal)
      .in("status", ["active", "viewed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { id: existing.id, code: existing.code, invite_url: `${inviteOrigin()}/invite/${existing.code}`, reused: true };
    }
  }

  const { data, error } = await sb
    .from("invite_links")
    .insert({
      code: genInviteCode(),
      kind: input.kind,
      full_name: input.fullName,
      email: input.email?.toLowerCase() || null,
      company_name: input.companyName || null,
      notes: input.notes || null,
      expert_id: input.kind === "expert" ? (input.expertId ?? null) : null,
      vendor_id: input.kind === "partner" ? (input.vendorId ?? null) : null,
      created_by: input.createdBy ?? null,
    })
    .select("id, code")
    .single();
  if (error || !data) {
    console.error("[invite-links] create failed", error?.message);
    return null;
  }
  return { id: data.id, code: data.code, invite_url: `${inviteOrigin()}/invite/${data.code}`, reused: false };
}
