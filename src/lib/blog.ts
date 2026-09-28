/**
 * ASN blog registry — the single source of truth for every published
 * article. The public /blog index, the /blog/[slug] template, the sitemap
 * and the member-dashboard "From the blog" rail all read from here, so
 * publishing a new article is: add one entry + drop its hero image in
 * /public/blog.
 *
 * ASN launches with an EMPTY registry: no DMN article, author, expert name
 * or hero image is carried over. Copy added here must be APPROVED VERBATIM
 * by the ASN approver before it ships. Do not rewrite article copy, titles,
 * slugs, meta fields, CTA wording or CTA destinations without the
 * approver's sign-off. Every consumer must handle an empty list (the /blog
 * index shows an honest "no posts yet" state; /blog/[slug] 404s).
 */

export type BlogBlock =
  | { kind: "p"; text: string; lead?: boolean }
  | { kind: "h2"; id: string; text: string; toc: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: { strong?: string; text: string }[] }
  | { kind: "quote"; text: string; cite?: string }
  | { kind: "formula"; parts: string[] };

export type BlogArticle = {
  slug: string;
  /** The one H1 on the page. */
  title: string;
  /** Approved meta title, used ABSOLUTE (no site-name template suffix). */
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  category: string;
  /** Intro summary under the H1. */
  dek: string;
  expert: {
    name: string;
    role: string;
    headshotUrl: string;
    /** Public expert profile (/experts/[id]) when one exists. */
    profileHref: string | null;
  };
  /** The kit this article teases — member-portal pages link straight to it. */
  kitSlug: string;
  hero: { src: string; alt: string };
  readTime: string;
  datePublished: string;
  dateModified: string;
  /** Answer-first callout card right under the hero (AEO). */
  quickAnswer?: string;
  body: BlogBlock[];
  /** Approved FAQ section — rendered on-page AND emitted as FAQPage JSON-LD. */
  faqs?: { q: string; a: string }[];
  takeaway: { eyebrow: string; title: string; body: string };
  kitCta: {
    kitName: string;
    description: string;
    /** CTA destination. LOCKED by the approver per article — never change without approval. */
    href: string;
    /** Per-article button label (falls back to BLOG_CTA_LABEL). LOCKED by the approver. */
    label?: string;
    /** Approved sentence rendered above the button (supports **bold**). */
    support?: string;
  };
  /**
   * false = approved for staging but NOT released (e.g. CTA destination
   * still unconfirmed by the approver). Unpublished articles are excluded from
   * the index, sitemap, related rails and static generation.
   */
  published?: boolean;
};

/** CTA button label — locked by the ASN approver. No promo codes in blog CTAs. */
export const BLOG_CTA_LABEL = "Join Aesthetic Success Network";

export const BLOG_INDEX_HEADING = "Aesthetic Practice Growth, Operations and Leadership";
export const BLOG_INDEX_STANDFIRST =
  "Practical, expert-led guidance for aesthetic practice owners and teams. Full implementation resources are available inside Aesthetic Success Network.";

/**
 * Empty at launch. Add approved articles here in publishing order; hero
 * images live in /public/blog (2560x1440 JPG, 16:9). CTA hrefs point at
 * /join/member unless the approver locks a different destination.
 */
export const BLOG_ARTICLES: BlogArticle[] = [];

/** Released articles only (published !== false). */
export const PUBLISHED_BLOG_ARTICLES = BLOG_ARTICLES.filter((a) => a.published !== false);

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}
