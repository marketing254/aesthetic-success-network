// Catalog + Offers mock data store.
// Vendors list services, products, and courses. Each offer attaches to a
// specific catalog item. Both go through team review before going live in the
// member directory. Preview-mode only — wire to Supabase when the model is
// stable.

export type CatalogItemType = "service" | "product" | "course";

export type ReviewStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_changes";

export type CatalogMedia = {
  url: string;
  /** Short caption shown in the gallery thumbnail and image-detail card. */
  caption: string;
};

export type CatalogVideo = {
  /** Direct URL or embed URL (YouTube, Vimeo). */
  url: string;
  thumbnail: string;
  title: string;
  durationLabel: string;
};

export type CatalogItem = {
  id: string;
  vendorId: string;
  type: CatalogItemType;
  name: string;
  category: string;
  /** Short subtitle used on cards (under the name). */
  tagline: string;
  description: string;
  /** Display price ("$4,200", "Quote", "$99/mo"). Free-form. */
  priceLabel: string;
  /** Course-only: total duration in hours. */
  durationHours?: number;
  /** Course-only: count of modules in the curriculum. */
  moduleCount?: number;
  /** Course-only: CE credit hours awarded. */
  ceCredits?: number;
  /** Bullet highlights surfaced under the description. */
  highlights: string[];
  images: CatalogMedia[];
  videos: CatalogVideo[];
  /** Tags for browsing (e.g. ["AI", "Digital", "Award-winning"]). */
  tags: string[];
  reviewStatus: ReviewStatus;
  reviewNote?: string;
  createdOn: string;
  updatedOn: string;
  /** Derived; cached for UI lists. */
  offerCount: number;
  /** Lifetime member redemptions tied to offers on this item. */
  redemptionsLifetime: number;
};

export type Offer = {
  id: string;
  vendorId: string;
  catalogItemId: string;
  headline: string;
  discountValue: string;
  promoCode: string;
  terms: string;
  description: string;
  images: CatalogMedia[];
  videos: CatalogVideo[];
  validFrom: string;
  validTo: string;
  redemptionLimitPerMember: string;
  reviewStatus: ReviewStatus;
  reviewNote?: string;
  createdOn: string;
};

export const CATALOG_CATEGORIES: Record<CatalogItemType, string[]> = {
  service: [
    "Practice consulting",
    "Marketing",
    "Bookkeeping & tax",
    "HR & recruiting",
    "Legal",
    "Insurance billing",
    "IT & cybersecurity",
    "Other",
  ],
  product: [
    "Equipment",
    "Software",
    "Supplies & consumables",
    "Lab services",
    "Practice furnishings",
    "Other",
  ],
  course: [
    "Clinical",
    "Practice operations",
    "Marketing",
    "Leadership",
    "Finance",
    "Insurance & billing",
    "Other",
  ],
};

export const REDEMPTION_LIMIT_OPTIONS = [
  "unlimited",
  "once per member",
  "monthly",
  "quarterly",
  "annually",
] as const;

export const VENDOR_ID = "vnd_acme_aesthetics";

// One example per type for the preview-mode partner portal. Placeholder
// partner and products only ("Acme Aesthetics Supply"); no real company,
// person or price is implied. Images use Unsplash (CC0) URLs so the
// preview shows what a listing looks like after a partner uploads media.
// Videos are placeholders surfaced as media cards only; none load on the
// page itself.

export const catalogItems: CatalogItem[] = [
  {
    id: "cat_lux_handpiece",
    vendorId: VENDOR_ID,
    type: "product",
    name: "LUX Laser Handpiece",
    category: "Equipment",
    tagline: "A placeholder energy-based device listing.",
    description:
      "Example product listing for the partner portal preview. Replace with the partner's real device, warranty, training and shipping details.",
    priceLabel: "$4,200",
    highlights: [
      "Placeholder highlight one",
      "Placeholder highlight two",
      "Placeholder highlight three",
      "Placeholder highlight four",
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1200&q=80",
        caption: "Handpiece in the treatment room",
      },
      {
        url: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80",
        caption: "Software UI on a treatment-room tablet",
      },
    ],
    videos: [
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        thumbnail: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=70",
        title: "60-second product overview",
        durationLabel: "1:02",
      },
    ],
    tags: ["Energy-based", "Devices"],
    reviewStatus: "approved",
    reviewNote: undefined,
    createdOn: "2026-07-11",
    updatedOn: "2026-07-11",
    offerCount: 1,
    redemptionsLifetime: 0,
  },
  {
    id: "cat_supply_concierge",
    vendorId: VENDOR_ID,
    type: "service",
    name: "Quarterly Supply Review",
    category: "Practice consulting",
    tagline: "A placeholder service listing.",
    description:
      "Example service listing for the partner portal preview: a quarterly review of injectables, skincare and consumable ordering. Replace with the partner's real service description.",
    priceLabel: "$0/mo for ASN members",
    highlights: [
      "Placeholder highlight one",
      "Placeholder highlight two",
      "Placeholder highlight three",
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
        caption: "Quarterly business review",
      },
    ],
    videos: [],
    tags: ["Savings", "Member-only pricing"],
    reviewStatus: "approved",
    reviewNote: undefined,
    createdOn: "2026-07-11",
    updatedOn: "2026-07-11",
    offerCount: 1,
    redemptionsLifetime: 0,
  },
  {
    id: "cat_injectables_course",
    vendorId: VENDOR_ID,
    type: "course",
    name: "Injectables Pricing and Margins",
    category: "Finance",
    tagline: "A placeholder course listing.",
    description:
      "Example course listing for the partner portal preview. Replace with the real module list, duration and any CE details confirmed by the accreditor.",
    priceLabel: "$1,250",
    durationHours: 6,
    moduleCount: 4,
    ceCredits: 0,
    highlights: [
      "Placeholder highlight one",
      "Placeholder highlight two",
      "Placeholder highlight three",
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
        caption: "Course cover art",
      },
    ],
    videos: [
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        thumbnail: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=70",
        title: "Course trailer",
        durationLabel: "2:48",
      },
    ],
    tags: ["Pricing", "Cohort"],
    reviewStatus: "pending_review",
    reviewNote: "Awaiting team review.",
    createdOn: "2026-07-11",
    updatedOn: "2026-07-11",
    offerCount: 1,
    redemptionsLifetime: 0,
  },
];

export const offers: Offer[] = [
  {
    id: "ofr_handpiece_pct_off",
    vendorId: VENDOR_ID,
    catalogItemId: "cat_lux_handpiece",
    headline: "12% off the LUX laser handpiece",
    discountValue: "12% off",
    promoCode: "ASN-LUX-12",
    terms:
      "Discount applies to the standalone handpiece SKU. Excludes service contracts. Limit one per practice location.",
    description:
      "Member-only discount on the LUX laser handpiece. Free shipping in the contiguous US included.",
    images: [],
    videos: [],
    validFrom: "2026-07-01",
    validTo: "2026-12-31",
    redemptionLimitPerMember: "once per member",
    reviewStatus: "approved",
    createdOn: "2026-07-11",
  },
  {
    id: "ofr_supply_waived",
    vendorId: VENDOR_ID,
    catalogItemId: "cat_supply_concierge",
    headline: "Setup fee waived for ASN members",
    discountValue: "$350 setup waived",
    promoCode: "ASN-SUPPLY",
    terms:
      "$350 onboarding setup fee waived for any ASN member who signs up for the Quarterly Supply Review. 90-day commitment.",
    description: "Skip the setup fee. Members see savings from the very first quarterly review.",
    images: [],
    videos: [],
    validFrom: "2026-07-01",
    validTo: "2026-12-31",
    redemptionLimitPerMember: "once per member",
    reviewStatus: "approved",
    createdOn: "2026-07-11",
  },
  {
    id: "ofr_course_early",
    vendorId: VENDOR_ID,
    catalogItemId: "cat_injectables_course",
    headline: "20% off Injectables Pricing and Margins",
    discountValue: "20% off",
    promoCode: "ASN-MARGIN-20",
    terms:
      "Member-only rate on the launch cohort. Cohort cap: 40 members.",
    description: "Founding-member discount for the inaugural cohort. Live and recorded sessions.",
    images: [],
    videos: [],
    validFrom: "2026-08-01",
    validTo: "2026-09-30",
    redemptionLimitPerMember: "once per member",
    reviewStatus: "draft",
    createdOn: "2026-07-11",
  },
];

export function getCatalogItem(id: string): CatalogItem | undefined {
  return catalogItems.find((c) => c.id === id);
}

export function getOffersForItem(catalogItemId: string): Offer[] {
  return offers.filter((o) => o.catalogItemId === catalogItemId);
}

export function statusLabel(status: ReviewStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending_review":
      return "In review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "needs_changes":
      return "Needs changes";
  }
}

export function statusPalette(status: ReviewStatus): { bg: string; fg: string; border: string } {
  switch (status) {
    case "approved":
      return { bg: "rgba(34,108,78,0.1)", fg: "#1F5C40", border: "rgba(34,108,78,0.28)" };
    case "pending_review":
      return { bg: "rgba(217,168,75,0.14)", fg: "#A07823", border: "rgba(217,168,75,0.32)" };
    case "needs_changes":
      return { bg: "rgba(217,168,75,0.14)", fg: "#A07823", border: "rgba(217,168,75,0.32)" };
    case "rejected":
      return { bg: "rgba(220,60,60,0.1)", fg: "#8C1D1D", border: "rgba(220,60,60,0.26)" };
    case "draft":
    default:
      return { bg: "rgba(14,42,61,0.05)", fg: "#5C6770", border: "rgba(14,42,61,0.12)" };
  }
}

export function typeLabel(type: CatalogItemType): string {
  switch (type) {
    case "service":
      return "Service";
    case "product":
      return "Product";
    case "course":
      return "Course";
  }
}
