// Sample data for the member-app prototype. Swap with real APIs later 
// the shape here is what the UI components consume.

export type CourseStatus = "not-started" | "in-progress" | "completed";

export type Lesson = {
  id: string;
  title: string;
  durationMin: number;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type Course = {
  slug: string;
  title: string;
  category: "Operations" | "Finance" | "People" | "Compliance" | "Growth";
  summary: string;
  instructor: string;
  instructorRole: string;
  durationMin: number;
  ceCredits: number;
  // Watch-percentage (0-1) the user must reach before quiz unlocks
  ceUnlockAt: number;
  // Where the user currently is (0-1)
  watchProgress: number;
  status: CourseStatus;
  quizScore?: number; // last attempt percentage (0-100)
  certified: boolean;
  thumbAccent: string;
  lessons: Lesson[];
  quiz: QuizQuestion[];
};

export type VendorOffer = {
  id: string;
  vendor: string;
  category: string;
  headline: string;
  detail: string;
  savedYtd: number;
  redeemUrl: string;
  code: string;
  expires: string;
  accent: string;
};

export type RewardItem = {
  id: string;
  title: string;
  detail: string;
  pointsCost: number;
  category: "Hotline" | "Learning" | "Swag" | "Events" | "Cash";
  accent: string;
};

export type Certificate = {
  id: string;
  courseSlug: string;
  title: string;
  earnedOn: string;
  ceCredits: number;
  score: number;
  certNumber: string;
};

export type ActivityEntry = {
  id: string;
  kind: "ce" | "savings" | "course" | "hotline" | "reward";
  title: string;
  detail: string;
  when: string;
};

export const member = {
  firstName: "Marcus",
  lastName: "Chen",
  credential: "MD",
  email: "marcus.chen@example.com",
  phone: "(415) 555-0142",
  practice: "Bay Area Aesthetics",
  practiceRole: "Practice Owner",
  city: "San Francisco, CA",
  tier: "Founding Member",
  memberSince: "Mar 2026",
  avatarInitials: "MC",
  // CE points (separate currency from CE credits, earned for engagement)
  cePointsBalance: 285,
  // CE credits, actual continuing-education credits
  ceCreditsEarnedYtd: 11.5,
  ceCreditsGoalYtd: 40,
  savingsYtd: 4820,
  hotlineRequestsOpen: 1,
};

export type PlanTier = {
  id: string;
  name: string;
  priceMonthly: number;
  cadenceLabel: string;
  blurb: string;
  features: string[];
  highlight: boolean;
  ctaLabel: string;
  isCurrent?: boolean;
  isLocked?: boolean;
  badge?: string;
};

export const subscription = {
  planId: "founding",
  planName: "Founding Member",
  status: "active" as "active" | "past_due" | "canceled" | "trialing",
  priceMonthly: 49,
  cycle: "monthly" as "monthly" | "annual",
  startedOn: "Mar 15, 2026",
  renewsOn: "Jun 03, 2026",
  nextChargeAmount: 49,
  isLifetimeLocked: true,
  seats: 1,
};

export const planTiers: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    cadenceLabel: "Forever free",
    blurb: "A taste of the network. Public-facing assets only.",
    features: ["Public updates feed", "2 sample kits", "Waitlist for paid tiers"],
    highlight: false,
    ctaLabel: "Downgrade",
  },
  {
    id: "founding",
    name: "Founding",
    priceMonthly: 49,
    cadenceLabel: "/month, founding rate",
    blurb: "First 100 owners only. Full access at the lowest rate we will ever offer.",
    features: [
      "Everything in Pro",
      "Founding-member badge",
      "Direct line to product team",
      "$49/mo founding rate, never increases while active",
    ],
    highlight: true,
    ctaLabel: "Current plan",
    isCurrent: true,
    isLocked: true,
    badge: "YOUR PLAN",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 199,
    cadenceLabel: "/month",
    blurb: "Everything you need to run, hire, buy, and grow.",
    features: [
      "Expert hotline, written action plan in 2 to 3 business days",
      "Full partner savings network",
      "Member directory",
      "Full library + weekly content",
      "Proven systems, SOPs & templates",
    ],
    highlight: false,
    ctaLabel: "Upgrade to Pro",
  },
  {
    id: "premium",
    name: "Premium",
    priceMonthly: 499,
    cadenceLabel: "/month",
    blurb: "Pro, plus 1:1 coaching and quarterly business strategy.",
    features: [
      "Everything in Pro",
      "1:1 coaching, twice a month",
      "Quarterly strategy review (90 min)",
      "Priority hotline routing",
      "Annual in-person retreat seat",
    ],
    highlight: false,
    ctaLabel: "Upgrade to Premium",
  },
];

export type Invoice = {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed" | "refunded";
  description: string;
  cardLast4: string;
};

export const invoices: Invoice[] = [
  {
    id: "inv-2026-05",
    number: "ASN-2026-0512",
    date: "May 03, 2026",
    amount: 49,
    status: "paid",
    description: "Founding membership, May 2026",
    cardLast4: "4242",
  },
  {
    id: "inv-2026-04",
    number: "ASN-2026-0411",
    date: "Apr 03, 2026",
    amount: 49,
    status: "paid",
    description: "Founding membership, April 2026",
    cardLast4: "4242",
  },
  {
    id: "inv-2026-03",
    number: "ASN-2026-0315",
    date: "Mar 15, 2026",
    amount: 49,
    status: "paid",
    description: "Founding membership, March 2026 (pro-rated)",
    cardLast4: "4242",
  },
];

export const paymentMethod = {
  brand: "Visa",
  last4: "4242",
  expMonth: 12,
  expYear: 2028,
  holderName: "Marcus Chen",
  isDefault: true,
};

export const billingAddress = {
  line1: "1180 Market Street, Suite 240",
  city: "San Francisco",
  state: "CA",
  postalCode: "94102",
  country: "United States",
};

export const upcomingDeadlines = [
  {
    id: "ce-q2",
    label: "Q2 CE checkpoint",
    date: "Jun 30, 2026",
    detail: "Need 8.5 more credits to stay on pace for state renewal.",
  },
  {
    id: "osha",
    label: "OSHA refresher due",
    date: "Aug 15, 2026",
    detail: "Annual practice-wide compliance window.",
  },
];

export const courses: Course[] = [
  {
    slug: "injectables-pricing",
    title: "Pricing Injectables for Margin That Actually Holds",
    category: "Finance",
    summary:
      "A practical guide to raising your injectables pricing without losing patient volume, used in 40+ real repricing projects.",
    instructor: "Jordan Blake",
    instructorRole: "Practice Advisor",
    durationMin: 45,
    ceCredits: 1.5,
    ceUnlockAt: 0.85,
    watchProgress: 0.62,
    status: "in-progress",
    certified: false,
    thumbAccent: "linear-gradient(135deg, #1B4258 0%, #0E2A3D 100%)",
    lessons: [
      { id: "l1", title: "Why most price increases get resisted", durationMin: 6 },
      { id: "l2", title: "Building your leverage data pack", durationMin: 11 },
      { id: "l3", title: "Sequencing the changes: which treatment line first", durationMin: 9 },
      { id: "l4", title: "Counter-offer scripts that work", durationMin: 12 },
      { id: "l5", title: "When to walk and what happens next", durationMin: 7 },
    ],
    quiz: [
      {
        id: "q1",
        prompt: "What single document makes a price increase land most reliably?",
        options: [
          "A long letter explaining your costs",
          "A market-rate comparison with named competitors and per-unit pricing",
          "A patient satisfaction survey",
          "A strongly-worded email from your attorney",
        ],
        correctIndex: 1,
        explanation:
          "Patients and teams respond to data they can act on; named competitors and per-unit pricing give everyone something to defend.",
      },
      {
        id: "q2",
        prompt: "Which treatment line should you typically reprice first?",
        options: [
          "Your largest treatment line by patient volume",
          "Your smallest treatment line so the stakes are low",
          "A mid-sized treatment line where you have leverage but limited downside",
          "All of them simultaneously",
        ],
        correctIndex: 2,
        explanation:
          "Mid-sized lets you test scripts and build a track record without risking your highest-volume treatment line.",
      },
      {
        id: "q3",
        prompt: "How long does a typical price change take to settle into the numbers?",
        options: ["1-2 weeks", "30-60 days", "90-120 days", "Over a year"],
        correctIndex: 2,
        explanation: "90-120 days is the realistic window, anyone promising faster is selling something.",
      },
      {
        id: "q4",
        prompt: "When dropping a low-margin treatment is the right call, the first step is:",
        options: [
          "Drop it immediately",
          "Give 90 days notice and prepare patient comms",
          "Call patients individually",
          "Refer everyone to a competitor",
        ],
        correctIndex: 1,
        explanation:
          "The 90-day window protects revenue and gives you time to move affected patients to an alternative treatment.",
      },
      {
        id: "q5",
        prompt: "What's the most common reason renegotiations fail?",
        options: [
          "Asking for too much",
          "Not having a fallback plan if the carrier says no",
          "Waiting for the carrier to call back",
          "Both B and C",
        ],
        correctIndex: 3,
        explanation:
          "No fallback + waiting passively is the failure pattern. You need a plan B and an active follow-up cadence.",
      },
    ],
  },
  {
    slug: "hiring-office-manager",
    title: "Hiring Your First Office Manager Without Regret",
    category: "People",
    summary:
      "The interview structure, working-interview script, and 30/60/90 plan that separates a real OM from an over-promoted front-desk lead.",
    instructor: "Priya Nair",
    instructorRole: "People Operations Lead",
    durationMin: 70,
    ceCredits: 2.0,
    ceUnlockAt: 0.85,
    watchProgress: 0,
    status: "not-started",
    certified: false,
    thumbAccent: "linear-gradient(135deg, #C39638 0%, #D9A84B 100%)",
    lessons: [
      { id: "l1", title: "OM vs. lead admin: what you're actually buying", durationMin: 9 },
      { id: "l2", title: "Sourcing channels that produce real candidates", durationMin: 12 },
      { id: "l3", title: "The four-stage interview that filters out noise", durationMin: 16 },
      { id: "l4", title: "Working interview script + scoring rubric", durationMin: 14 },
      { id: "l5", title: "30/60/90 plan and the first hard conversation", durationMin: 19 },
    ],
    quiz: [
      {
        id: "q1",
        prompt: "What's the single biggest hiring mistake practice owners make for OM roles?",
        options: [
          "Promoting from within without a structured interview",
          "Hiring from outside aesthetics",
          "Paying too low",
          "Hiring too quickly",
        ],
        correctIndex: 0,
        explanation:
          "Promoting your best front desk doesn't make them a good OM, different job, different skills, different loyalty dynamics.",
      },
      {
        id: "q2",
        prompt: "A working interview should primarily test:",
        options: [
          "Clinical knowledge",
          "How they make decisions under ambiguity, not how fast they type",
          "Speed of task completion",
          "Personality fit only",
        ],
        correctIndex: 1,
        explanation: "Decision-making under ambiguity is the actual OM job, speed is table stakes.",
      },
      {
        id: "q3",
        prompt: "What should the 30-day check-in focus on?",
        options: [
          "Performance review",
          "Whether they've built relationships and identified the top 3 process gaps",
          "Salary discussion",
          "Long-term career planning",
        ],
        correctIndex: 1,
        explanation: "Day 30 is too early for performance, relationships and pattern recognition are the leading indicators.",
      },
      {
        id: "q4",
        prompt: "How many references should you actually call?",
        options: ["1", "2", "3 minimum, including one off-list", "Don't bother"],
        correctIndex: 2,
        explanation: "Off-list references, people not on the candidate's prepared list, are where the real signal lives.",
      },
      {
        id: "q5",
        prompt: "If your OM hire isn't working at 90 days, the right move is:",
        options: [
          "Give them another quarter",
          "Have a direct conversation, document the gap, and have a plan B in motion within 2 weeks",
          "Reorganize their role",
          "Hire an assistant for them",
        ],
        correctIndex: 1,
        explanation: "90 days is the decision point. Direct conversation + plan B parallel-track is how you protect the practice.",
      },
    ],
  },
  {
    slug: "pnl-for-operators",
    title: "Reading Your P&L Like an Operator, Not an Accountant",
    category: "Finance",
    summary:
      "The five lines that matter, the three ratios that predict a slow quarter, and a one-page dashboard you can build in a weekend.",
    instructor: "Jordan Blake",
    instructorRole: "Practice Advisor",
    durationMin: 35,
    ceCredits: 1.0,
    ceUnlockAt: 0.85,
    watchProgress: 1,
    status: "completed",
    quizScore: 88,
    certified: true,
    thumbAccent: "linear-gradient(135deg, #06182A 0%, #1B4258 100%)",
    lessons: [
      { id: "l1", title: "Why your accountant's P&L is the wrong tool", durationMin: 5 },
      { id: "l2", title: "The five lines that drive every decision", durationMin: 8 },
      { id: "l3", title: "Three ratios you should know cold", durationMin: 9 },
      { id: "l4", title: "Building your one-page operator dashboard", durationMin: 13 },
    ],
    quiz: [
      {
        id: "q1",
        prompt: "Which of the following is NOT one of the five operator P&L lines?",
        options: ["Production", "Collections", "Overhead %", "Patient satisfaction score"],
        correctIndex: 3,
        explanation: "Patient satisfaction is a leading indicator but not a P&L line.",
      },
      {
        id: "q2",
        prompt: "A healthy collections-to-production ratio for a stable practice is:",
        options: ["70-75%", "80-85%", "95-99%", "Above 100%"],
        correctIndex: 2,
        explanation: "95-99% is the operator benchmark. Below 95% means money is being left on the table.",
      },
      {
        id: "q3",
        prompt: "Overhead percentage is calculated as:",
        options: [
          "Total expenses ÷ collections",
          "Total expenses ÷ production",
          "Fixed expenses ÷ revenue",
          "Variable expenses ÷ collections",
        ],
        correctIndex: 0,
        explanation: "Expenses ÷ collections, collections, not production, because production isn't money in the bank.",
      },
      {
        id: "q4",
        prompt: "Which ratio most reliably predicts a slow Q3?",
        options: ["Membership renewal rate", "Marketing spend", "Consult conversion", "Days A/R outstanding"],
        correctIndex: 0,
        explanation: "Membership renewal is the leading indicator, soft numbers in March = soft revenue in July.",
      },
      {
        id: "q5",
        prompt: "Your operator dashboard should be reviewed:",
        options: ["Daily", "Weekly", "Monthly with a quarterly deep-dive", "Annually with your accountant"],
        correctIndex: 2,
        explanation: "Weekly produces noise, annual is too late. Monthly + quarterly is the operating cadence.",
      },
    ],
  },
  {
    slug: "osha-2026",
    title: "OSHA Compliance Refresher 2026",
    category: "Compliance",
    summary:
      "Updated for 2026 rule changes. Covers the documentation a surveyor will actually ask for, plus the three most common findings.",
    instructor: "Sam Rivera",
    instructorRole: "Compliance Specialist",
    durationMin: 55,
    ceCredits: 2.0,
    ceUnlockAt: 0.9,
    watchProgress: 0,
    status: "not-started",
    certified: false,
    thumbAccent: "linear-gradient(135deg, #224B62 0%, #06182A 100%)",
    lessons: [
      { id: "l1", title: "What changed in 2026 (and what didn't)", durationMin: 8 },
      { id: "l2", title: "The exposure control plan, line by line", durationMin: 14 },
      { id: "l3", title: "PPE, sharps, and the documentation trail", durationMin: 11 },
      { id: "l4", title: "Hazard communication and SDS in 2026", durationMin: 10 },
      { id: "l5", title: "What a surveyor actually asks for", durationMin: 12 },
    ],
    quiz: [
      {
        id: "q1",
        prompt: "How often must your exposure control plan be reviewed and updated?",
        options: ["Every 6 months", "Annually, at minimum", "Every 2 years", "Only after an incident"],
        correctIndex: 1,
        explanation: "Annual review is the OSHA minimum, more often if your tasks or PPE change.",
      },
      {
        id: "q2",
        prompt: "The most common OSHA finding in aesthetic practices is:",
        options: [
          "Missing eyewash station",
          "Incomplete sharps injury log",
          "Improper SDS organization",
          "Lack of training documentation",
        ],
        correctIndex: 3,
        explanation: "Training documentation gaps are the #1 cited finding, the training happened, but no one signed.",
      },
      {
        id: "q3",
        prompt: "Hepatitis B vaccine declination must be:",
        options: [
          "Verbally noted",
          "In writing, signed, on file",
          "Optional to document",
          "Only required for clinical staff",
        ],
        correctIndex: 1,
        explanation: "Written, signed, kept on file. Verbal does not satisfy the standard.",
      },
      {
        id: "q4",
        prompt: "SDS sheets must be:",
        options: [
          "Available within 5 minutes during business hours",
          "Posted on the wall",
          "Only available in print",
          "Reviewed by the medical director personally",
        ],
        correctIndex: 0,
        explanation: "Available within 5 minutes, digital is fine as long as access is reliable and the team knows how to find them.",
      },
      {
        id: "q5",
        prompt: "After a sharps injury, the post-exposure protocol must begin within:",
        options: ["1 hour", "2 hours", "4 hours", "24 hours"],
        correctIndex: 1,
        explanation: "Two hours is the clinically meaningful window for post-exposure prophylaxis.",
      },
    ],
  },
  {
    slug: "patient-recall-system",
    title: "Building a Patient Recall System That Actually Works",
    category: "Operations",
    summary:
      "Why your reactivation campaign is leaking patients, and the four-touch sequence that lifted recall rates by 18% across 30 practices.",
    instructor: "Priya Nair",
    instructorRole: "People Operations Lead",
    durationMin: 50,
    ceCredits: 1.5,
    ceUnlockAt: 0.85,
    watchProgress: 0.12,
    status: "in-progress",
    certified: false,
    thumbAccent: "linear-gradient(135deg, #A07823 0%, #C39638 100%)",
    lessons: [
      { id: "l1", title: "Why your current recall is leaking", durationMin: 8 },
      { id: "l2", title: "The four-touch sequence", durationMin: 13 },
      { id: "l3", title: "Channel mix: SMS, email, postcard, call", durationMin: 11 },
      { id: "l4", title: "Measuring what matters", durationMin: 8 },
      { id: "l5", title: "What to do about the chronic no-shows", durationMin: 10 },
    ],
    quiz: [
      {
        id: "q1",
        prompt: "What's the single biggest reason recall systems leak patients?",
        options: [
          "Wrong channel mix",
          "No accountability for who owns the list",
          "Bad copy",
          "Too few touches",
        ],
        correctIndex: 1,
        explanation: "Ownership is the failure point, a list that no one owns becomes everyone's last priority.",
      },
      {
        id: "q2",
        prompt: "The optimal first-touch channel for overdue recall is:",
        options: ["Email", "SMS", "Phone call", "Postcard"],
        correctIndex: 1,
        explanation: "SMS has the highest open rate. Email is touch #2.",
      },
      {
        id: "q3",
        prompt: "After how many touches should you stop and route to a personal call?",
        options: ["1", "2", "3", "4 or more"],
        correctIndex: 2,
        explanation: "After three automated touches, escalate to a real person. Five automated touches train patients to ignore you.",
      },
      {
        id: "q4",
        prompt: "The metric that actually predicts recall health is:",
        options: [
          "Recall appointment count",
          "% of due-list scheduled within 14 days",
          "SMS reply rate",
          "Email open rate",
        ],
        correctIndex: 1,
        explanation: "Scheduled-within-14-days is the operational signal. Everything else is downstream.",
      },
      {
        id: "q5",
        prompt: "For chronic no-show patients, the right play is:",
        options: [
          "Drop them from recall",
          "Move to a same-day-only short-list channel",
          "Send more reminders",
          "Charge a deposit",
        ],
        correctIndex: 1,
        explanation: "Move them to a short-list, you fill the chair if a same-day slot opens, but you stop wasting the front desk's time chasing.",
      },
    ],
  },
  {
    slug: "associate-comp-models",
    title: "Associate Compensation Models, Compared",
    category: "People",
    summary:
      "Daily guarantee vs. percent-of-collections vs. hybrid, which one keeps your associate the longest, and how to switch without losing them.",
    instructor: "Jordan Blake",
    instructorRole: "Practice Advisor",
    durationMin: 30,
    ceCredits: 1.0,
    ceUnlockAt: 0.85,
    watchProgress: 1,
    status: "completed",
    quizScore: 92,
    certified: true,
    thumbAccent: "linear-gradient(135deg, #1B4258 0%, #224B62 100%)",
    lessons: [
      { id: "l1", title: "The three models, plain English", durationMin: 6 },
      { id: "l2", title: "Which model fits which practice", durationMin: 9 },
      { id: "l3", title: "How to switch models without losing the associate", durationMin: 8 },
      { id: "l4", title: "Red flags in associate contracts", durationMin: 7 },
    ],
    quiz: [
      {
        id: "q1",
        prompt: "Daily guarantee is the right fit when:",
        options: [
          "The associate is new and ramping",
          "The practice is mature and busy",
          "The owner wants minimum risk",
          "Both A and C",
        ],
        correctIndex: 3,
        explanation: "New + ramping benefits from a guarantee; risk-averse owners often prefer it too.",
      },
      {
        id: "q2",
        prompt: "Percent-of-collections (vs. production) protects the practice because:",
        options: [
          "It's easier to calculate",
          "It only pays on money actually collected",
          "It's required by most states",
          "It's faster to administer",
        ],
        correctIndex: 1,
        explanation: "Pay on collections, production minus what insurance writes off and patients don't pay.",
      },
      {
        id: "q3",
        prompt: "The hybrid model is most useful when:",
        options: [
          "You're switching an associate from guarantee to production",
          "The associate is starting from scratch",
          "You don't trust the associate yet",
          "You want to underpay",
        ],
        correctIndex: 0,
        explanation: "Hybrid is the bridge, it lowers the associate's anxiety during the switch.",
      },
      {
        id: "q4",
        prompt: "The single biggest red flag in an associate contract is:",
        options: [
          "Non-compete that's too narrow",
          "Vague language around lab fees and overhead",
          "Short notice period",
          "Yearly review clause",
        ],
        correctIndex: 1,
        explanation: "Vague lab fees and overhead language is where most disputes start.",
      },
      {
        id: "q5",
        prompt: "When switching models, you should:",
        options: [
          "Switch overnight",
          "Run a 60-90 day shadow period showing both models side-by-side",
          "Ask the associate to choose",
          "Only switch with a raise",
        ],
        correctIndex: 1,
        explanation: "A shadow period builds trust, the associate sees the math before the change is real.",
      },
    ],
  },
];

export const vendorOffers: VendorOffer[] = [
  {
    id: "acme-aesthetics-supply",
    vendor: "Acme Aesthetics Supply",
    category: "Supplies",
    headline: "12% off recurring orders",
    detail: "Stacks with quarterly volume rebate. No minimum.",
    savedYtd: 1240,
    redeemUrl: "#",
    code: "ASN-ACME-12",
    expires: "Dec 31, 2026",
    accent: "linear-gradient(135deg, #1B4258 0%, #0E2A3D 100%)",
  },
  {
    id: "glow-laser",
    vendor: "Glow Laser Co.",
    category: "Equipment",
    headline: "8% off equipment financing",
    detail: "Network rate on lasers, energy devices, imaging. Pre-approved underwriting.",
    savedYtd: 0,
    redeemUrl: "#",
    code: "ASN-GLOW-2026",
    expires: "Jun 30, 2026",
    accent: "linear-gradient(135deg, #C39638 0%, #D9A84B 100%)",
  },
  {
    id: "weave",
    vendor: "Weave",
    category: "Patient Comms",
    headline: "3 months free + 15% off year one",
    detail: "Texting, phones, payments. Onboarding fee waived.",
    savedYtd: 1620,
    redeemUrl: "#",
    code: "ASN-WEAVE-3M",
    expires: "Sep 30, 2026",
    accent: "linear-gradient(135deg, #224B62 0%, #1B4258 100%)",
  },
  {
    id: "carestack",
    vendor: "CareStack PMS",
    category: "Practice Management",
    headline: "20% off implementation",
    detail: "For ASN members switching from another practice-management system.",
    savedYtd: 0,
    redeemUrl: "#",
    code: "ASN-CS-20",
    expires: "Aug 31, 2026",
    accent: "linear-gradient(135deg, #06182A 0%, #1B4258 100%)",
  },
  {
    id: "yapi",
    vendor: "Yapi",
    category: "Workflow",
    headline: "6 months free",
    detail: "Digital forms, treatment planning, intra-office messaging.",
    savedYtd: 980,
    redeemUrl: "#",
    code: "ASN-YAPI-6",
    expires: "Dec 31, 2026",
    accent: "linear-gradient(135deg, #A07823 0%, #C39638 100%)",
  },
  {
    id: "practice-web",
    vendor: "Practice-Web",
    category: "Marketing",
    headline: "2 months free + free site audit",
    detail: "SEO + reputation management bundle. No setup fee.",
    savedYtd: 980,
    redeemUrl: "#",
    code: "ASN-PW-2M",
    expires: "Jul 31, 2026",
    accent: "linear-gradient(135deg, #1B4258 0%, #224B62 100%)",
  },
];

export const rewardCatalog: RewardItem[] = [
  {
    id: "hotline-priority",
    title: "Priority Hotline Pass",
    detail: "Skip the queue on your next 3 hotline requests. 1-hour first response, guaranteed.",
    pointsCost: 75,
    category: "Hotline",
    accent: "linear-gradient(135deg, #C39638 0%, #D9A84B 100%)",
  },
  {
    id: "premium-course",
    title: "Premium Course Unlock",
    detail: "Unlock any one Premium-tier course for free. Includes CE credits and certification.",
    pointsCost: 50,
    category: "Learning",
    accent: "linear-gradient(135deg, #1B4258 0%, #0E2A3D 100%)",
  },
  {
    id: "amazon-50",
    title: "$50 Amazon Gift Card",
    detail: "Delivered to your member email within 24 hours.",
    pointsCost: 100,
    category: "Cash",
    accent: "linear-gradient(135deg, #224B62 0%, #06182A 100%)",
  },
  {
    id: "swag-bundle",
    title: "Founding Member Swag Bundle",
    detail: "Heavyweight tee, ceramic mug, leather notebook. Ships free in the US.",
    pointsCost: 60,
    category: "Swag",
    accent: "linear-gradient(135deg, #A07823 0%, #C39638 100%)",
  },
  {
    id: "conference-discount",
    title: "Conference Ticket, 50% Off",
    detail: "Apply to any partner conference in the aesthetics calendar.",
    pointsCost: 200,
    category: "Events",
    accent: "linear-gradient(135deg, #06182A 0%, #1B4258 100%)",
  },
  {
    id: "1-1-coaching",
    title: "1:1 Coaching Session (60 min)",
    detail: "Book a single coaching call with a Premium-tier advisor. Normally $499.",
    pointsCost: 300,
    category: "Hotline",
    accent: "linear-gradient(135deg, #1B4258 0%, #224B62 100%)",
  },
];

export const certificates: Certificate[] = [
  {
    id: "cert-pnl",
    courseSlug: "pnl-for-operators",
    title: "Reading Your P&L Like an Operator",
    earnedOn: "Apr 18, 2026",
    ceCredits: 1.0,
    score: 88,
    certNumber: "ASN-CE-2026-0144",
  },
  {
    id: "cert-comp",
    courseSlug: "associate-comp-models",
    title: "Associate Compensation Models, Compared",
    earnedOn: "Apr 02, 2026",
    ceCredits: 1.0,
    score: 92,
    certNumber: "ASN-CE-2026-0098",
  },
];

export const recentActivity: ActivityEntry[] = [
  {
    id: "a1",
    kind: "savings",
    title: "Acme Aesthetics Supply order, $214 saved",
    detail: "Stacked with quarterly rebate.",
    when: "2 days ago",
  },
  {
    id: "a2",
    kind: "course",
    title: "Started: Patient Recall System That Works",
    detail: "Lesson 1 of 5, 12% complete.",
    when: "3 days ago",
  },
  {
    id: "a3",
    kind: "ce",
    title: "Earned 1.0 CE credit",
    detail: "P&L for Operators, quiz scored 88%.",
    when: "Apr 18",
  },
  {
    id: "a4",
    kind: "hotline",
    title: "Hotline case opened: injectables pricing",
    detail: "Matched with Jordan Blake, call scheduled Tue 2pm PT.",
    when: "Apr 21",
  },
  {
    id: "a5",
    kind: "reward",
    title: "Redeemed: Founding Swag Bundle",
    detail: "60 CE points, shipped to SF address.",
    when: "Apr 9",
  },
];

export function getCourseBySlug(slug: string): Course | undefined {
  return courses.find((c) => c.slug === slug);
}
