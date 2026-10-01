// Sample data for the partner ("vendor") portal + admin panel prototype, plus
// the partner-facing agreement constants rendered read-only in /vendor/agreement.
// Mirror of memberData.ts but for the partner side and the admin side.
//
// Code identifiers keep the DMN `vendor*` names (they map to the `vendors`
// table); every user-facing string here says "partner" per the ASN canon.
// Agreement copy summarises _asn-source-copy/provider-agreement.html (ASN
// Provider Agreement, DRAFT pending counsel). No em-dashes in member-facing text.

export type VendorPlanId = "founding" | "standard" | "annual";

export type VendorPlan = {
  id: VendorPlanId;
  name: string;
  priceLabel: string;
  cadenceLabel: string;
  blurb: string;
  features: string[];
  highlight: boolean;
  ctaLabel: string;
  badge?: string;
};

// Plan IDs are stable DB identifiers (stored on vendors.plan_id). The
// launch/growth/standard naming is exposed in the UI; "founding" is kept as
// the id for the launch+growth phases since both belong to the founding
// cohort. "annual" stays as the id for the pre-pay variant of standard.
export const vendorPlans: VendorPlan[] = [
  {
    id: "founding",
    name: "Launch",
    priceLabel: "$0",
    cadenceLabel: "for your first 6 months, from the member launch",
    blurb:
      "Your first 6 months are free, starting the day we open to members. After that it's $39 a month for your first 12 months, then $149 a month. Founding badge in the directory.",
    features: [
      "First 6 months: free, from the member launch",
      "Next 12 months: $39/mo launch rate",
      "After that: $149/mo standard rate",
      "Founding Partner badge in the directory",
      "Featured Partner benefits",
      "Verified Partner badge",
      "Refer and earn: $50 per referred member, paid after their first payment",
    ],
    highlight: true,
    ctaLabel: "Apply to the cohort",
    badge: "LIMITED · LAUNCH PROGRAM",
  },
  // The company large rate is admin-set at approval rather than picked at
  // signup and is never shown publicly, so only the launch plan is listed here.
];

// Canonical ASN partner categories (ASN-SWAP-CANON section 4). Shared by the
// partner application form, profile editor, admin dialogs and /partners chips.
export const vendorCategories = [
  "Injectables & pharmaceuticals",
  "Devices & equipment (lasers, energy-based)",
  "Skincare & product lines",
  "Practice-management software",
  "Marketing & growth",
  "Patient financing",
  "Staffing & HR",
  "Coaching & consulting",
  "Continuing education",
  "Accounting & CFO",
  "Other",
] as const;

export type VendorCategory = (typeof vendorCategories)[number];

export type DiscountMechanic = "promo_code" | "affiliate_link" | "portal_redemption" | "manual_verification";

// Sample logged-in partner for the prototype (placeholder company only).
export const vendor = {
  id: "v_001",
  companyName: "Acme Aesthetics Supply",
  displayName: "Acme Aesthetics",
  category: "Devices & equipment (lasers, energy-based)" as VendorCategory,
  website: "https://www.example.com",
  description:
    "Placeholder partner used by the portal prototype. Supplies laser handpieces and consumables to aesthetic practices.",
  contactName: "Taylor Morgan",
  contactEmail: "taylor@example.com",
  contactPhone: "+1 (555) 010-1234",
  billingEmail: "billing@example.com",
  status: "active" as "pending" | "active" | "suspended",
  agreementSignedAt: "2026-07-11",
  agreementVersion: "v1.0",
  planId: "founding" as VendorPlanId,
  monthsInProgram: 2,
  commissionRate: 0,
  payoutMethod: "ACH",
  joinedAt: "2026-07-11",
  avatarInitials: "AA",
  verified: true,
};

export type VendorOfferStatus = "draft" | "pending_review" | "published" | "paused" | "rejected";

export type VendorOfferRow = {
  id: string;
  title: string;
  code: string;
  mechanic: DiscountMechanic;
  discountLabel: string;
  status: VendorOfferStatus;
  redemptions: number;
  savingsDeliveredYtd: number;
  expiresOn: string;
  createdOn: string;
  reviewerNote?: string;
};

export const vendorOwnOffers: VendorOfferRow[] = [
  {
    id: "off_001",
    title: "12% off the LUX laser handpiece",
    code: "ASN-ACME-12",
    mechanic: "promo_code",
    discountLabel: "12% off",
    status: "published",
    redemptions: 0,
    savingsDeliveredYtd: 0,
    expiresOn: "2026-12-31",
    createdOn: "2026-07-11",
  },
  {
    id: "off_002",
    title: "Free first-order setup and training",
    code: "ASN-ACME-SETUP",
    mechanic: "manual_verification",
    discountLabel: "Setup waived",
    status: "pending_review",
    redemptions: 0,
    savingsDeliveredYtd: 0,
    expiresOn: "2026-12-31",
    createdOn: "2026-07-11",
    reviewerNote: "Awaiting team approval.",
  },
];

// Recent member redemptions (partner-side view, anonymized to first name + city)
export type RedemptionRow = {
  id: string;
  offerId: string;
  offerTitle: string;
  memberDisplay: string;
  city: string;
  redeemedOn: string;
  amountSaved: number;
  commissionAccrued: number;
};

export const vendorRedemptions: RedemptionRow[] = [];

// Aggregate KPIs for the partner overview
export const vendorKpis = {
  redemptionsThisMonth: 0,
  redemptionsLifetime: 0,
  savingsDeliveredMonth: 0,
  savingsDeliveredLifetime: 0,
  leadsThisMonth: 0,
  pendingOffersCount: 1,
};

// =====================================================================
// ADMIN PANEL DATA (prototype placeholders; the live console reads the DB)
// =====================================================================

export type AdminMemberRow = {
  id: string;
  name: string;
  email: string;
  practice: string;
  city: string;
  tier: "Founding" | "Pro" | "Premium" | "Free";
  founding: boolean;
  joinedOn: string;
  status: "active" | "trial" | "past_due" | "canceled";
  hotlineCases: number;
  ceCredits: number;
};

export const adminMembers: AdminMemberRow[] = [
  {
    id: "m_001",
    name: "Taylor Morgan",
    email: "taylor@example.com",
    practice: "Example Aesthetics",
    city: "Austin, TX",
    tier: "Founding",
    founding: true,
    joinedOn: "Jul 11, 2026",
    status: "active",
    hotlineCases: 0,
    ceCredits: 0,
  },
];

export type AdminVendorRow = {
  id: string;
  companyName: string;
  category: VendorCategory;
  status: "pending" | "active" | "suspended";
  contactName: string;
  contactEmail: string;
  planId: VendorPlanId;
  redemptionsLifetime: number;
  commissionAccrued: number;
  agreementSignedAt: string | null;
  appliedOn: string;
};

export const adminVendors: AdminVendorRow[] = [
  {
    id: "v_001",
    companyName: "Acme Aesthetics Supply",
    category: "Devices & equipment (lasers, energy-based)",
    status: "active",
    contactName: "Taylor Morgan",
    contactEmail: "taylor@example.com",
    planId: "founding",
    redemptionsLifetime: 0,
    commissionAccrued: 0,
    agreementSignedAt: "2026-07-11",
    appliedOn: "2026-07-09",
  },
  {
    id: "v_002",
    companyName: "Example Skincare Co.",
    category: "Skincare & product lines",
    status: "pending",
    contactName: "Jordan Lee",
    contactEmail: "jordan@example.com",
    planId: "founding",
    redemptionsLifetime: 0,
    commissionAccrued: 0,
    agreementSignedAt: null,
    appliedOn: "2026-07-12",
  },
];

export type AdminPendingOfferRow = {
  id: string;
  vendor: string;
  vendorId: string;
  title: string;
  discountLabel: string;
  category: VendorCategory;
  submittedOn: string;
};

export const adminPendingOffers: AdminPendingOfferRow[] = [
  {
    id: "off_002",
    vendor: "Acme Aesthetics",
    vendorId: "v_001",
    title: "Free first-order setup and training",
    discountLabel: "Setup waived",
    category: "Devices & equipment (lasers, energy-based)",
    submittedOn: "2026-07-11",
  },
];

export type AdminHotlineCase = {
  id: string;
  member: string;
  memberId: string;
  pillar: "Practice Ops" | "HR" | "Marketing" | "Tech" | "M&A" | "Finance";
  urgency: "critical" | "high" | "normal";
  summary: string;
  status: "received" | "triaged" | "matched" | "replied" | "resolved";
  assignedTo?: string;
  expert?: string;
  openedAt: string;
  slaDueIn: string;
};

export const adminHotlineCases: AdminHotlineCase[] = [
  {
    id: "hc_2026_07_12_1",
    member: "Taylor Morgan",
    memberId: "m_001",
    pillar: "Finance",
    urgency: "normal",
    summary: "Injectables pricing and margin review for a two-room med spa",
    status: "received",
    openedAt: "2 hrs ago",
    slaDueIn: "Written reply due in 2 to 3 business days",
  },
];

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "lester" | "reshani" | "rushda" | "chamika" | "va";
  workstream: string;
  status: "active";
  lastActive: string;
};

// Placeholder rows only. Real admin identities live in admin_users (see
// supabase/seed.local.example.sql); nothing here is used for access control.
export const adminUsers: AdminUser[] = [
  { id: "ad_owner", name: "Owner", email: "owner@example.com", role: "lester", workstream: "Hotline · Resources · Directory · Pricing · Legal", status: "active", lastActive: "Active now" },
  { id: "ad_admin", name: "Admin", email: "admin@example.com", role: "rushda", workstream: "Tech Build", status: "active", lastActive: "Active now" },
];

export const adminKpis = {
  membersTotal: 0,
  membersFoundingCap: 100,
  membersThisWeek: 0,
  vendorsActive: 0,
  vendorsPending: 0,
  vendorsTotal: 0,
  hotlineOpenCases: 0,
  hotlineSlaCompliance: 1,
  mrr: 0,
  arr: 0,
  vendorMrr: 0,
  pendingOffers: 0,
  redemptionsThisMonth: 0,
  savingsDeliveredYtd: 0,
};

// =====================================================================
// PROVIDER AGREEMENT (partner view), sectioned for the read-only display.
// Summarises _asn-source-copy/provider-agreement.html. The full text lives at
// /agreement/provider and /agreements/asn-provider-agreement.pdf.
// =====================================================================

export type AgreementSection = {
  id: string;
  number: string;
  title: string;
  body: string;
};

export const vendorAgreementMeta = {
  title: "Provider Agreement (Experts and Partners)",
  version: "v1.0",
  effective: "Effective on the date of sign-up",
  tagline: "Built around five simple commitments.",
  intro:
    "This Provider Agreement is between Aesthetic Success Network, operated by Ekwa Marketing Inc. (\"ASN\", \"we\", \"us\") and the provider who signs up (\"you\"). Expert and Partner are capabilities on one provider account; a provider can hold both. It takes effect when you sign up as a provider. By joining the network as a partner, you agree to five commitments, outlined below, plus the operational and legal terms that follow. The structure is intentionally short. We'd rather have a clear handshake than a 40-page document nobody reads. Draft for review: this document has not yet been reviewed by legal counsel, and governing law will be confirmed at legal review.",
};

export type VendorCommitment = {
  number: string;
  title: string;
  body: string;
};

// The five partner commitments, the headline framing of the agreement.
export const vendorCommitments: VendorCommitment[] = [
  {
    number: "01",
    title: "Offer our members the best deal you have.",
    body:
      "You agree to give ASN members an exclusive discount or benefit that is at least as good as any offer you make available to comparable customers. Improvements are welcome anytime; reductions require our written approval and notice to members. We promote this deal, so it has to be real.",
  },
  {
    number: "02",
    title: "Stay reachable.",
    body:
      "Maintain a responsive presence and respond to member leads within one business day.",
  },
  {
    number: "03",
    title: "Provide a booking link.",
    body:
      "Supply and maintain a working booking link (for example Calendly or Cal.com) where members can book a call with you directly. We feature it on your profile.",
  },
  {
    number: "04",
    title: "Evolve with the network.",
    body:
      "The network is new. Accept term changes made with 30 days' advance notice. If a change materially reduces your benefits or increases your fees, you may terminate within the notice window with no further obligation.",
  },
  {
    number: "05",
    title: "Pay the fee.",
    body:
      "Your first 6 months are free, starting the day we open to members. After that it's $39 a month for your first 12 months, then $149 a month. Cancel any time before your first charge and you won't be charged; after that, cancel with 30 days' written notice. Annual prepay earns two months free.",
  },
];

// The fee schedule presented as a flat table (Schedule A).
export type FeeScheduleRow = {
  period: string;
  fee: string;
  note: string;
};

export const vendorFeeSchedule: FeeScheduleRow[] = [
  { period: "Free founding months", fee: "$0", note: "First 6 months, from the member launch" },
  { period: "Next 12 months", fee: "$39", note: "Launch rate" },
  { period: "After that", fee: "$149", note: "Standard company rate" },
];

// Headline numbers shown above the agreement (the "key terms band").
// 12-month initial term and 30 days' notice come from provider agreement section 08.
export const vendorAgreementKeyTerms = [
  { label: "Free months", value: "$0", sub: "from launch" },
  { label: "Next 12 months", value: "$39", sub: "launch rate" },
  { label: "After that", value: "$149", sub: "per month" },
  { label: "Commitment", value: "12 mo", sub: "Initial term" },
  { label: "Cancel", value: "30 d", sub: "Written notice" },
];

// The operational/legal sections that follow the five commitments.
export const vendorAgreementSections: AgreementSection[] = [
  {
    id: "whats-included",
    number: "01",
    title: "What partners receive",
    body:
      "A vetted partner profile with your logo and your member-exclusive offer, placed in your category. Pre-qualified lead routing with a dashboard and conversion data. The Verified Partner badge for your marketing (the license to use it ends when this agreement ends). Podcast, webinar, and co-marketing features across the Business of Aesthetics network.",
  },
  {
    id: "expert-terms",
    number: "02",
    title: "Expert terms (if you also hold the expert capability)",
    body:
      "Experts share one recording (up to about one hour) of themselves teaching a topic, plus supporting details. We produce the content kit (training video, action guide, checklist, key takeaways, worksheet, slide deck, wall poster, and extras), and you approve it before it goes live under your profile. You keep ownership of your content and grant ASN a license to produce, host, and distribute the kits to members. Expert access pricing is the same as for partners: the first 6 months free from the member launch, then $39 a month with no increase. Paid courses and products: you sell them on your own site and keep the full price; the one condition is a member-only offer on each. Hotline referrals are routed by fit, never by payment.",
  },
  {
    id: "fees-and-payment",
    number: "03",
    title: "Fees and payment",
    body:
      "Invoices are due net 15. Fees are non-refundable except as stated in the Refund & Cancellation Policy. Late amounts may accrue up to 1.5% per month. Annual prepay earns two months free.",
  },
  {
    id: "standards",
    number: "04",
    title: "Provider standards",
    body:
      "You confirm that you comply with applicable laws and professional standards, that you have the rights to any content and marks you provide, that you will support members responsively, and that you will avoid conduct that damages the network's brand or its members' trust.",
  },
  {
    id: "confidentiality",
    number: "05",
    title: "Confidentiality and member data",
    body:
      "Both parties protect the other's non-public information with reasonable care. Member contact details routed to you may be used only to respond to and service that lead. Selling member data or using it for unrelated marketing is prohibited, during and after the term.",
  },
  {
    id: "changes",
    number: "06",
    title: "Changes to terms",
    body:
      "We may modify these terms with at least thirty (30) days' prior written notice. If a change materially reduces your benefits or increases your fees, you may terminate within the notice window with no further obligation.",
  },
  {
    id: "term",
    number: "07",
    title: "Term, renewal, and termination",
    body:
      "The initial term is 12 months from signup, renewing automatically for successive 12-month terms unless either party gives 30 days' non-renewal notice. Either party may terminate for convenience with 30 days' written notice. Either party may terminate immediately for a material breach that remains uncured 15 days after written notice, for insolvency, or for conduct that materially harms the network. On termination: the profile is removed, the badge license ends, and unpaid fees become due. Expert kits are unpublished from the member library; purchasers of paid courses retain the access you sold them on your own site.",
  },
  {
    id: "disclaimers",
    number: "08",
    title: "Disclaimers and liability",
    body:
      "We do not guarantee any specific number of leads, conversion rate, or revenue outcome. Neither party is liable for indirect or consequential damages or lost profits. Our cumulative liability is capped at the total fees you paid in the preceding 12 months. You indemnify ASN against third-party claims arising from your products, services, sales practices, or breach of this agreement.",
  },
  {
    id: "miscellaneous",
    number: "09",
    title: "Miscellaneous",
    body:
      "The parties are independent contractors. No assignment without consent. This is the entire agreement; changes happen per Section 06 or by signed amendment. Electronic signatures are effective. Governing law: to be confirmed at legal review.",
  },
];
