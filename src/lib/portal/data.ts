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
