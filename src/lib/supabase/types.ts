/**
 * Supabase Database type definitions.
 *
 * Mirrors the schema defined in supabase/migrations/. Keep this in sync when
 * schema changes. The Database type is consumed by the typed Supabase client
 * (`createClient<Database>(...)`) so that .from('table').select() returns
 * fully-typed rows.
 *
 * Naming convention:
 *   Row    — what a SELECT returns
 *   Insert — what you can pass to .insert()
 *   Update — what you can pass to .update()
 *
 * Columns with defaults (created_at, id, etc.) are optional on Insert.
 */

// =====================================================================
// ENUMS
// =====================================================================

export type VendorStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "suspended"
  | "churned";

export type CatalogItemType = "service" | "product" | "course";

export type ReviewStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_changes";

export type RedemptionStatus = "pending" | "confirmed" | "disputed" | "voided";

export type AdminRole = "owner" | "admin" | "reviewer" | "support";

export type MemberStatus = "waitlist" | "invited" | "active" | "paused" | "churned";

export type WaitlistRole = "member" | "vendor";

export type WaitlistStatus = "new" | "contacted" | "converted" | "declined";

export type ExpertApplicationStatus =
  | "new"
  | "reviewing"
  | "invited"
  | "declined"
  | "onboarded";

export type ExpertStatus =
  | "invited"
  | "active"
  | "suspended"
  | "archived";

export type ExpertResourceStatus =
  | "draft"
  | "pending_review"
  | "needs_changes"
  | "approved"
  | "rejected"
  | "archived";

export type ExpertResourceKind =
  | "sop"
  | "template"
  | "slide_deck"
  | "recording"
  | "pdf"
  | "checklist"
  | "worksheet"
  | "other";

export type ExpertPostStatus = "draft" | "published" | "hidden" | "deleted";

export type NetworkAuthorKind = "expert" | "member" | "partner" | "admin";

export type PostReactionKind = "heart" | "insightful" | "helpful" | "agree";

export type ChatbotMessageRole = "member" | "bot" | "expert";

export type ChatbotConversationStatus =
  | "open"
  | "escalated"
  | "expert_handling"
  | "resolved"
  | "abandoned";

// =====================================================================
// ROW SHAPES
// =====================================================================

export type WaitlistSignupsRow = {
  id: string;
  role: WaitlistRole;
  email: string;
  full_name: string;
  // ASN form fields (0069)
  first_name: string | null;
  last_name: string | null;
  practice_role: string | null;
  locations: string | null;
  challenge: string | null;
  agreement_accepted: boolean;
  agreement_accepted_at: string | null;
  practice_name: string | null;
  phone: string | null;
  city_state: string | null;
  message: string | null;
  source: string | null;
  utm: Record<string, unknown> | null;
  status: WaitlistStatus;
  ip_hash: string | null;
  user_agent: string | null;
  sms_consent_at: string | null;
  sms_consent_text: string | null;
  created_at: string;
  contacted_at: string | null;
  notes: string | null;
};

export type VendorApplicationsRow = {
  id: string;
  company_name: string;
  // ASN form field (0069)
  contact_role: string | null;
  category: string | null;
  website: string | null;
  description: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  secondary_email: string | null;
  secondary_phone: string | null;
  signature_name: string | null;
  signature_title: string | null;
  agreement_version: string | null;
  agreed_to_terms: boolean;
  confirmed_authority: boolean;
  // Added in 0038_application_extra_fields.sql.
  member_offer: string | null;
  also_expert: boolean;
  plan_id: string | null;
  source: string | null;
  hotline_email: string | null;
  calendar_link: string | null;
  status: VendorStatus;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  vendor_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  sms_consent_at: string | null;
  sms_consent_text: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorsRow = {
  id: string;
  auth_user_id: string | null;
  company_name: string;
  display_name: string;
  category: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  billing_email: string | null;
  hotline_email: string | null;
  calendar_link: string | null;
  plan_id: string | null;
  months_in_program: number;
  status: VendorStatus;
  verified: boolean;
  agreement_signed_at: string | null;
  agreement_version: string | null;
  sms_consent_at: string | null;
  sms_consent_text: string | null;
  // Added in 0030_profile_avatars.sql.
  avatar_url: string | null;
  // Added in 0033_vendor_expert_billing.sql.
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  subscription_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
  founding_partner_locked: boolean;
  // Added in 0070_vendor_billing_plan.sql. Which price ramp the company
  // portal shows: website (default), founding_ladder, founding_flat.
  billing_plan: "website" | "founding_ladder" | "founding_flat";
  // Added in 0039_vendor_billing_parent.sql — when set, this company's
  // billing + access inherit the referenced (paying) partner vendor.
  billing_parent_id: string | null;
  // Added in 0034_agreement_esign.sql.
  agreement_ip_hash: string | null;
  agreement_user_agent: string | null;
  agreement_pdf_path: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogItemsRow = {
  id: string;
  vendor_id: string;
  type: CatalogItemType;
  name: string;
  tagline: string | null;
  description: string;
  category: string;
  price_label: string;
  duration_hours: number | null;
  module_count: number | null;
  ce_credits: number | null;
  highlights: string[];
  tags: string[];
  review_status: ReviewStatus;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_for_review_at: string | null;
  approved_at: string | null;
  offer_count: number;
  redemptions_lifetime: number;
  created_at: string;
  updated_at: string;
};

export type CatalogMediaRow = {
  id: string;
  catalog_item_id: string;
  kind: "image" | "video" | "document";
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  duration_label: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  position: number;
  created_at: string;
};

export type OffersRow = {
  id: string;
  vendor_id: string;
  catalog_item_id: string;
  headline: string;
  discount_value: string;
  promo_code: string | null;
  description: string;
  terms: string;
  valid_from: string;
  valid_to: string;
  redemption_limit_per_member: string;
  review_status: ReviewStatus;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_for_review_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OfferMediaRow = {
  id: string;
  offer_id: string;
  kind: "image" | "video";
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  position: number;
  created_at: string;
};

export type MembersRow = {
  id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string | null;
  credential: string | null;
  email: string;
  phone: string | null;
  practice_name: string | null;
  practice_role: string | null;
  city: string | null;
  // Added in 0055 — form answers used for onboarding personalization.
  locations: string | null;
  biggest_challenge: string | null;
  // Added in 0057 — acquisition source from the signup form.
  heard_about: string | null;
  status: MemberStatus;
  tier: string | null;
  joined_at: string | null;
  activated_at: string | null;
  activated_by: string | null;
  welcome_sent_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  subscription_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
  founding_member_locked: boolean;
  early_member_locked: boolean;
  sms_consent_at: string | null;
  sms_consent_text: string | null;
  // Added in 0030_profile_avatars.sql.
  avatar_url: string | null;
  // Added in 0031_referrals.sql — references referral_codes.id, nullable.
  referral_code_id: string | null;
  // Added in 0063_job_applications.sql — 'job_seeker' is a free account
  // created to apply for a job; it must never pass a member-only gate.
  account_type: MemberAccountType;
  job_role_interest: JobRoleValue | null;
  created_at: string;
  updated_at: string;
};

// =====================================================================
// Job board (0061–0064). Enum values mirror src/lib/jobs/constants.ts.
// =====================================================================
export type MemberAccountType = "member" | "job_seeker";
export type JobStatus = "draft" | "pending_review" | "live" | "rejected" | "expired" | "filled";
export type JobRoleValue =
  | "injector_rn_np"
  | "physician_assistant"
  | "aesthetician"
  | "laser_technician"
  | "medical_director"
  | "practice_manager"
  | "patient_coordinator"
  | "front_desk"
  | "marketing_coordinator"
  | "other";
export type JobEmploymentTypeValue = "full_time" | "part_time" | "temporary" | "contract";
export type JobWorkplaceValue = "onsite" | "hybrid" | "remote";
export type JobPayUnitValue = "hour" | "day" | "year";
export type JobPostFormatValue = "detailed" | "banner";
export type JobApplicationStatusValue = "submitted" | "viewed" | "shortlisted" | "not_selected" | "hired";

export type JobPostsRow = {
  id: string;
  member_id: string;
  slug: string;
  practice_name: string;
  role: JobRoleValue;
  role_other: string | null;
  employment_type: JobEmploymentTypeValue;
  location: string;
  workplace: JobWorkplaceValue;
  // Nullable as of 0064 — banner posts may omit pay and description.
  pay_min: number | null;
  pay_max: number | null;
  pay_unit: JobPayUnitValue;
  description: string | null;
  requirements: string | null;
  apply_email: string | null;
  apply_url: string | null;
  start_date: string | null;
  start_flexible: boolean;
  status: JobStatus;
  submitted_at: string | null;
  approved_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  expires_at: string | null;
  expiry_warning_sent_at: string | null;
  renewed_at: string | null;
  renewal_count: number;
  filled_at: string | null;
  promoted_facebook_at: string | null;
  promoted_email_at: string | null;
  view_count: number;
  // Added in 0063.
  post_format: JobPostFormatValue;
  banner_path: string | null;
  banner_alt: string | null;
  application_count: number;
  created_at: string;
  updated_at: string;
};

export type JobPostViewsRow = {
  id: string;
  job_post_id: string;
  viewer_hash: string;
  viewed_on: string;
  referrer_kind: string | null;
  created_at: string;
};

export type JobApplicationsRow = {
  id: string;
  job_post_id: string;
  applicant_member_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  cv_path: string | null;
  cv_filename: string | null;
  cv_size_bytes: number | null;
  status: JobApplicationStatusValue;
  status_changed_at: string | null;
  status_changed_by: string | null;
  delivered_at: string | null;
  delivery_error: string | null;
  copy_to_applicant: boolean;
  created_at: string;
  updated_at: string;
};

export type StripeEventRow = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  member_id: string | null;
  payload: unknown;
  processed_at: string;
};

// Mirrors the `resource_kind` Postgres enum. Keep in sync with the
// migrations that extend it — an unlisted value fails at insert time.
export type ResourceKind =
  | "video_intro"
  | "video_full"
  | "video_explainer"
  | "video_trailer"
  | "audio"
  | "action_guide"
  | "checklist"
  | "key_takeaways"
  | "worksheet"
  | "slide_deck"
  | "email_sequence"
  // Added in 0029_resource_kind_book_club.sql.
  | "book_study_guide"
  | "discussion_questions"
  | "infographic"
  | "infographic_image"
  | "video_short"
  // Added in 0045_resource_kind_spotlight_highlight.sql — landscape 16x9
  // extras from the newer expert kits (NOT the 9x16 shorts rail).
  | "video_spotlight"
  | "video_highlight"
  | "other";

export type ResourceSubmissionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected";

export type ResourcesRow = {
  id: string;
  topic_slug: string;
  topic_title: string;
  topic_summary: string | null;
  category: string | null;
  portal_card_url: string | null;
  resource_card_url: string | null;
  title: string;
  description: string | null;
  kind: ResourceKind;
  storage_path: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  duration_label: string | null;
  position: number;
  is_free: boolean;
  is_published: boolean;
  submission_status: ResourceSubmissionStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  // Added in 0024_resource_inquiries.sql — nullable link back to the
  // expert who authored the underlying material (drives inquiry routing).
  originating_expert_id: string | null;
  // Added in 0025_resource_originating_vendor.sql — same idea for partner
  // (vendor) published resources. Routes inquiries to /vendor/inquiries.
  originating_vendor_id: string | null;
  // Added in 0027_book_club_and_analytics.sql. Distinguishes a standard
  // kit from a Book Club kit (which has its own quotes/chapters payload).
  kit_type: "standard" | "book_club";
  book_club_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

// Added in 0027_book_club_and_analytics.sql. One row per member-view of a
// resource — drives the partner / expert analytics dashboards.
export type ResourceViewsRow = {
  id: string;
  resource_id: string;
  member_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  viewed_at: string;
};

export type MemberResourceProgressRow = {
  member_id: string;
  resource_id: string;
  last_viewed_at: string | null;
  completed_at: string | null;
  watch_seconds: number;
  created_at: string;
  updated_at: string;
};

export type MemberAssistantMessageRow = {
  id: string;
  member_id: string;
  role: "user" | "assistant";
  content: string;
  tokens_input: number | null;
  tokens_output: number | null;
  blocked_reason: string | null;
  created_at: string;
};

export type RedemptionsRow = {
  id: string;
  offer_id: string;
  vendor_id: string;
  member_id: string | null;
  member_display: string | null;
  member_city: string | null;
  amount_saved: number | null;
  commission_accrued: number | null;
  status: RedemptionStatus;
  redeemed_on: string;
  notes: string | null;
  created_at: string;
};

export type AdminUsersRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role: AdminRole;
  active: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewActionsRow = {
  id: string;
  // Extend this union whenever a new target gets audited — AND extend the
  // DB CHECK constraint to match. The column is NOT free-form text: it
  // carries `review_actions_target_type_check`, and an unlisted value is
  // rejected at insert time. (That mismatch silently dropped the entire
  // expert audit trail until 0044 added the two expert targets.)
  target_type:
    | "vendor_application"
    | "catalog_item"
    | "offer"
    | "redemption"
    | "vendor"
    | "member"
    | "expert_application"
    | "expert";
  target_id: string;
  action: string;
  admin_id: string | null;
  note: string | null;
  created_at: string;
};

export type AuthAuditRow = {
  id: string;
  event: string;
  email: string | null;
  user_id: string | null;
  user_type: "vendor" | "member" | "admin" | "expert" | "job_seeker" | null;
  ip_hash: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// Shape after 0068_notifications_reconcile.sql. Row invariants:
//   vendor → vendor_id set;  admin → admin_id (null = every admin);
//   expert → expert_id and/or recipient_auth_user_id;
//   member → member_id and/or recipient_auth_user_id.
// Routes may send recipient_auth_user_id only; a DB trigger fills the FK.
export type NotificationAudience = "vendor" | "admin" | "expert" | "member";
export type NotificationsRow = {
  id: string;
  audience: NotificationAudience;
  vendor_id: string | null;
  admin_id: string | null;
  expert_id: string | null;
  member_id: string | null;
  recipient_auth_user_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type ExpertApplicationsRow = {
  id: string;
  email: string;
  full_name: string;
  // ASN form fields (0069)
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  sample_link: string | null;
  paid_courses: string | null;
  content_ownership_confirmed: boolean;
  phone: string | null;
  company_name: string | null;
  specialty: string;
  topics: string | null;
  website: string | null;
  booking_link: string | null;
  source: string | null;
  utm: Record<string, unknown> | null;
  status: ExpertApplicationStatus;
  ip_hash: string | null;
  user_agent: string | null;
  agreement_accepted: boolean;
  agreement_accepted_at: string | null;
  // Added in 0038_application_extra_fields.sql.
  also_partner: boolean;
  company_offer: string | null;
  considered_founding: boolean;
  sms_consent: boolean;
  sms_consent_text: string | null;
  sms_consent_at: string | null;
  created_at: string;
  contacted_at: string | null;
  notes: string | null;
};

export type ExpertsRow = {
  id: string;
  application_id: string | null;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  display_name: string | null;
  phone: string | null;
  company_name: string | null;
  specialty: string;
  bio: string | null;
  topics: string | null;
  website: string | null;
  booking_link: string | null;
  headshot_url: string | null;
  status: ExpertStatus;
  invited_at: string;
  activated_at: string | null;
  suspended_at: string | null;
  archived_at: string | null;
  invited_by: string | null;
  notes: string | null;
  // Added in 0030_profile_avatars.sql.
  avatar_url: string | null;
  // Added in 0033_vendor_expert_billing.sql.
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  subscription_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
  months_in_program: number;
  founding_expert_locked: boolean;
  // Added in 0042_expert_billing_exempt.sql — billing exemption, a manual
  // admin override only (founding invites do not set it). Expert-side
  // only; their company still bills via `vendors`.
  billing_exempt: boolean;
  billing_exempt_reason: string | null;
  billing_exempt_granted_at: string | null;
  // Added in 0034_agreement_esign.sql.
  agreement_signed_at: string | null;
  agreement_version: string | null;
  agreement_ip_hash: string | null;
  agreement_user_agent: string | null;
  agreement_pdf_path: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpertResourcesRow = {
  id: string;
  expert_id: string;
  title: string;
  description: string | null;
  kind: ExpertResourceKind;
  storage_bucket: string;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  branded_storage_path: string | null;
  published_url: string | null;
  status: ExpertResourceStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpertPostsRow = {
  id: string;
  // Exactly one of expert_id / vendor_id is set (0047 added partner authors).
  expert_id: string | null;
  vendor_id: string | null;
  content: string;
  image_url: string | null;
  link_url: string | null;
  status: ExpertPostStatus;
  published_at: string | null;
  hidden_at: string | null;
  hidden_by: string | null;
  hidden_reason: string | null;
  reaction_count: number;
  comment_count: number;
  // Added in 0028_admin_authored_posts.sql. Set when an admin used the
  // /admin/broadcast composer to post on behalf of the expert. Null for
  // self-authored posts.
  composed_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SpotlightKind = "update" | "event" | "news" | "feature";

// Added in 0047_profile_spotlights.sql. Admin-authored "What's New" items
// shown on an expert/partner profile in the member portal. Exactly one of
// expert_id / vendor_id is set.
export type ProfileSpotlightsRow = {
  id: string;
  expert_id: string | null;
  vendor_id: string | null;
  kind: SpotlightKind;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
  event_date: string | null;
  is_published: boolean;
  posted_to_feed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type InviteLinkStatus = "active" | "viewed" | "accepted" | "revoked";

export type InviteLinksRow = {
  id: string;
  code: string;
  kind: "expert" | "partner";
  full_name: string;
  email: string | null;
  company_name: string | null;
  notes: string | null;
  status: InviteLinkStatus;
  viewed_at: string | null;
  accepted_at: string | null;
  expert_id: string | null;
  vendor_id: string | null;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberInquiryStatus = "pending" | "emailed" | "in_progress" | "resolved" | "closed";

export type MemberInquiriesRow = {
  id: string;
  member_id: string;
  email: string;
  question: string;
  status: MemberInquiryStatus;
  source: string;
  pdf_url: string | null;
  pdf_sent_at: string | null;
  slack_ts: string | null;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  member_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PostReactionsRow = {
  id: string;
  post_id: string;
  author_auth_user_id: string;
  author_kind: NetworkAuthorKind;
  author_display_name: string;
  kind: PostReactionKind;
  created_at: string;
};

export type PostCommentsRow = {
  id: string;
  post_id: string;
  author_auth_user_id: string;
  author_kind: NetworkAuthorKind;
  author_display_name: string;
  author_subtitle: string | null;
  content: string;
  hidden_at: string | null;
  hidden_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatbotConversationsRow = {
  id: string;
  expert_id: string;
  member_auth_user_id: string;
  member_display_name: string;
  status: ChatbotConversationStatus;
  last_message_at: string;
  last_member_message_at: string | null;
  last_bot_message_at: string | null;
  last_expert_message_at: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type ChatbotMessagesRow = {
  id: string;
  conversation_id: string;
  role: ChatbotMessageRole;
  content: string;
  bot_provider: string | null;
  bot_model: string | null;
  bot_latency_ms: number | null;
  bot_token_input: number | null;
  bot_token_output: number | null;
  created_at: string;
};

// Discussion thread under each member-library resource. Schema lives in
// 0024_resource_inquiries.sql.
export type ResourceInquiryStatus = "open" | "answered" | "closed";

export type ResourceInquiriesRow = {
  id: string;
  resource_id: string;
  author_auth_user_id: string;
  author_member_id: string | null;
  author_display_name: string;
  author_subtitle: string | null;
  body: string;
  reply_count: number;
  status: ResourceInquiryStatus;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InquiryReplyKind = "member" | "expert" | "partner" | "admin";

export type ResourceInquiryRepliesRow = {
  id: string;
  inquiry_id: string;
  author_kind: InquiryReplyKind;
  author_auth_user_id: string;
  author_id: string | null;
  author_display_name: string;
  author_subtitle: string | null;
  body: string;
  hidden_at: string | null;
  created_at: string;
};

// Added in 0026_resource_feedback.sql. One row per (member, topic_slug).
export type ResourceFeedbackRow = {
  id: string;
  member_id: string;
  topic_slug: string;
  rating: number;
  comment: string | null;
  progress_pct: number;
  created_at: string;
};

export type EmailEventsRow = {
  id: string;
  template: string;
  recipient: string;
  subject: string | null;
  provider: string | null;
  provider_message_id: string | null;
  status: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// =====================================================================
// INSERT / UPDATE SHAPES
//
// Supabase's typed client expects each table's Insert + Update to be a
// concrete object shape. Using mapped/intersection types here was breaking
// type inference (it'd resolve to `never`). Easiest fix: use Partial<Row>
// for both. We lose compile-time required-field checks but the DB enforces
// them and you get runtime errors — good enough for now.
// =====================================================================

// =====================================================================
// Database type — the shape `createClient<Database>` expects
// =====================================================================

type Table<TRow> = {
  Row: TRow;
  Insert: Partial<TRow>;
  Update: Partial<TRow>;
  Relationships: [];
};

type View<TRow> = {
  Row: TRow;
  Relationships: [];
};

// Added in 0031_referrals.sql. One row per expert / vendor — exactly
// one of expert_id / vendor_id is set per row.
// Added in 0054 — member-signup promo codes (3-month trial at checkout).
export type MemberPromoCodeRow = {
  id: string;
  code: string;
  label: string | null;
  expert_id: string | null;
  vendor_id: string | null;
  active: boolean;
  trial_days: number;
  // Added in 0055 — seats the code covers ("fully claimed" at the cap).
  max_uses: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// Added in 0055 — approval-gated onboarding email drafts.
export type MemberOnboardingEmailRow = {
  id: string;
  member_id: string;
  kind: string;
  challenge: string | null;
  kit_slug: string | null;
  kit_title: string | null;
  match_kind: string | null;
  subject: string;
  html: string;
  status: string;
  approval_token: string | null;
  approved_by: string | null;
  sent_to_member_at: string | null;
  created_at: string;
};

export type MemberPromoRedemptionRow = {
  id: string;
  promo_code_id: string;
  member_id: string;
  created_at: string;
};

export type ReferralCodesRow = {
  id: string;
  expert_id: string | null;
  vendor_id: string | null;
  code: string;
  // Added in 0046 — vanity handle for aestheticsuccessnetwork.com/<slug>.
  slug: string | null;
  active: boolean;
  created_at: string;
};

// Added in 0031_referrals.sql. One row per (code, member) — converted_at
// stamped by the Stripe webhook when subscription flips to active.
export type ReferralSignupsRow = {
  id: string;
  code_id: string;
  member_id: string;
  converted_at: string | null;
  // Added in 0046 — admin-only revenue attribution (what this member has
  // actually paid ASN, summed from invoice.paid). 0 during the free trial.
  revenue_cents: number;
  currency: string | null;
  last_payment_at: string | null;
  created_at: string;
};

// Added in 0032_lead_magnets.sql. One row per email captured by a free
// download form (PPO Fees kit etc.). contacted_at flipped by admin UI.
export type LeadMagnetLeadsRow = {
  id: string;
  magnet_slug: string;
  email: string;
  full_name: string | null;
  source: string | null;
  utm: Record<string, unknown> | null;
  ip_hash: string | null;
  user_agent: string | null;
  contacted_at: string | null;
  created_at: string;
};

export type FoundingInviteStatus = "draft" | "sent" | "viewed" | "accepted" | "revoked";
export type FoundingInviteRole = "expert" | "partner" | "both";
/**
 * Price plan chosen per founding invite (0066). Company side: ladder = $39 a
 * month for 12 months then $149; flat_49 = $39 for good. Expert invites are
 * always ladder = 12 months free, then $39.
 */
export type FoundingInvitePricing = "ladder" | "flat_49";

// Added in 0041_founding_invite_companies.sql. One entry per company on a
// founding invite; [0] is the principal (paying) company, the rest become
// covered listings at acceptance. Itemized in the agreement PDF.
export type FoundingInviteCompany = {
  name: string;
  category?: string | null;
  website?: string | null;
  description?: string | null;
  member_offer?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  calendar_link?: string | null;
};

export type FoundingInvitesRow = {
  id: string;
  code: string;
  role: FoundingInviteRole;
  pricing_plan: FoundingInvitePricing;
  full_name: string;
  email: string;
  company_name: string | null;
  member_offer: string | null;
  phone: string | null;
  notes: string | null;
  // Added in 0041_founding_invite_companies.sql — multi-company support.
  companies: FoundingInviteCompany[] | null;
  // Added in 0037_founding_invites_draft.sql — full intake detail.
  website: string | null;
  category: string | null;
  calendar_link: string | null;
  description: string | null;
  secondary_email: string | null;
  secondary_phone: string | null;
  signer_name: string | null;
  signer_title: string | null;
  agreement_version: string;
  agreement_pdf_path: string | null;
  status: FoundingInviteStatus;
  viewed_at: string | null;
  accepted_at: string | null;
  accepted_ip_hash: string | null;
  accepted_user_agent: string | null;
  expires_at: string;
  expert_id: string | null;
  vendor_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// Added in 0065_event_registrations.sql (ASN edit: rida_member_interest was
// renamed event_member_interest; event ids follow "asn-summit-<date>").
// Service-role only — no client role can read or write this table.
export type EventRegistrationStatus =
  | "pending_payment"
  | "entitled"
  | "zoom_requested"
  | "zoom_registered"
  | "zoom_failed";
export type EventRegistrationsRow = {
  id: string;
  event_id: string;
  member_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  practice_website_name: string | null;
  country: string | null;
  speaker_question: string | null;
  event_member_interest: string | null;
  utm: Record<string, unknown>;
  landing_url: string | null;
  status: EventRegistrationStatus;
  entitled_via: "trial_checkout" | "existing_member" | null;
  stripe_session_id: string | null;
  stripe_subscription_id: string | null;
  entitled_at: string | null;
  zoom_webinar_id: string | null;
  zoom_registrant_id: string | null;
  zoom_join_url: string | null;
  zoom_requested_at: string | null;
  zoom_registered_at: string | null;
  zoom_attempts: number;
  zoom_error: string | null;
  confirmation_sent_at: string | null;
  sheet_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

// Added in 0067_asn_security_hardening.sql. Fixed-window counters behind
// the check_rate_limit() RPC. Service-role only.
export type RateLimitsRow = {
  key: string;
  count: number;
  window_start: string;
};

export type Database = {
  public: {
    Tables: {
      waitlist_signups: Table<WaitlistSignupsRow>;
      vendor_applications: Table<VendorApplicationsRow>;
      vendors: Table<VendorsRow>;
      catalog_items: Table<CatalogItemsRow>;
      catalog_media: Table<CatalogMediaRow>;
      offers: Table<OffersRow>;
      offer_media: Table<OfferMediaRow>;
      members: Table<MembersRow>;
      job_posts: Table<JobPostsRow>;
      job_post_views: Table<JobPostViewsRow>;
      job_applications: Table<JobApplicationsRow>;
      redemptions: Table<RedemptionsRow>;
      admin_users: Table<AdminUsersRow>;
      review_actions: Table<ReviewActionsRow>;
      auth_audit: Table<AuthAuditRow>;
      email_events: Table<EmailEventsRow>;
      notifications: Table<NotificationsRow>;
      resources: Table<ResourcesRow>;
      member_resource_progress: Table<MemberResourceProgressRow>;
      member_assistant_messages: Table<MemberAssistantMessageRow>;
      stripe_events: Table<StripeEventRow>;
      expert_applications: Table<ExpertApplicationsRow>;
      experts: Table<ExpertsRow>;
      expert_resources: Table<ExpertResourcesRow>;
      expert_posts: Table<ExpertPostsRow>;
      profile_spotlights: Table<ProfileSpotlightsRow>;
      member_inquiries: Table<MemberInquiriesRow>;
      invite_links: Table<InviteLinksRow>;
      post_reactions: Table<PostReactionsRow>;
      post_comments: Table<PostCommentsRow>;
      chatbot_conversations: Table<ChatbotConversationsRow>;
      chatbot_messages: Table<ChatbotMessagesRow>;
      resource_inquiries: Table<ResourceInquiriesRow>;
      resource_inquiry_replies: Table<ResourceInquiryRepliesRow>;
      resource_feedback: Table<ResourceFeedbackRow>;
      resource_views: Table<ResourceViewsRow>;
      member_onboarding_emails: Table<MemberOnboardingEmailRow>;
      member_promo_codes: Table<MemberPromoCodeRow>;
      member_promo_redemptions: Table<MemberPromoRedemptionRow>;
      referral_codes: Table<ReferralCodesRow>;
      referral_signups: Table<ReferralSignupsRow>;
      lead_magnet_leads: Table<LeadMagnetLeadsRow>;
      founding_invites: Table<FoundingInvitesRow>;
      event_registrations: Table<EventRegistrationsRow>;
      rate_limits: Table<RateLimitsRow>;
    };
    Views: {
      kit_access_counts: View<{
        slug: string;
        views: number;
      }>;
      waitlist_counts: View<{
        total: number;
        members: number;
        vendors: number;
        last_24h: number;
      }>;
      waitlist_signups_recent: View<
        Pick<
          WaitlistSignupsRow,
          | "id"
          | "role"
          | "email"
          | "full_name"
          | "practice_name"
          | "phone"
          | "city_state"
          | "message"
          | "source"
          | "status"
          | "created_at"
        >
      >;
      expert_applications_recent: View<
        Pick<
          ExpertApplicationsRow,
          | "id"
          | "email"
          | "full_name"
          | "phone"
          | "company_name"
          | "specialty"
          | "topics"
          | "website"
          | "booking_link"
          | "source"
          | "status"
          | "created_at"
          | "contacted_at"
        >
      >;
      expert_application_counts: View<{
        total: number;
        new_count: number;
        reviewing_count: number;
        invited_count: number;
        onboarded_count: number;
        last_24h: number;
      }>;
      experts_recent: View<
        Pick<
          ExpertsRow,
          | "id"
          | "email"
          | "full_name"
          | "display_name"
          | "specialty"
          | "status"
          | "invited_at"
          | "activated_at"
          | "application_id"
          | "created_at"
        >
      >;
      expert_counts: View<{
        total: number;
        invited: number;
        active: number;
        suspended: number;
        archived: number;
      }>;
    };
    Functions: {
      // 0067 — distributed rate limiter. Call with the service-role client:
      //   const { data: allowed } = await admin.rpc("check_rate_limit",
      //     { p_key: `purpose:${ip}:${email}`, p_limit: 5, p_window_seconds: 600 });
      // true = allowed, false = over the limit (respond 429, Retry-After =
      // p_window_seconds). Execute is granted to service_role only.
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: {
      vendor_status: VendorStatus;
      catalog_item_type: CatalogItemType;
      review_status: ReviewStatus;
      redemption_status: RedemptionStatus;
      admin_role: AdminRole;
      member_status: MemberStatus;
      waitlist_role: WaitlistRole;
      waitlist_status: WaitlistStatus;
      expert_application_status: ExpertApplicationStatus;
      expert_status: ExpertStatus;
      expert_resource_status: ExpertResourceStatus;
      expert_resource_kind: ExpertResourceKind;
      expert_post_status: ExpertPostStatus;
      network_author_kind: NetworkAuthorKind;
      post_reaction_kind: PostReactionKind;
      chatbot_message_role: ChatbotMessageRole;
      chatbot_conversation_status: ChatbotConversationStatus;
      member_account_type: MemberAccountType;
      job_status: JobStatus;
      job_role: JobRoleValue;
      job_employment_type: JobEmploymentTypeValue;
      job_workplace: JobWorkplaceValue;
      job_pay_unit: JobPayUnitValue;
      job_post_format: JobPostFormatValue;
      job_application_status: JobApplicationStatusValue;
    };
  };
};

// Convenience aliases for the typed clients
export type TableName = keyof Database["public"]["Tables"];
