import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Server-side reads for the three portals and the admin Hotline queue.
 *
 * Every function here runs with the service-role client, so each one takes
 * the caller's scoping id (memberId / expertId / partnerId) and filters by
 * it. Callers must have passed requirePortalPage() or requirePortal*()
 * first — these helpers do not authenticate, they only scope.
 */

export type HotlineRequest = {
  id: string;
  member_id: string;
  member_email: string;
  subject: string;
  category: string | null;
  details: string;
  urgency: string;
  status: string;
  assigned_expert_id: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  answered_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type HotlineResponse = {
  id: string;
  request_id: string;
  expert_id: string;
  expert_email: string;
  summary: string;
  action_plan: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
};

export type VendorDeal = {
  id: string;
  partner_id: string;
  company_name: string;
  title: string;
  category: string | null;
  description: string | null;
  deal_terms: string | null;
  redemption_url: string | null;
  redemption_note: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpertKit = {
  id: string;
  expert_id: string;
  expert_name: string;
  title: string;
  category: string | null;
  summary: string | null;
  content: string | null;
  resource_url: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const REQUEST_COLS =
  "id, member_id, member_email, subject, category, details, urgency, status, assigned_expert_id, assigned_at, assigned_by, answered_at, closed_at, created_at";
const RESPONSE_COLS =
  "id, request_id, expert_id, expert_email, summary, action_plan, status, submitted_at, updated_at";
const DEAL_COLS =
  "id, partner_id, company_name, title, category, description, deal_terms, redemption_url, redemption_note, status, published_at, created_at, updated_at";
const KIT_COLS =
  "id, expert_id, expert_name, title, category, summary, content, resource_url, status, published_at, created_at, updated_at";

// ── Member reads ────────────────────────────────────────────────────

export async function listMemberRequests(memberId: string): Promise<HotlineRequest[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("hotline_requests")
    .select(REQUEST_COLS)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as HotlineRequest[];
}

/**
 * A member sees their own request plus the action plan — but only once the
 * expert has actually submitted it. Drafts stay invisible.
 */
export async function getMemberRequest(
  memberId: string,
  requestId: string,
): Promise<{ request: HotlineRequest; response: HotlineResponse | null } | null> {
  const supabase = getSupabaseAdmin();
  const { data: request, error } = await supabase
    .from("hotline_requests")
    .select(REQUEST_COLS)
    .eq("id", requestId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  if (!request) return null;

  const { data: response } = await supabase
    .from("hotline_responses")
    .select(RESPONSE_COLS)
    .eq("request_id", requestId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    request: request as HotlineRequest,
    response: (response as HotlineResponse) ?? null,
  };
}

export async function listPublishedDeals(): Promise<VendorDeal[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("vendor_deals")
    .select(DEAL_COLS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as VendorDeal[];
}

export async function listPublishedKits(): Promise<ExpertKit[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_kits")
    .select(KIT_COLS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ExpertKit[];
}

// ── Expert reads ────────────────────────────────────────────────────

export async function listExpertRequests(expertId: string): Promise<HotlineRequest[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("hotline_requests")
    .select(REQUEST_COLS)
    .eq("assigned_expert_id", expertId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as HotlineRequest[];
}

export async function getExpertRequest(
  expertId: string,
  requestId: string,
): Promise<{ request: HotlineRequest; response: HotlineResponse | null } | null> {
  const supabase = getSupabaseAdmin();
  const { data: request, error } = await supabase
    .from("hotline_requests")
    .select(REQUEST_COLS)
    .eq("id", requestId)
    .eq("assigned_expert_id", expertId)
    .maybeSingle();
  if (error) throw error;
  if (!request) return null;

  const { data: response } = await supabase
    .from("hotline_responses")
    .select(RESPONSE_COLS)
    .eq("request_id", requestId)
    .eq("expert_id", expertId)
    .maybeSingle();

  return {
    request: request as HotlineRequest,
    response: (response as HotlineResponse) ?? null,
  };
}

export async function getPublishedKit(kitId: string): Promise<ExpertKit | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_kits")
    .select(KIT_COLS)
    .eq("id", kitId)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return (data as ExpertKit) ?? null;
}

// ── Kit progress + feedback (0023) ─────────────────────────────────

export type KitProgress = { expert_kit_id: string; viewed_at: string; completed_at: string | null };

export async function listMemberKitProgress(memberId: string): Promise<Record<string, KitProgress>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("member_kit_progress")
    .select("expert_kit_id, viewed_at, completed_at")
    .eq("member_id", memberId);
  if (error) throw error;
  const out: Record<string, KitProgress> = {};
  for (const row of (data ?? []) as KitProgress[]) out[row.expert_kit_id] = row;
  return out;
}

export async function markKitProgress(
  memberId: string,
  kitId: string,
  completed: boolean,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const patch: Record<string, unknown> = { member_id: memberId, expert_kit_id: kitId, viewed_at: new Date().toISOString() };
  if (completed) patch.completed_at = new Date().toISOString();
  const { error } = await supabase
    .from("member_kit_progress")
    .upsert(patch, { onConflict: "member_id,expert_kit_id", ignoreDuplicates: false });
  if (error) throw error;
}

export type KitFeedback = { rating: number; comment: string | null; created_at: string };

export async function getMemberKitFeedback(memberId: string, kitId: string): Promise<KitFeedback | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("kit_feedback")
    .select("rating, comment, created_at")
    .eq("member_id", memberId)
    .eq("expert_kit_id", kitId)
    .maybeSingle();
  if (error) throw error;
  return (data as KitFeedback) ?? null;
}

export async function upsertMemberKitFeedback(
  memberId: string,
  kitId: string,
  rating: number,
  comment: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("kit_feedback")
    .upsert(
      { member_id: memberId, expert_kit_id: kitId, rating, comment, updated_at: new Date().toISOString() },
      { onConflict: "member_id,expert_kit_id" },
    );
  if (error) throw error;
}

export type KitInquiry = {
  id: string;
  question: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export async function listMemberKitInquiries(memberId: string, kitId: string): Promise<KitInquiry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("resource_inquiries")
    .select("id, question, status, admin_note, created_at, resolved_at")
    .eq("member_id", memberId)
    .eq("expert_kit_id", kitId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as KitInquiry[];
}

export async function submitKitInquiry(input: {
  memberId: string;
  expertKitId: string;
  name: string;
  email: string;
  question: string;
}): Promise<{ id: string }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("resource_inquiries")
    .insert({
      member_id: input.memberId,
      expert_kit_id: input.expertKitId,
      name: input.name,
      email: input.email,
      question: input.question,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function listExpertKits(expertId: string): Promise<ExpertKit[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_kits")
    .select(KIT_COLS)
    .eq("expert_id", expertId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ExpertKit[];
}

// ── Partner reads ───────────────────────────────────────────────────

export async function listPartnerDeals(partnerId: string): Promise<VendorDeal[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("vendor_deals")
    .select(DEAL_COLS)
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as VendorDeal[];
}

// ── Admin reads (Hotline triage) ────────────────────────────────────

export type ApprovedExpert = { id: string; full_name: string; email: string; topics: string | null };

export async function listAllHotlineRequests(): Promise<HotlineRequest[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("hotline_requests")
    .select(REQUEST_COLS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as HotlineRequest[];
}

export async function listApprovedExperts(): Promise<ApprovedExpert[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_applications")
    .select("id, full_name, email, topics")
    .eq("status", "approved")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ApprovedExpert[];
}

// ── Billing ─────────────────────────────────────────────────────────

const BILLING_SHADOW_COLS =
  "stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_interval, current_period_end, cancel_at_period_end, canceled_at, card_brand, card_last4";

export type MemberBilling = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  subscription_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
  tier: string;
  founding_member_locked: boolean;
  early_member_locked: boolean;
};

export async function getMemberBilling(memberId: string): Promise<MemberBilling | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("members")
    .select(`${BILLING_SHADOW_COLS}, tier, founding_member_locked, early_member_locked`)
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  return (data as MemberBilling) ?? null;
}

export type BusinessBilling = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  subscription_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
  program_started_at: string | null;
};

export type ExpertBilling = BusinessBilling & { founding_expert_locked: boolean };
export type PartnerBilling = BusinessBilling & { founding_partner_locked: boolean };

export async function getExpertBilling(expertApplicationId: string): Promise<ExpertBilling | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_applications")
    .select(`${BILLING_SHADOW_COLS}, program_started_at, founding_expert_locked`)
    .eq("id", expertApplicationId)
    .maybeSingle();
  if (error) throw error;
  return (data as ExpertBilling) ?? null;
}

export async function getPartnerBilling(partnerApplicationId: string): Promise<PartnerBilling | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_applications")
    .select(`${BILLING_SHADOW_COLS}, program_started_at, founding_partner_locked`)
    .eq("id", partnerApplicationId)
    .maybeSingle();
  if (error) throw error;
  return (data as PartnerBilling) ?? null;
}

// ── Systems (SOPs) ───────────────────────────────────────────────────

export type SystemSop = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  expert_id: string | null;
  expert_name: string | null;
  summary: string | null;
  content: string;
  published_at: string | null;
};

const SOP_COLS = "id, slug, title, category, expert_id, expert_name, summary, content, published_at";

export async function listPublishedSops(): Promise<SystemSop[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("system_sops")
    .select(SOP_COLS)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SystemSop[];
}

export async function getPublishedSop(slug: string): Promise<SystemSop | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("system_sops")
    .select(SOP_COLS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return (data as SystemSop) ?? null;
}

// ── Network feed ──────────────────────────────────────────────────────
// Reads and writes for the feed live in the /api/network/* route handlers
// (client-fetched, same shape TD used) + src/lib/network/author.ts, not
// here — see 0024_network_feed.sql. No server-component page reads the
// feed directly, so there's no helper to duplicate.

// ── Member-facing expert directory ──────────────────────────────────
// Richer than /experts (public): includes each expert's published kits so
// members can jump straight from a profile into the resource library.

export type MemberExpertSummary = {
  id: string;
  name: string;
  company: string | null;
  topics: string | null;
  bio: string | null;
  headshotUrl: string | null;
  kitCount: number;
};

export type MemberExpertProfile = MemberExpertSummary & {
  website: string | null;
  bookingLink: string | null;
};

export async function listMemberExperts(): Promise<MemberExpertSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data: experts, error } = await supabase
    .from("expert_applications")
    .select("id, full_name, display_name, company, topics, bio, headshot_url")
    .eq("status", "approved")
    .not("bio", "is", null)
    .order("full_name", { ascending: true });
  if (error) throw error;

  const ids = (experts ?? []).map((e) => e.id as string);
  const kitCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: kits } = await supabase
      .from("expert_kits")
      .select("expert_id")
      .in("expert_id", ids)
      .eq("status", "published");
    for (const k of kits ?? []) {
      kitCounts.set(k.expert_id as string, (kitCounts.get(k.expert_id as string) ?? 0) + 1);
    }
  }

  return (experts ?? []).map((e) => ({
    id: e.id as string,
    name: (e.display_name as string) || (e.full_name as string) || "Network expert",
    company: (e.company as string) ?? null,
    topics: (e.topics as string) ?? null,
    bio: (e.bio as string) ?? null,
    headshotUrl: (e.headshot_url as string) ?? null,
    kitCount: kitCounts.get(e.id as string) ?? 0,
  }));
}

export async function getMemberExpert(
  id: string,
): Promise<{ expert: MemberExpertProfile; kits: ExpertKit[] } | null> {
  const supabase = getSupabaseAdmin();
  const { data: expert, error } = await supabase
    .from("expert_applications")
    .select("id, full_name, display_name, company, topics, bio, headshot_url, website, booking_link, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!expert || expert.status !== "approved" || !expert.bio) return null;

  const { data: kits } = await supabase
    .from("expert_kits")
    .select(KIT_COLS)
    .eq("expert_id", id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return {
    expert: {
      id: expert.id as string,
      name: (expert.display_name as string) || (expert.full_name as string) || "Network expert",
      company: (expert.company as string) ?? null,
      topics: (expert.topics as string) ?? null,
      bio: (expert.bio as string) ?? null,
      headshotUrl: (expert.headshot_url as string) ?? null,
      website: (expert.website as string) ?? null,
      bookingLink: (expert.booking_link as string) ?? null,
      kitCount: (kits ?? []).length,
    },
    kits: (kits ?? []) as ExpertKit[],
  };
}

// ── Member-facing partner directory ─────────────────────────────────

export type MemberPartnerSummary = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logoUrl: string | null;
  dealCount: number;
};

export type MemberPartnerProfile = MemberPartnerSummary & {
  website: string | null;
  bookingLink: string | null;
  memberDeal: string | null;
};

export async function listMemberPartners(): Promise<MemberPartnerSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data: partners, error } = await supabase
    .from("partner_applications")
    .select("id, company_name, display_name, category, description, logo_url")
    .eq("status", "approved")
    .not("description", "is", null)
    .order("company_name", { ascending: true });
  if (error) throw error;

  const ids = (partners ?? []).map((p) => p.id as string);
  const dealCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: deals } = await supabase
      .from("vendor_deals")
      .select("partner_id")
      .in("partner_id", ids)
      .eq("status", "published");
    for (const d of deals ?? []) {
      dealCounts.set(d.partner_id as string, (dealCounts.get(d.partner_id as string) ?? 0) + 1);
    }
  }

  return (partners ?? []).map((p) => ({
    id: p.id as string,
    name: (p.display_name as string) || (p.company_name as string) || "Network partner",
    category: (p.category as string) ?? null,
    description: (p.description as string) ?? null,
    logoUrl: (p.logo_url as string) ?? null,
    dealCount: dealCounts.get(p.id as string) ?? 0,
  }));
}

export async function getMemberPartner(
  id: string,
): Promise<{ partner: MemberPartnerProfile; deals: VendorDeal[] } | null> {
  const supabase = getSupabaseAdmin();
  const { data: partner, error } = await supabase
    .from("partner_applications")
    .select(
      "id, company_name, display_name, category, description, member_deal, logo_url, website, booking_link, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!partner || partner.status !== "approved" || !partner.description) return null;

  const { data: deals } = await supabase
    .from("vendor_deals")
    .select(DEAL_COLS)
    .eq("partner_id", id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return {
    partner: {
      id: partner.id as string,
      name: (partner.display_name as string) || (partner.company_name as string) || "Network partner",
      category: (partner.category as string) ?? null,
      description: (partner.description as string) ?? null,
      logoUrl: (partner.logo_url as string) ?? null,
      website: (partner.website as string) ?? null,
      bookingLink: (partner.booking_link as string) ?? null,
      memberDeal: (partner.member_deal as string) ?? null,
      dealCount: (deals ?? []).length,
    },
    deals: (deals ?? []) as VendorDeal[],
  };
}

// ── Saved items (bookmarks) ──────────────────────────────────────────
// Members can bookmark an expert or partner from the directory. Reuses
// the same summary shape as the directory list so the "Saved" views
// render with the exact same card component.

export async function listSavedItemIds(
  memberId: string,
  itemType: "expert" | "partner",
): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("saved_items")
    .select("item_id")
    .eq("member_id", memberId)
    .eq("item_type", itemType);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.item_id as string));
}

export async function toggleSavedItem(
  memberId: string,
  itemType: "expert" | "partner",
  itemId: string,
): Promise<{ saved: boolean }> {
  const supabase = getSupabaseAdmin();
  const { data: existing, error } = await supabase
    .from("saved_items")
    .select("id")
    .eq("member_id", memberId)
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw error;

  if (existing) {
    const { error: delErr } = await supabase.from("saved_items").delete().eq("id", existing.id);
    if (delErr) throw delErr;
    return { saved: false };
  }
  const { error: insErr } = await supabase
    .from("saved_items")
    .insert({ member_id: memberId, item_type: itemType, item_id: itemId });
  if (insErr) throw insErr;
  return { saved: true };
}

export async function listSavedExperts(memberId: string): Promise<MemberExpertSummary[]> {
  const ids = Array.from(await listSavedItemIds(memberId, "expert"));
  if (ids.length === 0) return [];
  const experts = await listMemberExperts();
  return experts.filter((e) => ids.includes(e.id));
}

export async function listSavedPartners(memberId: string): Promise<MemberPartnerSummary[]> {
  const ids = Array.from(await listSavedItemIds(memberId, "partner"));
  if (ids.length === 0) return [];
  const partners = await listMemberPartners();
  return partners.filter((p) => ids.includes(p.id));
}


// ── Member inbox (0022 announcements + recent hotline activity) ────
// TD's inbox is fed by an AI assistant that ASN doesn't have (Phase 3
// scope explicitly leaves that stubbed — see AGENTS notes). What
// carries over cleanly is a unified notification feed: sent broadcasts
// aimed at members, plus a quick pointer at any Hotline question that
// just got answered so members don't have to go looking for it.

export type MemberAnnouncement = {
  id: string;
  title: string;
  body: string;
  sent_at: string | null;
  created_at: string;
};

export async function listMemberAnnouncements(): Promise<MemberAnnouncement[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, sent_at, created_at")
    .eq("status", "sent")
    .in("audience", ["all", "members"])
    .order("sent_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as MemberAnnouncement[];
}

// ── AI assistant (stub — no LLM wired up, see 0027 migration note) ──

export type AssistantMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };

export async function listAssistantMessages(memberId: string): Promise<AssistantMessage[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("member_assistant_messages")
    .select("id, role, content, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as AssistantMessage[];
}

export async function appendAssistantMessage(
  memberId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("member_assistant_messages").insert({ member_id: memberId, role, content });
  if (error) throw error;
}
