"use client";

/**
 * Vendor-side data fetching.
 *
 * Every helper here takes a Supabase browser client (so the cookies-bound
 * session is used) and returns either typed rows or a structured error.
 * They all read or write under the vendor's RLS scope — no service-role
 * usage. Server-side admin reads / writes belong elsewhere.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  VendorsRow,
  CatalogItemsRow,
  CatalogMediaRow,
  OffersRow,
  OfferMediaRow,
  RedemptionsRow,
} from "./types";

type Client = SupabaseClient<Database>;

// =====================================================================
// VENDOR (the signed-in vendor's own row)
// =====================================================================

export async function fetchCurrentVendor(supabase: Client): Promise<VendorsRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  // 1. Primary path: vendor row linked to the auth user id.
  const linkedQuery = await supabase
    .from("vendors")
    .select("*")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (linkedQuery.error) {
    console.error("[vendorQueries] fetchCurrentVendor (linked):", linkedQuery.error);
    return null;
  }
  if (linkedQuery.data) return linkedQuery.data;

  // 2. Fallback: match by email. RLS still has to allow the read; if it
  //    doesn't, we just get null and the empty state explains why. This
  //    catches the case where auth_user_id wasn't backfilled yet for an
  //    existing vendor row.
  const email = userData.user.email?.toLowerCase();
  if (!email) return null;
  const byEmail = await supabase
    .from("vendors")
    .select("*")
    .eq("contact_email", email)
    .maybeSingle();
  if (byEmail.error) {
    console.error("[vendorQueries] fetchCurrentVendor (email):", byEmail.error);
    return null;
  }
  return byEmail.data;
}

export async function updateCurrentVendor(
  supabase: Client,
  patch: Partial<VendorsRow>,
): Promise<{ ok: boolean; error?: string }> {
  const vendor = await fetchCurrentVendor(supabase);
  if (!vendor) return { ok: false, error: "Not signed in." };

  // Never let the vendor mutate sensitive fields client-side.
  const safePatch: Partial<VendorsRow> = { ...patch };
  delete safePatch.id;
  delete safePatch.auth_user_id;
  delete safePatch.status;
  delete safePatch.verified;
  delete safePatch.agreement_signed_at;
  delete safePatch.agreement_version;
  delete safePatch.plan_id;
  delete safePatch.months_in_program;
  delete safePatch.created_at;
  delete safePatch.updated_at;

  const { error } = await supabase.from("vendors").update(safePatch).eq("id", vendor.id);
  if (error) {
    console.error("[vendorQueries] updateCurrentVendor:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// =====================================================================
// CATALOG
// =====================================================================

export type CatalogItemWithMedia = CatalogItemsRow & {
  catalog_media: CatalogMediaRow[];
};

export async function fetchVendorCatalog(
  supabase: Client,
  vendorId: string,
): Promise<CatalogItemWithMedia[]> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("*, catalog_media(*)")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[vendorQueries] fetchVendorCatalog:", error);
    return [];
  }
  // The generated Database types declare no relationships, so the embedded
  // `catalog_media(*)` select cannot be typed by PostgREST; widen first.
  return (data ?? []) as unknown as CatalogItemWithMedia[];
}

export async function fetchCatalogItem(
  supabase: Client,
  itemId: string,
): Promise<CatalogItemWithMedia | null> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("*, catalog_media(*)")
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    console.error("[vendorQueries] fetchCatalogItem:", error);
    return null;
  }
  return (data ?? null) as CatalogItemWithMedia | null;
}

export type NewCatalogItemInput = {
  vendor_id: string;
  type: CatalogItemsRow["type"];
  name: string;
  tagline?: string | null;
  description: string;
  category: string;
  price_label: string;
  duration_hours?: number | null;
  module_count?: number | null;
  ce_credits?: number | null;
  highlights?: string[];
  tags?: string[];
};

export async function createCatalogItem(
  supabase: Client,
  input: NewCatalogItemInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("catalog_items")
    .insert({
      vendor_id: input.vendor_id,
      type: input.type,
      name: input.name,
      tagline: input.tagline ?? null,
      description: input.description,
      category: input.category,
      price_label: input.price_label,
      duration_hours: input.duration_hours ?? null,
      module_count: input.module_count ?? null,
      ce_credits: input.ce_credits ?? null,
      highlights: input.highlights ?? [],
      tags: input.tags ?? [],
      review_status: "pending_review",
      submitted_for_review_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[vendorQueries] createCatalogItem:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id };
}

// =====================================================================
// CATALOG MEDIA (images, videos, documents)
// =====================================================================

export type CatalogMediaKind = "image" | "video" | "document";

/**
 * Uploads a file to the catalog-media bucket and creates a catalog_media row.
 * Path convention: {vendor_id}/{catalog_item_id}/{kind}-{timestamp}.{ext}
 */
export async function uploadCatalogMedia(
  supabase: Client,
  args: {
    vendorId: string;
    catalogItemId: string;
    file: File;
    kind: CatalogMediaKind;
    caption?: string;
  },
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ext = args.file.name.split(".").pop() ?? "bin";
  const path = `${args.vendorId}/${args.catalogItemId}/${args.kind}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("catalog-media")
    .upload(path, args.file, { upsert: false, contentType: args.file.type || undefined });
  if (upErr) {
    console.error("[vendorQueries] uploadCatalogMedia upload:", upErr);
    return { ok: false, error: upErr.message };
  }

  const { data: pub } = supabase.storage.from("catalog-media").getPublicUrl(path);

  const { error: rowErr } = await supabase.from("catalog_media").insert({
    catalog_item_id: args.catalogItemId,
    kind: args.kind,
    url: pub.publicUrl,
    caption: args.caption ?? null,
    mime_type: args.file.type || null,
    file_size_bytes: args.file.size,
    position: 0,
  });
  if (rowErr) {
    console.error("[vendorQueries] uploadCatalogMedia row:", rowErr);
    return { ok: false, error: rowErr.message };
  }
  return { ok: true, url: pub.publicUrl };
}

// =====================================================================
// OFFERS
// =====================================================================

export type OfferWithCatalog = OffersRow & {
  catalog_items: Pick<CatalogItemsRow, "id" | "name" | "type" | "category"> | null;
  offer_media: OfferMediaRow[];
};

export async function fetchVendorOffers(
  supabase: Client,
  vendorId: string,
): Promise<OfferWithCatalog[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("*, catalog_items(id, name, type, category), offer_media(*)")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[vendorQueries] fetchVendorOffers:", error);
    return [];
  }
  return (data ?? []) as unknown as OfferWithCatalog[];
}

export type NewOfferInput = {
  vendor_id: string;
  catalog_item_id: string;
  headline: string;
  discount_value: string;
  promo_code?: string | null;
  description: string;
  terms: string;
  valid_from: string;
  valid_to: string;
  redemption_limit_per_member?: string;
};

export async function createOffer(
  supabase: Client,
  input: NewOfferInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("offers")
    .insert({
      vendor_id: input.vendor_id,
      catalog_item_id: input.catalog_item_id,
      headline: input.headline,
      discount_value: input.discount_value,
      promo_code: input.promo_code ?? null,
      description: input.description,
      terms: input.terms,
      valid_from: input.valid_from,
      valid_to: input.valid_to,
      redemption_limit_per_member: input.redemption_limit_per_member ?? "unlimited",
      review_status: "pending_review",
      submitted_for_review_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[vendorQueries] createOffer:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id };
}

// =====================================================================
// REDEMPTIONS
// =====================================================================

export type RedemptionWithOffer = RedemptionsRow & {
  offers: Pick<OffersRow, "id" | "headline" | "discount_value"> | null;
};

export async function fetchVendorRedemptions(
  supabase: Client,
  vendorId: string,
  opts: { limit?: number } = {},
): Promise<RedemptionWithOffer[]> {
  const { data, error } = await supabase
    .from("redemptions")
    .select("*, offers(id, headline, discount_value)")
    .eq("vendor_id", vendorId)
    .order("redeemed_on", { ascending: false })
    .limit(opts.limit ?? 500);

  if (error) {
    console.error("[vendorQueries] fetchVendorRedemptions:", error);
    return [];
  }
  return (data ?? []) as unknown as RedemptionWithOffer[];
}

// =====================================================================
// DASHBOARD KPIs (computed in JS from the redemptions/offers tables)
// =====================================================================

export type VendorKpis = {
  redemptionsThisMonth: number;
  redemptionsLifetime: number;
  savingsDeliveredMonth: number;
  savingsDeliveredLifetime: number;
  leadsThisMonth: number;
  pendingOffersCount: number;
  activeOffersCount: number;
};

export async function fetchVendorKpis(supabase: Client, vendorId: string): Promise<VendorKpis> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [redemptionsRes, offersRes] = await Promise.all([
    supabase
      .from("redemptions")
      .select("id, redeemed_on, amount_saved, status")
      .eq("vendor_id", vendorId),
    supabase.from("offers").select("id, review_status").eq("vendor_id", vendorId),
  ]);

  const redemptions = redemptionsRes.data ?? [];
  const offers = offersRes.data ?? [];

  const redemptionsThisMonth = redemptions.filter((r) => r.redeemed_on >= monthStart).length;
  const savingsDeliveredMonth = redemptions
    .filter((r) => r.redeemed_on >= monthStart)
    .reduce((sum, r) => sum + (Number(r.amount_saved) || 0), 0);

  const savingsDeliveredLifetime = redemptions.reduce(
    (sum, r) => sum + (Number(r.amount_saved) || 0),
    0,
  );

  return {
    redemptionsThisMonth,
    redemptionsLifetime: redemptions.length,
    savingsDeliveredMonth: Math.round(savingsDeliveredMonth),
    savingsDeliveredLifetime: Math.round(savingsDeliveredLifetime),
    // No leads table yet — placeholder zero. Wire in when the bookings
    // feature ships.
    leadsThisMonth: 0,
    pendingOffersCount: offers.filter((o) => o.review_status === "pending_review").length,
    activeOffersCount: offers.filter((o) => o.review_status === "approved").length,
  };
}
