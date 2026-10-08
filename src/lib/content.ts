// Single source of truth for the Aesthetic Success Network public site copy.
//
// Sources (in priority order):
//   1. ASN-SWAP-CANON.md (repo root): identity, prices, tiers, option lists,
//      hotline SLA, honesty rules. When anything here disagrees with the
//      canon, the canon wins.
//   2. _asn-source-copy/index.html: the approved ASN home-page wording for
//      the hero, "what's inside", the Hotline, pricing, fit check and FAQ.
//   3. The DMN-Replication-Pack (02-public-website.md §2): the export names
//      and shapes below are kept identical to DMN so every consumer keeps
//      compiling. Add exports freely; never rename or reshape one.
//
// Style: no em-dashes in any user-facing string (commas, periods, colons).

export const brand = {
  name: "Aesthetic Success Network",
  shortName: "ASN",
  // Owner-confirmed tracked number for ASN. Every inbound call/SMS is logged
  // with source attribution. Do not replace with an untracked direct number;
  // we lose attribution if we do.
  phoneDisplay: "(855) 567-5323",
  phoneTel: "+18555675323",
  email: "hello@aestheticsuccessnetwork.com",
  domain: "aestheticsuccessnetwork.com",
  joinUrl: "/join",
  signInUrl: "/member/login",
};

export const founding = {
  totalSpots: 100,
  spotsClaimed: 0,
  priceMonthly: 29,
  priceRegular: 99,
  priceAnnual: 290,
  annualNote: "Pay for 10 months, get 12, save $58/year",
};

// HERO
export const hero = {
  topChip: "FOUNDING MEMBERSHIP, FIRST 100 ONLY",
  headline:
    "A network where every practice problem gets a written action plan in 2 to 3 business days.",
  subtitle:
    "Built for aesthetic practice owners who want fast answers, real member-only company deals, and a curated library of expert kits. One membership.",
  bottomNote:
    "The membership is the product. No funnels, no “next step” that costs four figures. Just the value you joined for.",
  // Unsourced counts are not shown. Add a proof point here only with a source.
  proofPoints: [] as { value: string; label: string }[],
  progressLabel: "founding spots claimed",
};

// MARQUEE badges
export const marqueeBadges = [
  "Expert Hotline: reply in 2 to 3 business days",
  "Exclusive Company Deals",
  "Curated Resource Library",
  "Proven Systems & SOPs",
  "Monthly Live AMAs & CE",
  "Founding rate $29/mo, locked while active",
];

// FEATURES: "Why This Network Works"
export const featuresSection = {
  eyebrow: "Why This Network Works",
  title: "The difference is curation, not catalog.",
  titleEmphasis: "curation, not catalog.",
  subtitle:
    "Most directories are crowded with anyone who paid for a listing. The Aesthetic Success Network is curated: every expert and company is vetted by the Business of Aesthetics team, never by an algorithm.",
};

export const features = [
  {
    title: "Vetted Experts",
    summary:
      "Every expert is reviewed before they're listed. Members get coaches and consultants who actually deliver, not just anyone with a website.",
    icon: "star",
  },
  {
    title: "Trusted Companies",
    summary:
      "Companies commit to giving members the best deal they offer anywhere. Discounts are real and clearly stated.",
    icon: "check",
  },
  {
    title: "Curated Content",
    summary:
      "A growing resource library of expert kits, with new kits added weekly, plus member rates on every paid expert course.",
    icon: "target",
  },
  {
    title: "Founding Pricing",
    summary:
      "The first 100 founding members lock in $29/month for as long as their membership stays active. After the founding hundred, the standard rate is $99/month.",
    icon: "infinity",
  },
];

// WAITLIST SECTION
export const waitlist = {
  eyebrow: "JOIN THE WAITLIST",
  headline: "Not ready to join? Get on the list.",
  subtitle:
    "Join the waitlist for early access, founding pricing, and priority access to founding spots before they fill.",
  benefits: [
    "Early access, be the first to know when new features and company deals launch",
    "Founding pricing, waitlist members get first crack at the founding rate",
    "Priority founding access, limited to 100 spots, waitlist members notified first",
    "First notice, new kits, company deals, and live session invitations",
  ],
  submitLabel: "Join the Waitlist",
  submittingLabel: "Saving your spot…",
  footerNote:
    "No spam. Just early access, launch updates, and founding-member opportunities.",
};

// Copy for the WaitlistSection LEFT panel. Members-only by default; the
// vendor (company) and expert variants are shown when the section is
// embedded inline on /companies and /experts respectively.
export const waitlistByRole = {
  member: {
    eyebrow: "FOUNDING MEMBER",
    headline: "Lock in the $29/month founding rate. First 100 only.",
    subtitle:
      "The waitlist is how we onboard the founding cohort before launch. Get a guaranteed spot, the founding rate, and first access to every feature we ship.",
    benefits: [
      "$29/month founding rate, never increases while your membership stays active",
      "Expert Hotline: leave a voicemail, get a written action plan by text and email within 2 to 3 business days",
      "Member-only company deals from vetted vendors, no per-deal commissions",
      "Cancel anytime, in two clicks, from your account page",
    ],
  },
};

// CTA FORM: bottom-of-page founding-team contact form
export const ctaForm = {
  eyebrow: "FOUNDING ACCESS",
  title: "Tell us about your practice.",
  subtitle:
    "Skip the funnel. Tell us what you're working on and we'll match you with the right expert, company deal, or resource. One business day response, from a real person.",
  responseWindowLabel: "Response window",
  responseWindowValue: "Under 1 business day",
  trustNote: "Encrypted in transit. Never shared.",
  rightTitle: "Send us a note",
  rightSubtitle: "Clear form, real human on the other side.",
  reassurances: [
    "We do not store any patient data. Ever.",
    "$29/mo founding rate stays as long as your membership is active.",
    "Cancel anytime, in two clicks, from your account page.",
  ],
};

// FAQ: 9 Q&As, aligned with the approved ASN FAQ in _asn-source-copy/index.html
export const faqSection = {
  eyebrow: "QUESTIONS",
  title: "The honest answers.",
  subtitle: "The questions we get most, answered without sales gloss.",
};

export const faqs = [
  {
    q: "What exactly do I get as a member?",
    a: "Four core things:",
    items: [
      "The Expert Hotline: leave a voicemail with your question, get a written action plan plus the right experts to contact, by text and email, within 2 to 3 business days.",
      "A growing resource library of expert kits, with new kits added weekly: training videos, action guides, checklists, worksheets and slide decks.",
      "Exclusive member-only company deals from vetted vendors across devices, injectables, skincare, software and services.",
      "Monthly live AMAs and CE with the field's best experts.",
    ],
    aClose: "Plus proven systems, SOPs, and templates.",
  },
  {
    q: "Is the Hotline a live, 24/7 helpline?",
    a: "No, and we won't pretend otherwise. It's a voicemail line. You leave your question and our team (AI-assisted) replies by text and email within 2 to 3 business days with a recommended solution plus 3 to 4 experts to contact.",
  },
  {
    q: "How does the founding rate work?",
    a: "The first 100 members lock in $29/month for as long as their membership stays active. After the founding hundred, the standard rate is $99/month. There is also an annual option: $290/year for founding members (pay for 10 months, get 12, save $58). Your locked rate never increases while you're a member. Cancel anytime.",
  },
  {
    q: "How do the company deals save me money?",
    a: "Companies commit to a genuine member-only discount, at least as good as any offer they make comparable customers. We list them with a Verified Company badge, and you deal with them directly. No extra fees, no per-deal commissions. Run the calculator on this page with your own numbers.",
  },
  {
    q: "Is this just a front for a big coaching upsell?",
    a: "No. The membership is the product. There are no four-figure programs behind the door, just the network, the resources, and the deals. The Hotline and company deals deliver value whether you open the resource library or not. This is an operating tool, not a course you have to finish.",
  },
  {
    q: "What if I'm a solo practitioner?",
    a: "Solo practitioners often get the most value. The Hotline replaces the business company or consultant you don't have, the company deals apply regardless of practice size, and the resource library gives you the systems a larger practice would build in-house.",
  },
  {
    q: "Can companies join too?",
    a: "Yes. We have a Company membership for companies that want to be featured in our company directory and put a genuine member-only offer in front of aesthetic practice owners. Companies get category placement, a Verified Company badge, lead flow with a dashboard, and co-marketing opportunities. Apply on the Companies page.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel in two clicks from your account page. No retention call, no hassle, no minimum term. Every membership also comes with a 30-day money-back guarantee. Your founding rate stays locked for as long as your membership is active.",
  },
  {
    q: "Do you store patient data?",
    a: "No. The Aesthetic Success Network is a training, education and business-services platform. We do not collect, store, or process any patient data. Ever.",
  },
];

// FOOTER
export const footer = {
  brandDescription:
    "The Expert Hotline answers every practice problem with a written action plan in 2 to 3 business days. Plus exclusive company deals, a curated resource library, and admin-curated experts and companies.",
  primaryCta: "Claim founding spot",
  secondaryCta: "Email founding team",
  supportLabel: "Support",
  responseLabel: "Response standard",
  responseValue: "Human reply in under 1 business day",
  copyright: "© 2026 Aesthetic Success Network · Powered by Business of Aesthetics",
  dataNote:
    "We do not store patient data. The Aesthetic Success Network is a training, education and business-services platform.",
};

// FOOTER LINKS (canon §6)
export const footerLinks = {
  Network: [
    { label: "What is ASN?", href: "#features" },
    { label: "Experts", href: "/experts" },
    { label: "Companies", href: "/companies" },
    { label: "Reviews", href: "/reviews" },
    { label: "Pricing", href: "/pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "Tools", href: "/tools" },
  ],
  Agreements: [
    { label: "Member Agreement", href: "/agreement/member" },
    { label: "Provider Agreement", href: "/agreement/provider" },
  ],
  Legal: [
    { label: "Refund & Cancellation Policy", href: "/legal/refund" },
    { label: "Privacy Policy", href: "/legal/privacy" },
  ],
};

// NAV (canon §6). Resources, Jobs and Blog are phase-one holdbacks; Jobs is
// kept in the list because the Header filters it behind the job-board flag
// exactly as DMN did.
export const navLinks = [
  { label: "What is ASN", href: "#features" },
  { label: "Tools", href: "/tools" },
  // Shown only when the job board is switched on (see Header + lib/jobs/flag).
  { label: "Jobs", href: "/jobs" },
  { label: "Experts", href: "/experts" },
  { label: "Companies", href: "/companies" },
  { label: "Reviews", href: "/reviews" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "#faq" },
];

// Waitlist / signup form field options (canon §4)
export const memberRoles = [
  "Dermatologist",
  "Plastic surgeon",
  "Med spa owner",
  "Esthetician",
  "Injector",
  "Practice manager",
  "Other aesthetic practice",
];

/**
 * True for any "Other" choice in a dropdown ("Other", "Other aesthetic
 * practice", "Other: ..."). Forms reveal a free-text field when this is
 * true and save the typed text instead of the literal option.
 */
export function isOtherOption(value: string | null | undefined): boolean {
  return /^other\b/i.test((value ?? "").trim());
}

/** The saved value for a dropdown: the typed text when "Other" was picked. */
export function resolveOtherOption(selected: string | null | undefined, typed: string | null | undefined): string {
  const v = (selected ?? "").trim();
  if (!isOtherOption(v)) return v;
  const t = (typed ?? "").trim();
  return t ? `Other: ${t}`.slice(0, 120) : v;
}

/** Splits a stored "Other: text" back into the dropdown value and the text. */
export function splitOtherOption(stored: string | null | undefined, options: readonly string[]): { value: string; other: string } {
  const v = (stored ?? "").trim();
  if (!v) return { value: "", other: "" };
  if (options.includes(v)) return { value: v, other: "" };
  const m = /^other\s*:\s*(.*)$/i.exec(v);
  const otherOpt = options.find((o) => isOtherOption(o)) ?? "Other";
  return m ? { value: otherOpt, other: m[1] } : { value: otherOpt, other: v };
}

export const locationOptions = ["1", "2–3", "4–9", "10+"];

export const challengeOptions = [
  "Pricing & margins",
  "Consult conversion",
  "Hiring & retention",
  "Vendor costs",
  "Marketing & new patients",
  "Systems & operations",
  "Other",
];

export const heardAboutOptions = [
  "Business of Aesthetics",
  "Ekwa Marketing",
  "An expert",
  "A partner company",
  "Google",
  "Instagram or social media",
  "A friend or colleague",
  "Other",
];

// PRICING
export const pricingSection = {
  eyebrow: "MEMBERSHIP",
  title: "One membership. One price. First 100 get the founding rate.",
  subtitle:
    "No tiers to decode, no upsell ladder. The first 100 founding members pay $29/month, locked at that rate for as long as their membership stays active. After that, it's $99.",
  bottomNote:
    "Cancel anytime, in two clicks. Founding-member rate stays as long as your membership is active.",
};

export const pricing = [
  {
    tier: "Member",
    audience: "Aesthetic practice owners and practitioners",
    price: "$29",
    cadence: "/month, founding rate",
    regularNote: "Regular price will be $99/month after founding spots fill",
    blurb:
      "Full access to every feature in the Aesthetic Success Network. The same membership everyone gets, at a rate that never goes up.",
    features: [
      "The Expert Hotline: written action plans in 2 to 3 business days",
      "Full resource library, new kits weekly",
      "Every member-only company deal",
      "Monthly live AMAs and CE",
      "Proven systems, SOPs, templates and checklists",
    ],
    cta: "Claim founding spot",
    ctaHref: "/#waitlist",
    highlight: true,
    role: "member",
  },
  {
    tier: "Company",
    audience: "Devices, injectables, skincare, software, services",
    price: "Apply",
    cadence: "First 6 months free from member launch, then $39/mo for 12 months, then $149/mo",
    blurb:
      "Get in front of aesthetics' most engaged buyers through a trusted shortlist instead of a cold ad. Profile and placement in your category, lead flow, and a Verified Company badge.",
    features: [
      "Featured listing in the company directory",
      "Profile and placement in your category",
      "Lead flow with a dashboard",
      "Verified Company badge",
      "Co-marketing opportunities across the network",
    ],
    cta: "Apply as a company",
    ctaHref: "/#waitlist",
    highlight: false,
    role: "vendor",
  },
];

// FOUNDING TEAM (canon §1): Naren Arulrajah and Lester De Alwis only, titles only.
export const foundingTeamSection = {
  eyebrow: "FOUNDING TEAM",
  title: "Powered by Business of Aesthetics.",
  subtitle:
    "Every expert, company, and resource is vetted by the founding team and the Business of Aesthetics team, not by an algorithm and not by a marketing department.",
};

export const foundingTeam = [
  {
    initials: "NA",
    photo: "/team/naren-arulrajah.jpg",
    name: "Naren Arulrajah",
    role: "Founder & CEO, Ekwa Marketing",
    blurb: "Founder & CEO, Ekwa Marketing.",
    color: "#163357",
  },
  {
    initials: "LD",
    photo: "/team/lester-de-alwis.png",
    name: "Lester De Alwis",
    role: "Co-Founder, Aesthetic Success Network",
    blurb: "Co-Founder, Aesthetic Success Network.",
    color: "#A07823",
  },
];

// POWERED BY: the organisations behind ASN. Files in /public.
// Used on /experts (marquee) and /companies (logo grid).
export const poweredBy = [
  { name: "Business of Aesthetics", logo: "/boa-logo.png", host: "Powered by" },
  { name: "Ekwa Marketing", logo: "/ekwa-logo.png", host: "Operating entity" },
];

// MEMBER LIBRARY PREVIEW: the topic cards shown inside the member portal mock.
export const libraryPreviewSection = {
  eyebrow: "A LOOK INSIDE THE MEMBER LIBRARY",
  title: "What you actually see after you sign in.",
  subtitle:
    "Pricing and margins, consult conversion, hiring, marketing and operations, taught by experts who run aesthetic practices. Plus the Hotline, the company deals, and monthly live sessions.",
};

// Library topics: single-palette (on-brand navy) for a professional, calm UI
// inside the member portal preview. `kind` maps each card to a topic-specific
// icon used as the still-frame graphic inside its video thumbnail.
export type LibraryTopicKind =
  | "kpi"
  | "ppo"
  | "seo"
  | "patient"
  | "book"
  | "huddle"
  | "reviews"
  | "photos";

export const libraryTopics: {
  title: string;
  track: string;
  duration: string;
  kind: LibraryTopicKind;
}[] = [
  { title: "Pricing injectables to protect your margin", track: "Pricing & Margins", duration: "Kit", kind: "kpi" },
  { title: "The consult that converts without pressure", track: "Consult & Conversion", duration: "Kit", kind: "patient" },
  { title: "Hiring and keeping a great injector", track: "Team & Culture", duration: "Kit", kind: "huddle" },
  { title: "Med spa KPIs that matter", track: "Operations & Compliance", duration: "Kit", kind: "ppo" },
  { title: "Retention and membership plans", track: "Patient Experience", duration: "Kit", kind: "book" },
  { title: "Aesthetic marketing that fills the calendar", track: "Marketing & Growth", duration: "Kit", kind: "seo" },
  { title: "Reviews and online reputation", track: "Marketing & Growth", duration: "Kit", kind: "reviews" },
  { title: "Before-and-after photography that sells the result", track: "Consult & Conversion", duration: "Kit", kind: "photos" },
];

// Kits are presented by the network's expert bench, not a single host.
export const libraryPresenter = {
  name: "ASN expert bench",
  initials: "ASN",
};

// Portal nav items shown in the preview mock
export const portalNavItems = [
  { label: "Hotline", badge: "2 to 3 days" },
  { label: "Resource library", badge: "Weekly" },
  { label: "Company deals", badge: "Growing" },
  { label: "Live sessions & CE", badge: "Monthly" },
  { label: "Our experts", badge: "Growing" },
];
