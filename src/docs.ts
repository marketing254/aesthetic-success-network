// Vendor, agreement, and legal content for Aesthetics Success Network.
// Ported from the Dental Member Network sources; dental terminology swapped
// for aesthetics, "Thriving Dentist"/"DMN" → "Aesthetics Success Network"/"ASN".

export type DocSection = {
  number: string;
  title: string;
  body: string;
  items?: string[];
};

export type KeyTerm = { label: string; value: string; sub: string };

export type DocPageData = {
  badge: string;
  title: string;
  tagline: string;
  effectiveDate: string;
  lastUpdated: string;
  intro: string;
  keyTerms: KeyTerm[];
  sections: DocSection[];
  footnote: string;
};

// ── Partners / vendor landing band ──────────────────────────────────
export const partnersSection = {
  eyebrow: "For vendor partners",
  title: "Get in front of providers who are actively buying.",
  subtitle:
    "Suppliers, device makers, software, and services apply to be featured to our member network. Preferred placement, warm introductions, and a simple agreement built around five commitments — not a 40-page contract nobody reads.",
  ctaLabel: "Apply as a vendor partner",
  ctaHref: "/vendor/signup",
  secondaryLabel: "Read the partnership agreement",
  secondaryHref: "/agreement/vendor",
};

// ── Vendor data ─────────────────────────────────────────────────────
export type VendorPlanId = "founding" | "standard" | "annual";

export const vendorCategories = [
  "Injectables & pharmaceuticals (tox, fillers)",
  "Skincare & cosmeceuticals",
  "Devices & lasers (capital equipment)",
  "Practice management software / EMR",
  "Billing, payments & financing",
  "HR, payroll & compliance",
  "Patient financing & lending",
  "Phone, call tracking & AI receptionists",
  "Coaching & consulting",
  "Continuing education & training",
  "Accounting, tax & CFO services",
  "Marketing & digital services",
  "Other",
] as const;

export const vendorPlans = [
  {
    id: "founding" as VendorPlanId,
    name: "Founding Partner",
    priceLabel: "$0",
    cadenceLabel: "for 6 months · then $49/mo for months 7–12",
    blurb:
      "Limited to a fixed number of vendors per category. Six months free, six months at $49, then standard $199. Founding badge in the directory launch announcement.",
    badge: "LIMITED · LAUNCH PROGRAM",
  },
  {
    id: "standard" as VendorPlanId,
    name: "Featured Partner",
    priceLabel: "$199",
    cadenceLabel: "/month, billed monthly",
    blurb:
      "Full Featured Partner tier with enhanced directory listing, priority category placement, quarterly newsletter mentions, a dedicated email, and lead dashboard access.",
    badge: "",
  },
  {
    id: "annual" as VendorPlanId,
    name: "Annual Pre-Pay",
    priceLabel: "$1,990",
    cadenceLabel: "/year · 12 months for the price of 10",
    blurb:
      "Pre-pay 12 months upfront, get 2 months free (about 17% savings). Same Featured Partner benefits, locked-in for 12 months.",
    badge: "",
  },
];

export const vendorCommitments = [
  {
    number: "01",
    title: "Offer our members the best deal you have.",
    body:
      "You agree to give Aesthetics Success Network members a discount, bonus, or exclusive benefit that is at least as good as any offer you make available to comparable customers. If your terms get better elsewhere, ours match or improve. We promote this deal — it has to be real.",
  },
  {
    number: "02",
    title: "Join our private partner hotline.",
    body:
      "We host a private hotline that connects our members with vendors in the network. We keep one team member responsive there during business hours, and use it for fast coordination between members and vendors.",
  },
  {
    number: "03",
    title: "Provide a calendar link.",
    body:
      "You give us a working calendar booking link (Calendly, HubSpot, Cal.com, anything) where members can book a call with you directly. We feature it on your profile. Keep it live, keep availability open, and respond to bookings within one business day.",
  },
  {
    number: "04",
    title: "Accept that we will evolve the network.",
    body:
      "The network is new. We reserve the right to update the terms, benefits, fees, and operating rules from time to time on at least thirty (30) days' written notice. If a change materially reduces your benefits, you can terminate before it takes effect with no penalty.",
  },
  {
    number: "05",
    title: "Pay the fee — waived for your first six months.",
    body:
      "The standard fee is $199 per month. Founding partners pay $0 for months 1–6, $49 for months 7–12, and the standard $199 from month thirteen onward. You are free to cancel with 30 days' written notice at any time.",
  },
];

export const vendorFeeSchedule = [
  { period: "Months 1–6", fee: "$0", note: "Founding partner waiver — applies automatically" },
  { period: "Months 7–12", fee: "$49", note: "Locked-in launch rate" },
  { period: "Month 13 onward", fee: "$199", note: "Standard partner rate" },
];

const vendorKeyTerms: KeyTerm[] = [
  { label: "Months 1–6", value: "$0", sub: "Waived" },
  { label: "Months 7–12", value: "$49", sub: "per month" },
  { label: "Month 13+", value: "$199", sub: "per month" },
  { label: "Commitment", value: "12 mo", sub: "Initial term" },
  { label: "Cancel", value: "30 d", sub: "Written notice" },
];

export const vendorAgreement: DocPageData = {
  badge: "Vendor partnership agreement",
  title: "Vendor Network Partnership Agreement",
  tagline: "Built around five simple commitments.",
  effectiveDate: "On sign-up",
  lastUpdated: "v1.0 · active draft",
  intro:
    "This Vendor Network Partnership Agreement (the “Agreement”) is between Aesthetics Success Network (“we,” “us”) and the Vendor who signs up (“you,” “Vendor”). It takes effect on the date of signup. By joining the network, you agree to five commitments, plus the operational and legal terms that follow. The structure is intentionally short — we would rather have a clear handshake than a 40-page document nobody reads.",
  keyTerms: vendorKeyTerms,
  sections: [
    {
      number: "01",
      title: "What's included",
      body:
        "Profile in the directory: we create and maintain a dedicated profile page for you in the Aesthetics Success Network Vendor Directory — logo, description, services, contact form, member-exclusive offer, and your calendar link. Promotion to members: priority category placement, quarterly newsletter mentions, one dedicated email to members per year, and eligibility for podcast and webinar features at our editorial discretion. Lead routing: inquiries from members are routed directly to you. Verified Partner badge: an “Aesthetics Success Network Verified Partner” mark you can use while this Agreement is active.",
    },
    {
      number: "02",
      title: "Fees and payment",
      body:
        "Fees are billed in advance and due Net 15 from invoice date. Payments more than 30 days past due may accrue late charges at 1.5% per month or the maximum rate permitted by law, whichever is lower. Fees are exclusive of applicable taxes. Annual pre-pay option: commit to twelve months at the standard rate up front and get two months free. Except as expressly stated, fees are non-refundable; if you cancel mid-period, you remain responsible for fees through the end of the current billing period.",
    },
    {
      number: "03",
      title: "Member discount details",
      body:
        "The member discount you commit to in the signup form is binding for the term of this Agreement. You can improve it any time — you just cannot reduce or withdraw it without our written consent. Acceptable formats include a percentage off standard pricing (typically 3–20%), a flat-dollar discount, a waived setup or onboarding fee, bonus inclusions, or preferred payment terms. You honor the discount when a member identifies themselves, books through your network calendar link, or is referred via lead routing.",
    },
    {
      number: "04",
      title: "Standards we hold partners to",
      body:
        "While in the network, you confirm that: you operate in compliance with all applicable laws, regulations, and professional standards; you provide responsive, professional support to members at least at the quality level you give your best customers; you have the rights to all logos, copy, and content you give us, and grant us a non-exclusive license to use them to promote you; and you will not engage in conduct that damages the brand, including misleading advertising or harassment of members.",
    },
    {
      number: "05",
      title: "Confidentiality and member data",
      body:
        "Both parties may receive non-public information from the other. Each agrees to use it only for purposes of this Agreement and protect it with at least reasonable care. Member contact information shared with you in connection with leads may only be used to respond to and service that lead. You will not sell, transfer, or use member data for unrelated marketing, and will comply with all applicable data-protection laws. This survives termination.",
    },
    {
      number: "06",
      title: "Changes to terms",
      body:
        "We may modify these terms — including pricing, benefits, eligibility, and operating rules — from time to time, with at least thirty (30) days' prior written notice by email and via the partner dashboard. If a change materially reduces your benefits or increases your fees, you may terminate before the change takes effect with no further obligation, provided you give written notice within the 30-day window. Continued participation after the effective date constitutes acceptance.",
    },
    {
      number: "07",
      title: "Term, renewal, and termination",
      body:
        "This Agreement starts on the date you sign up and continues for an initial term of twelve (12) months, then renews automatically for successive twelve-month terms unless either party gives written notice of non-renewal at least 30 days before the end of the current term. Either party may terminate for convenience on 30 days' prior written notice; you remain responsible for fees accrued through the effective date. We may terminate immediately for uncured material breach (15-day cure period), insolvency, or conduct that materially harms the network.",
    },
    {
      number: "08",
      title: "Disclaimers and liability",
      body:
        "We do not guarantee any specific number of leads, conversion rate, or revenue outcome from network participation. Except as expressly stated, the network is provided “as is.” Neither party is liable for indirect, incidental, special, or consequential damages, or for lost profits. Total cumulative liability of either party is capped at the total fees paid by Vendor in the twelve months immediately preceding the event giving rise to liability. Vendor will indemnify us from third-party claims arising out of Vendor's products, services, sales practices, or content.",
    },
    {
      number: "09",
      title: "Miscellaneous",
      body:
        "The parties are independent contractors; this Agreement does not create a partnership, joint venture, agency, or employment relationship. You may not assign or transfer it without our prior written consent. This is the entire agreement on its subject and supersedes prior discussions. If any provision is unenforceable, the rest stays in effect. Electronic signatures and acceptance via the online form have the same effect as original written signatures.",
    },
  ],
  footnote:
    "Questions before you apply? Email partnerships@aestheticssuccessnetwork.com — we read and respond to every message within one business day.",
};

// ── Member agreement ────────────────────────────────────────────────
export const memberAgreement: DocPageData = {
  badge: "Member agreement",
  title: "Member Agreement",
  tagline: "The terms that protect you, your practice, and the network.",
  effectiveDate: "On member registration",
  lastUpdated: "Active draft",
  intro:
    "This Member Agreement is entered into between Aesthetics Success Network (ASN) and you (“Member”) upon registration. Read it before joining — everything below is what we hold ourselves to and what we ask of you.",
  keyTerms: [
    { label: "Founding rate", value: "$49/mo", sub: "Never increases while active" },
    { label: "Guarantee", value: "30 days", sub: "Full money-back" },
    { label: "Helpline SLA", value: "3 days", sub: "Written follow-up plan" },
    { label: "Cancel", value: "Anytime", sub: "From your portal" },
    { label: "Patient data", value: "Never", sub: "We don't store PHI" },
  ],
  sections: [
    {
      number: "01",
      title: "Membership Benefits",
      body: "As a member you receive:",
      items: [
        "24/7 expert helpline with business coaches and practice advisors.",
        "Exclusive partner discounts with negotiated vendor savings.",
        "Exclusive content library with recorded expert panels and training resources.",
        "Member directory with 500+ practice owners searchable by city, specialty, and revenue.",
        "Proven systems with templates, checklists, and SOPs.",
        "Monthly live AMAs with specialists.",
        "Content and features may be modified at our discretion with reasonable notice.",
      ],
    },
    {
      number: "02",
      title: "Account Access and Sharing",
      body:
        "Your membership is registered to you and your practice. You may share credentials with staff within your registered practice. Credentials may not be shared outside your practice. We may monitor usage patterns and contact you about inappropriate sharing.",
    },
    {
      number: "03",
      title: "Auto-Renewal",
      body:
        "All memberships auto-renew unless cancelled before renewal. Founding member pricing ($49/month or $490/year) never increases while your membership remains continuously active. If your membership lapses, founding pricing is no longer available. A reminder is sent before annual renewals.",
    },
    {
      number: "04",
      title: "Helpline Usage",
      body:
        "The helpline provides business guidance — not legal, financial, or clinical advice. Each case receives a written summary and follow-up plan within 3 business days. Helpline interactions are confidential between you and the assigned advisor. You may not record helpline calls without consent.",
    },
    {
      number: "05",
      title: "Content Usage Rights",
      body: "You may:",
      items: [
        "Stream content for professional development.",
        "Download and use templates within your practice.",
        "Share insights with your team.",
        "You may not record or screen-capture content.",
        "You may not redistribute or resell content.",
        "You may not use content to create competing products.",
        "You may not upload content to other platforms.",
      ],
    },
    {
      number: "06",
      title: "Vendor Deals and Savings",
      body:
        "Vendor deals are negotiated on behalf of the member network. Savings estimates are averages and individual results may vary. Vendor relationships and terms may change. ASN is not a party to transactions between members and vendors.",
    },
    {
      number: "07",
      title: "Member Conduct",
      body: "Use the platform professionally. Violations may result in termination without refund. Do not:",
      items: [
        "Engage in harassment.",
        "Post misleading content.",
        "Use the platform for unrelated purposes.",
        "Attempt to circumvent security.",
      ],
    },
    {
      number: "08",
      title: "Disclaimer",
      body:
        "ASN provides business education and services. Content does not constitute legal, financial, tax, clinical, or insurance advice. You are responsible for how you apply the information. Results are not guaranteed.",
    },
    {
      number: "09",
      title: "Termination",
      body: "We may terminate membership for:",
      items: [
        "Violations of these terms.",
        "Unauthorized content sharing.",
        "Payment failure.",
        "No refund is issued for violation terminations. Access is restored upon payment resolution.",
      ],
    },
    {
      number: "10",
      title: "Contact Information",
      body: "",
      items: ["Email: members@aestheticssuccessnetwork.com", "Phone: available on request"],
    },
  ],
  footnote:
    "Questions before you join? Email members@aestheticssuccessnetwork.com — we read and respond to every message within one business day.",
};

// ── Privacy policy ──────────────────────────────────────────────────
export const privacyPolicy: DocPageData = {
  badge: "Privacy policy",
  title: "Privacy Policy",
  tagline: "Plain English. No PHI. No data resale.",
  effectiveDate: "On registration",
  lastUpdated: "Active draft",
  intro:
    "ASN respects your privacy and is committed to protecting your personal information. This policy explains what we collect, how we use it, and your rights. Critically: we do not collect, store, or process any patient data — ASN is a business services platform, not a clinical one.",
  keyTerms: [
    { label: "Patient data", value: "Never", sub: "We don't collect PHI" },
    { label: "Resale", value: "Never", sub: "We don't sell data" },
    { label: "Encryption", value: "TLS", sub: "In transit" },
    { label: "Rights", value: "Full", sub: "Access · delete · port" },
    { label: "Response", value: "30 days", sub: "To data requests" },
  ],
  sections: [
    {
      number: "01",
      title: "Information We Collect",
      body: "Information you provide:",
      items: [
        "Account registration (name, email, phone).",
        "Practice information (practice name, address, specialty, locations).",
        "Billing information (processed securely via payment processor — we do not store full card numbers).",
        "Profile information (title, years in practice).",
        "Communications (messages, support inquiries).",
        "Collected automatically: usage data, device information, and cookies for session management and analytics.",
        "We do NOT collect patient health information, PHI, clinical records, or any patient data. HIPAA does not apply to the data we collect.",
      ],
    },
    {
      number: "02",
      title: "How We Use Your Information",
      body: "",
      items: [
        "Provide and improve the ASN platform.",
        "Process payments.",
        "Send membership communications.",
        "Send marketing communications (opt-out available).",
        "Personalize content recommendations.",
        "Analyze usage to improve services.",
        "Respond to support requests.",
        "Comply with legal obligations.",
      ],
    },
    {
      number: "03",
      title: "Information Sharing",
      body: "We do not sell, rent, or trade your personal information. We may share with:",
      items: [
        "Payment processors.",
        "Email service providers.",
        "Analytics providers.",
        "When required by law.",
        "All third-party providers are contractually obligated to protect your information.",
      ],
    },
    {
      number: "04",
      title: "Data Security",
      body: "We implement industry-standard security, including:",
      items: [
        "Encryption in transit (SSL/TLS).",
        "Secure payment processing.",
        "Access controls.",
        "Regular security assessments.",
        "No method is 100% secure, but we treat your data the way we would want ours treated.",
      ],
    },
    {
      number: "05",
      title: "Your Rights",
      body:
        "You have the right to access, correct, or delete your data. You can opt out of marketing communications at any time and request data portability. Contact hello@aestheticssuccessnetwork.com — we respond within 30 days.",
    },
    {
      number: "06",
      title: "Cookies",
      body:
        "Cookies are used for session management, preferences, analytics, and content recommendations. You can manage cookies via your browser settings.",
    },
    {
      number: "07",
      title: "Children's Privacy",
      body:
        "ASN is not for individuals under 18. We do not knowingly collect information from children.",
    },
    {
      number: "08",
      title: "Changes to This Policy",
      body:
        "We may update this policy. Members are notified of material changes via email before they take effect.",
    },
    {
      number: "09",
      title: "Contact Information",
      body: "",
      items: [
        "Email: hello@aestheticssuccessnetwork.com",
        "Privacy officer: available on request",
        "Phone: available on request",
      ],
    },
  ],
  footnote:
    "Questions about your data or a privacy request? Email hello@aestheticssuccessnetwork.com. We respond within 30 days as required by applicable privacy law.",
};

// ── Refund & cancellation ───────────────────────────────────────────
export const refundPolicy: DocPageData = {
  badge: "Refund & cancellation",
  title: "Refund & Cancellation Policy",
  tagline: "No-friction refunds. No retention calls.",
  effectiveDate: "On enrollment",
  lastUpdated: "Active draft",
  intro:
    "How refunds work for members, vendor partners, and expert partners. Plain language, no surprises — read this before joining so you know exactly what you are signing up for.",
  keyTerms: [
    { label: "Money back", value: "30 days", sub: "No questions" },
    { label: "Cancel", value: "Anytime", sub: "From the portal" },
    { label: "Pro-rate", value: "None", sub: "Full period or refund" },
    { label: "Pause", value: "Coming", sub: "Up to 60 days" },
    { label: "Process", value: "5–10 days", sub: "After request" },
  ],
  sections: [
    {
      number: "01",
      title: "30-Day Money-Back Guarantee",
      body:
        "All new members are eligible for a full refund within their first 30 days. The guarantee applies to first enrollment only — not renewals or re-enrollments. Contact refunds@aestheticssuccessnetwork.com with subject “30-Day Refund Request.” Refunds are processed within 5–10 business days.",
    },
    {
      number: "02",
      title: "Cancellation Policy",
      body: "",
      items: [
        "Monthly plans — cancel anytime, effective at the end of the billing period. Access retained until the period ends. No partial-month refunds.",
        "Annual plans — cancel anytime. Within 30 days: full refund. After 30 days: cancellation is effective at the end of the annual period. No pro-rated refunds.",
        "How to cancel — through your member portal settings, or contact support. Cancellations are processed within 1–2 business days.",
      ],
    },
    {
      number: "03",
      title: "Founding Member Pricing",
      body:
        "$49/month or $490/year is the founding rate; it never increases for as long as your membership stays continuously active. If you cancel and later re-enroll, the founding rate is no longer available — the standard rate of $199/month applies. Contact us about a temporary pause before cancelling.",
    },
    {
      number: "04",
      title: "Payment Failures",
      body: "",
      items: [
        "3 additional retry attempts over 10 days with email notifications.",
        "Account suspended after retries fail (access paused, not cancelled).",
        "30 days to update payment.",
        "After 30 days, the account is auto-cancelled.",
        "Founding members lose founding pricing if cancelled for payment failure.",
      ],
    },
    {
      number: "05",
      title: "Refund Exceptions",
      body: "No refunds are issued for:",
      items: [
        "Termination due to Terms violation.",
        "Members who already received a 30-day refund and re-enrolled.",
        "Requests after the 30-day window for monthly plans.",
        "Partial-period requests outside the guarantee.",
      ],
    },
    {
      number: "06",
      title: "Vendor Partner Cancellation & Refunds",
      body:
        "Founding cohort (months 1–6 free): vendors may cancel during the free period with no charge. No refund applies because no fees were collected.",
      items: [
        "Months 7–12 ($49/month) — cancel anytime with 30 days' written notice, effective at the end of the current billing period. No partial-month refunds.",
        "Month 13+ ($199/month standard) — cancel anytime with 30 days' written notice, effective at the end of the current billing period. No partial-month refunds.",
        "Initial commitment — the vendor partnership has a 12-month initial term. Early termination within the first 12 months may be subject to the remaining balance unless otherwise agreed in writing.",
        "Upon cancellation, the vendor listing is removed within 5 business days. Active member deals are honored through their published end date.",
      ],
    },
    {
      number: "07",
      title: "Expert Partner Cancellation & Refunds",
      body:
        "Free period (first 6 months): experts may cancel during the free period with no charge. No refund applies because no fees were collected.",
      items: [
        "Paid period ($99/month) — cancel anytime with 30 days' written notice, effective at the end of the current billing period. No partial-month refunds.",
        "Course revenue — pending commission payouts for paid courses are processed within 30 days of cancellation. The 4% platform commission applies to course fees collected prior to the cancellation date.",
        "Upon cancellation, the expert profile is removed from the directory and the expert is removed from the helpline bench rotation.",
      ],
    },
    {
      number: "08",
      title: "Membership Pause (Coming Soon)",
      body:
        "We are developing a pause feature for up to 60 days without losing your pricing tier. Contact us directly for temporary pause needs in the meantime.",
    },
    {
      number: "09",
      title: "Contact Information",
      body: "",
      items: [
        "Email: refunds@aestheticssuccessnetwork.com",
        "Phone: available on request",
        "Support hours: Monday–Friday, 9:00 AM – 5:00 PM EST",
      ],
    },
  ],
  footnote:
    "Need a refund or have a question? Email refunds@aestheticssuccessnetwork.com with a subject line that matches your request. We respond within one business day.",
};
