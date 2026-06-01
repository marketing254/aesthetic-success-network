// Single source of truth for the Aesthetics Success Network pre-launch landing.
// Structure + copy ported from the Dental Member Network content guide; dental
// terminology swapped for aesthetics. Numbers are the client's to confirm.

export const brand = {
  name: "Aesthetics Success Network",
  shortName: "ASN",
  phoneDisplay: "(800) 555-0142",
  phoneTel: "+18005550142",
  email: "hello@aestheticssuccessnetwork.com",
  domain: "aestheticssuccessnetwork.com",
  joinUrl: "#waitlist",
  signInUrl: "#waitlist",
};

export const founding = {
  totalSpots: 100,
  spotsClaimed: 0,
  priceMonthly: 49,
  priceRegular: 199,
  priceAnnual: 490,
  annualNote: "Pay for 10 months, get 12, save $98/year",
};

// HERO
export const hero = {
  topChip: "FOUNDING MEMBERSHIP · FIRST 100 ONLY",
  headline: "A human expert on the line for every practice problem.",
  subtitle:
    "Built for US aesthetic practice owners who want fast answers, measurable vendor savings, and a peer room full of operators who have already solved the problem in front of you.",
  bottomNote:
    "No four-figure upsells. No surprise coaching pitches. The membership is the product.",
  proofPoints: [{ value: "0", label: "practice owners on the waitlist" }],
  progressLabel: "founding spots claimed",
};

// MARQUEE — 6 badges
export const marqueeBadges = [
  "24/7 Expert Helpline",
  "Exclusive Partner Discounts",
  "Exclusive Content Library",
  "Proven Systems & SOPs",
  "500+ Aesthetic Practice Owners",
  "Vendor Savings Averaging $6K+",
];

// FEATURES → "Why This Network Works"
export const featuresSection = {
  eyebrow: "Why this network works",
  title: "The difference is curation, not catalog.",
  titleEmphasis: "curation, not catalog.",
  subtitle:
    "Most aesthetics directories are crowded with anyone who paid for a listing. The Aesthetics Success Network is curated — every expert and vendor is vetted by our team before they reach you.",
};

export const features = [
  {
    title: "Vetted Experts",
    summary:
      "Every expert is reviewed before they're listed. Members get coaches who actually deliver, not just anyone with a website.",
    index: "01",
  },
  {
    title: "Trusted Vendors",
    summary:
      "Vendors commit to giving members the best deal they offer anywhere. Discounts are real and clearly stated.",
    index: "02",
  },
  {
    title: "Curated Content",
    summary:
      "Free access to years of panel, webinar, and masterclass recordings, plus member rates on every paid expert course.",
    index: "03",
  },
  {
    title: "Founding Pricing",
    summary:
      "The first 100 founding members lock in $49/month at the founding rate for as long as their membership stays active. Founding rate ends after 20 days or the cap, whichever comes first.",
    index: "04",
  },
];

// WAITLIST SECTION
export const waitlist = {
  eyebrow: "Join the waitlist",
  headline: "Not ready to join? Get on the list.",
  subtitle:
    "Join the waitlist for early access, exclusive launch pricing, and priority access to founding spots before they fill.",
  benefits: [
    "Early access — be the first to know when new features and vendor deals launch",
    "Exclusive launch pricing — waitlist members get first crack at the founding rate",
    "Priority founding access — limited to 100 spots, waitlist members notified first",
    "First notice — new content, partner deals, and expert panel invitations",
  ],
  submitLabel: "Join the Waitlist",
  submittingLabel: "Saving your spot…",
  footerNote:
    "No spam. Just early access, launch updates, and founding-member opportunities.",
};

export const waitlistByRole = {
  member: {
    eyebrow: "Founding member",
    headline: "Lock in the $49/month founding rate. First 100 only.",
    subtitle:
      "The waitlist is how we onboard the founding cohort before launch. Get a guaranteed spot, the founding rate, and first access to every feature we ship.",
    benefits: [
      "$49/month founding rate — never increases while your membership stays active",
      "24/7 expert helpline with a written follow-up plan within 3 business days",
      "Vendor savings averaging $6,000+/year — no per-deal commissions",
      "30-day money-back guarantee — cancel anytime",
    ],
  },
  vendor: {
    eyebrow: "Founding vendor partner",
    headline: "Six months free. Featured to providers actively buying.",
    subtitle:
      "The founding vendor cohort gets featured placement in the directory, warm introductions to members, and access to the partner hotline from day one.",
    benefits: [
      "$0 for the first 6 months, $49/mo for months 7–12, $199/mo standard",
      "Featured listing + warm-intro routing through the partner hotline",
      "Co-branded content opportunities (podcast, AMAs, written guides)",
      "Members already pre-qualified — practice owners actively spending",
    ],
  },
};

// CTA / contact form
export const ctaForm = {
  eyebrow: "Founding access",
  title: "Tell us about your practice.",
  subtitle:
    "Skip the funnel. Tell us what you're working on and we'll match you with the right expert, vendor deal, or peer connection. One business day response, from a real person.",
  responseWindowLabel: "Response window",
  responseWindowValue: "Under 1 business day",
  trustNote: "Encrypted in transit. Never shared.",
  rightTitle: "Send us a note",
  rightSubtitle: "Clear form, real human on the other side.",
  reassurances: [
    "30-day money-back guarantee with no retention call.",
    "We do not store any patient data. Ever.",
    "$49/mo founding rate, never increases while your membership stays active.",
    "Cancel anytime, in two clicks, from your account page.",
  ],
};

// FAQ
export const faqSection = {
  eyebrow: "Questions",
  title: "The honest answers.",
  subtitle: "The questions we get most, answered without sales gloss.",
};

export const faqs = [
  {
    q: "What exactly do I get with my membership?",
    a: "Four core things:",
    items: [
      "A 24/7 expert helpline staffed by business coaches and practice advisors.",
      "Exclusive partner discounts averaging $6,000+ per year on products, devices, supplies, and services.",
      "An exclusive content library with recorded expert panels, training, and knowledge resources.",
      "A searchable directory of 500+ aesthetic practice owners.",
    ],
    aClose: "Plus proven systems, SOPs, and monthly live AMAs with specialists.",
  },
  {
    q: "How do the vendor savings work?",
    a: "We negotiate group rates with product suppliers, device companies, and service providers on behalf of our members. You get access to the full vendor network as part of your membership — no extra fees, no per-deal commissions. Members save an average of $6,400 in their first year.",
  },
  {
    q: "What is the founding member rate?",
    a: "$49/month — the founding rate. It never increases for as long as your membership stays active. This rate is only available to the first 100 members. After those spots fill, the standard price is $199/month. There is also an annual option: $490/year (pay for 10 months, get 12, save $98). Cancel anytime.",
  },
  {
    q: "What if I'm not ready to join yet?",
    a: "Join the waitlist. You'll get early access, exclusive launch pricing, and priority access to founding spots before they fill. No spam — just launch updates and founding-member opportunities.",
  },
  {
    q: "Is this just another aesthetics membership I won't use?",
    a: "The helpline and vendor savings deliver value whether you open the content library or not. Most members call the helpline within their first week and recoup their membership cost through vendor savings within the first quarter. This is an operating tool, not a course you have to finish.",
  },
  {
    q: "What if I'm a solo provider?",
    a: "Solo providers often get the most value. The helpline replaces the business partner or consultant you don't have. The vendor network delivers savings regardless of practice size. And the member directory connects you with peers who have solved the exact problems you're facing.",
  },
  {
    q: "Can vendors join too?",
    a: "Yes. We have a vendor membership tier for companies that want to be featured in our vendor directory and gain access to our member network. Vendor partners get preferred placement, warm introductions, and co-branded content opportunities. Contact us to apply.",
  },
  {
    q: "Is there a money-back guarantee?",
    a: "Yes. 30-day money-back guarantee — no retention call, no hassle. If the membership doesn't deliver value in the first month, we refund in full.",
  },
  {
    q: "Do you store patient data?",
    a: "No. The Aesthetics Success Network is a membership and business services platform. We do not collect, store, or process any patient data. Ever.",
  },
];

// FOOTER
export const footer = {
  brandDescription:
    "The only network with a human expert on the line for every practice problem. Expert helpline, vendor savings, exclusive content, and 500+ practice owners — all in one membership.",
  primaryCta: "Claim founding spot",
  secondaryCta: "Email founding team",
  supportLabel: "Support",
  responseLabel: "Response standard",
  responseValue: "Human reply in under 1 business day",
  copyright:
    "© 2026 Aesthetics Success Network. Built for practice owners running real businesses.",
  dataNote:
    "We do not store patient data. The Aesthetics Success Network is a training and education platform.",
};

export const footerLinks = {
  Network: [
    { label: "What You Get", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Waitlist", href: "#waitlist" },
    { label: "FAQ", href: "#faq" },
  ],
  Agreements: [
    { label: "Member Agreement", href: "/agreement/member" },
    { label: "Vendor Partnership Agreement", href: "/agreement/vendor" },
  ],
  Legal: [
    { label: "Refund & Cancellation", href: "/legal/refund" },
    { label: "Privacy Policy", href: "/legal/privacy" },
  ],
};

export const navLinks = [
  { label: "What You Get", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Waitlist", href: "#waitlist" },
  { label: "FAQ", href: "#faq" },
];

// Waitlist form field options
export const memberRoles = [
  "Practice Owner",
  "Injector / Provider (NP, PA, RN)",
  "Aesthetician",
  "Medical Director",
  "MedSpa Group Leader",
  "Other",
];

export const locationOptions = ["1", "2–5", "6–10", "11+"];

export const challengeOptions = [
  "Vendor & product costs",
  "Hiring & retention",
  "Pricing & packaging",
  "Client retention",
  "Marketing",
  "Other",
];

// PRICING
export const pricingSection = {
  eyebrow: "Membership",
  title: "One membership. One price. First 100 get the founding rate.",
  subtitle:
    "No tiers to decode, no upsell ladder. The first 100 founding members pay $49/month, locked at that rate for as long as their membership stays active. After that, it's $199.",
  bottomNote:
    "30-day money-back guarantee. Cancel anytime. Founding-member rate never increases while your membership stays active.",
};

export const pricing = [
  {
    tier: "Member",
    audience: "Practice owners and providers",
    price: "$49",
    cadence: "/month, founding rate",
    regularNote: "Regular price will be $199/month after founding spots fill",
    blurb:
      "Full access to every feature in the Aesthetics Success Network. The same membership everyone gets, at a rate that never goes up.",
    features: [
      "24/7 expert helpline — business coaches and practice advisors on call",
      "Exclusive partner discounts — negotiated vendor savings averaging $6,000+/year",
      "Exclusive content library — recorded expert panels, training, and knowledge resources",
      "Member directory — 500+ practice owners searchable by city, specialty, revenue",
      "Proven systems — battle-tested templates, checklists, and SOPs",
      "Monthly live AMAs with specialists",
    ],
    cta: "Claim founding spot",
    ctaHref: "#waitlist",
    highlight: true,
    role: "member",
  },
  {
    tier: "Vendor Partner",
    audience: "Products, devices, software, services",
    price: "Apply",
    cadence: "Founding cohort: $0 for 6 months, $49/mo months 7–12, then $199/mo",
    blurb:
      "Get featured to our member network. Preferred placement, warm introductions, and direct access to practice owners who are actively buying.",
    features: [
      "Featured listing in the vendor directory",
      "Access to the member network for warm introductions",
      "Inclusion in the negotiated deals program",
      "Co-branded content opportunities",
      "Priority placement in new vendor deal announcements",
    ],
    cta: "Apply as vendor partner",
    ctaHref: "#waitlist",
    highlight: false,
    role: "vendor",
  },
];
