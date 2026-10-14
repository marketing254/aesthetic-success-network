/**
 * Founding experts shown on the /join/member waitlist page (owner, 14 Oct 2026).
 *
 * INVITERS: each founding expert gets a personal link for their own posts,
 *   /join/member?from=<slug>
 * which shows "<name> invited you" above the page and records the slug on
 * the waitlist row (utm.from). Only slugs listed here are honoured, so the
 * page never echoes arbitrary text from the URL.
 *
 * PROTOCOLS: the Expert Signature Series cards in the slow right-to-left
 * row. Images live in public/protocols (420 x 560).
 *
 * To add an expert: add an INVITERS entry (photo in public/team, optional)
 * and their Protocol cards, then share /join/member?from=<slug>.
 */

export type FoundingInviter = {
  name: string;
  /** Square headshot in public/team; the ASN icon is used when missing. */
  photo: string | null;
  /** The sentence after "<name> invited you." Wording from the owner. */
  line: string;
};

export const FOUNDING_INVITERS: Record<string, FoundingInviter> = {
  kaplan: {
    name: "Dr. Jonathan Kaplan",
    photo: "/team/jonathan-kaplan.jpg",
    line: "He's one of our founding experts.",
  },
  crowley: {
    name: "Laura Crowley",
    photo: null,
    line: "Laura is one of our founding experts.",
  },
};

/** The inviter for a ?from= value, or null for anything unknown. */
export function inviterFor(from: string | null | undefined): (FoundingInviter & { slug: string }) | null {
  const slug = (from ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  const hit = FOUNDING_INVITERS[slug];
  return hit ? { ...hit, slug } : null;
}

/** `expert` must match the expert's display name; their profile page shows these cards. */
export type ProtocolCard = { src: string; alt: string; title: string; expert: string };

export const PROTOCOL_CARDS: ProtocolCard[] = [
  { src: "/protocols/kaplan-weight-wellness-service-line.jpg", title: "The Weight & Wellness Service Line Protocol", expert: "Dr. Jonathan Kaplan", alt: "The Weight & Wellness Service Line Protocol, with Dr. Jonathan Kaplan" },
  { src: "/protocols/kaplan-subscription-practice.jpg", title: "The Subscription Practice Protocol", expert: "Dr. Jonathan Kaplan", alt: "The Subscription Practice Protocol, with Dr. Jonathan Kaplan" },
  { src: "/protocols/crowley-value-first-membership.jpg", title: "The Value-First Membership Protocol", expert: "Laura Crowley", alt: "The Value-First Membership Protocol, with Laura Crowley" },
  { src: "/protocols/crowley-team-follow-through.jpg", title: "The Team Follow-Through Protocol", expert: "Laura Crowley", alt: "The Team Follow-Through Protocol, with Laura Crowley" },
  { src: "/protocols/crowley-retail-gap.jpg", title: "The Retail Gap Protocol", expert: "Laura Crowley", alt: "The Retail Gap Protocol, with Laura Crowley" },
  { src: "/protocols/crowley-owner-step-back.jpg", title: "The Owner Step-Back Protocol", expert: "Laura Crowley", alt: "The Owner Step-Back Protocol, with Laura Crowley" },
];

/** The Protocol cards for one expert (matched on their display name). */
export function protocolsFor(expertName: string | null | undefined): ProtocolCard[] {
  const n = (expertName ?? "").trim().toLowerCase();
  return n ? PROTOCOL_CARDS.filter((c) => c.expert.toLowerCase() === n) : [];
}
