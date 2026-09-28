import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Concierge AI helpers for the member portal assistant.
 *
 *  - Lazy-instantiates the OpenAI client (so a missing API key during
 *    build doesn't crash the build itself; routes return a clear error
 *    at request time instead).
 *  - Builds the system prompt with the signed-in member's identity AND
 *    the live resource catalog. Refetched on every chat turn so new
 *    kits the admin team approves become known to the bot instantly —
 *    no re-indexing, no cron job, no embedding step.
 *  - Centralises the course-network voice + payment/sensitive-info
 *    guardrails so prompt updates ship in one place.
 */

export const ASSISTANT_MODEL = "gpt-4o-mini";
export const ASSISTANT_MAX_TOKENS = 800;

/**
 * Sentinel the model emits as the FIRST line when a question can't be
 * answered from the portal context (experts / offers / resources /
 * membership basics) and should be handed to the team. The client strips
 * this line and shows the "call the hotline / email me the ASN pack"
 * escalation card.
 */
export const ESCALATE_MARKER = "[[ESCALATE]]";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to landing/.env.local for local dev and to Vercel env vars (Preview + Production) before shipping.",
    );
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

/**
 * Lightweight catalog row injected into every prompt. Keep this short
 * — the catalog is the bulk of the system token spend.
 */
type CatalogKit = {
  slug: string;
  title: string;
  category: string | null;
  summary: string | null;
  itemCount: number;
  videoCount: number;
  isFree: boolean;
  /** Titles of the individual items inside the kit (capped) — lets the
   *  bot answer "do you have a checklist for X?" with the exact kit. */
  itemTitles: string[];
  expertId: string | null;
};

const MAX_ITEM_TITLES = 10;

/**
 * Fetches every approved, published resource kit and groups by slug.
 * Called on each chat turn so the bot sees the live catalog (new kits
 * appear the moment an admin approves them).
 */
export async function loadResourceCatalog(): Promise<CatalogKit[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("resources")
    .select("topic_slug, topic_title, topic_summary, category, kind, is_free, title, originating_expert_id")
    .eq("is_published", true)
    .eq("submission_status", "approved");

  if (error) {
    // Don't block the chat on a catalog fetch failure — the assistant
    // can still answer general questions, just without the catalog map.
    return [];
  }

  const byKit = new Map<string, CatalogKit>();
  for (const r of data ?? []) {
    const isVideo = r.kind.startsWith("video_") || r.kind === "audio";
    const existing = byKit.get(r.topic_slug);
    if (existing) {
      existing.itemCount += 1;
      if (isVideo) existing.videoCount += 1;
      if (!r.is_free) existing.isFree = false;
      if (r.title && existing.itemTitles.length < MAX_ITEM_TITLES) existing.itemTitles.push(r.title);
      if (!existing.expertId && r.originating_expert_id) existing.expertId = r.originating_expert_id;
    } else {
      byKit.set(r.topic_slug, {
        slug: r.topic_slug,
        title: r.topic_title,
        category: r.category,
        summary: r.topic_summary,
        itemCount: 1,
        videoCount: isVideo ? 1 : 0,
        isFree: r.is_free,
        itemTitles: r.title ? [r.title] : [],
        expertId: r.originating_expert_id ?? null,
      });
    }
  }

  return Array.from(byKit.values()).sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Render the live catalog as a compact text block the model can scan.
 * Grouped by category for fast cross-reference.
 */
function renderCatalogForPrompt(kits: CatalogKit[], expertNameById: Map<string, string>): string {
  if (kits.length === 0) {
    return "(No approved kits in the resource library yet. Direct members to /dashboard/resources to check the latest.)";
  }

  const grouped = new Map<string, CatalogKit[]>();
  for (const k of kits) {
    const cat = k.category ?? "Uncategorised";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(k);
  }

  const lines: string[] = [];
  const sortedCategories = Array.from(grouped.keys()).sort();
  for (const cat of sortedCategories) {
    lines.push(`\n## ${cat}`);
    for (const k of grouped.get(cat)!) {
      const meta: string[] = [];
      meta.push(`${k.itemCount} ${k.itemCount === 1 ? "item" : "items"}`);
      if (k.videoCount > 0) meta.push(`${k.videoCount} video${k.videoCount === 1 ? "" : "s"}`);
      if (k.isFree) meta.push("free");
      const by = k.expertId ? expertNameById.get(k.expertId) : null;
      if (by) meta.push(`by ${by}`);
      const summary = k.summary?.trim() ?? "";
      lines.push(`- **${k.title}** (/dashboard/resources/${k.slug}): ${summary}`);
      lines.push(`  [${meta.join(" · ")}]`);
      if (k.itemTitles.length > 0) {
        lines.push(`  Inside: ${k.itemTitles.join("; ")}${k.itemCount > k.itemTitles.length ? "; …" : ""}`);
      }
    }
  }
  return lines.join("\n").trim();
}

// ─── Spotlights (events / news / features on profiles + network feed) ──
type CatalogSpotlight = {
  kind: string;
  title: string;
  body: string;
  eventDate: string | null;
  linkUrl: string | null;
  ownerName: string;
  ownerPath: string;
};

/** Published profile spotlights, newest first — the events/news layer. */
export async function loadSpotlights(): Promise<CatalogSpotlight[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("profile_spotlights")
    .select("kind, title, body, event_date, link_url, expert_id, vendor_id")
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(20);
  if (error || !data || data.length === 0) return [];

  const expertIds = Array.from(new Set(data.map((s) => s.expert_id).filter(Boolean) as string[]));
  const vendorIds = Array.from(new Set(data.map((s) => s.vendor_id).filter(Boolean) as string[]));
  const [{ data: experts }, { data: vendors }] = await Promise.all([
    expertIds.length
      ? sb.from("experts").select("id, display_name, full_name").in("id", expertIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; full_name: string | null }[] }),
    vendorIds.length
      ? sb.from("vendors").select("id, display_name, company_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; company_name: string | null }[] }),
  ]);
  const em = new Map((experts ?? []).map((e) => [e.id, e.display_name || e.full_name || "an expert"]));
  const vm = new Map((vendors ?? []).map((v) => [v.id, v.display_name || v.company_name || "a partner"]));

  return data.map((s) => ({
    kind: s.kind,
    title: s.title,
    body: (s.body ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    eventDate: s.event_date,
    linkUrl: s.link_url,
    ownerName: s.expert_id ? em.get(s.expert_id) ?? "an expert" : vm.get(s.vendor_id ?? "") ?? "a partner",
    ownerPath: s.expert_id ? `/dashboard/experts/${s.expert_id}` : `/dashboard/partners/${s.vendor_id}`,
  }));
}

function renderSpotlightsForPrompt(spotlights: CatalogSpotlight[]): string {
  if (spotlights.length === 0) {
    return "(No published spotlights right now. For the latest events and updates point members to /dashboard/network.)";
  }
  return spotlights
    .map((s) => {
      const date = s.eventDate ? ` on ${s.eventDate}` : "";
      const link = s.linkUrl ? `. External link: ${s.linkUrl}` : "";
      return `- [${s.kind}] **${s.title}**${date}, from ${s.ownerName} (${s.ownerPath}): ${s.body}${link}`;
    })
    .join("\n");
}

// ─── Experts ──────────────────────────────────────────────────────────
type CatalogExpert = { id: string; name: string; specialty: string | null; bio: string | null };

/** Active, publish-ready experts (same gate as the member directory). */
export async function loadExperts(): Promise<CatalogExpert[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("experts")
    .select("id, display_name, full_name, specialty, bio")
    .neq("status", "archived")
    .neq("status", "suspended")
    .not("headshot_url", "is", null)
    .not("bio", "is", null)
    .order("display_name", { ascending: true, nullsFirst: false });
  if (error) return [];
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.display_name || e.full_name || "(unnamed expert)",
    specialty: e.specialty,
    bio: e.bio,
  }));
}

function renderExpertsForPrompt(experts: CatalogExpert[]): string {
  if (experts.length === 0) return "(No experts published yet. Point members to /dashboard/experts.)";
  return experts
    .map((e) => {
      const bio = (e.bio ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
      const spec = e.specialty ? `, ${e.specialty}` : "";
      return `- **${e.name}**${spec} (/dashboard/experts/${e.id})${bio ? `: ${bio}` : ""}`;
    })
    .join("\n");
}

// ─── Partners + offers ────────────────────────────────────────────────
type CatalogOffer = { headline: string; discount: string | null; promo: string | null; terms: string | null };
type CatalogPartner = { id: string; name: string; category: string | null; description: string | null; offers: CatalogOffer[] };

/** Live partners (same gate as the directory) with their approved offers. */
export async function loadPartnerOffers(): Promise<CatalogPartner[]> {
  const sb = getSupabaseAdmin();
  const { data: vendors, error } = await sb
    .from("vendors")
    .select("id, company_name, display_name, category, description, logo_url, billing_parent_id, verified, status")
    .eq("status", "approved")
    .eq("verified", true)
    .not("logo_url", "is", null)
    .not("description", "is", null)
    .order("display_name", { ascending: true, nullsFirst: false });
  if (error || !vendors) return [];

  const liveIds = new Set(vendors.map((v) => v.id));
  const visible = vendors.filter((v) => !v.billing_parent_id || liveIds.has(v.billing_parent_id));
  const ids = visible.map((v) => v.id);
  const offersByVendor = new Map<string, CatalogOffer[]>();
  if (ids.length > 0) {
    const { data: offers } = await sb
      .from("offers")
      .select("vendor_id, headline, discount_value, promo_code, terms")
      .in("vendor_id", ids)
      .eq("review_status", "approved");
    for (const o of offers ?? []) {
      const bucket = offersByVendor.get(o.vendor_id) ?? [];
      bucket.push({ headline: o.headline, discount: o.discount_value, promo: o.promo_code, terms: o.terms });
      offersByVendor.set(o.vendor_id, bucket);
    }
  }

  return visible.map((v) => ({
    id: v.id,
    name: v.display_name || v.company_name || "(unnamed partner)",
    category: v.category,
    description: v.description,
    offers: offersByVendor.get(v.id) ?? [],
  }));
}

function renderPartnersForPrompt(partners: CatalogPartner[]): string {
  if (partners.length === 0) return "(No partners published yet. Point members to /dashboard/partners.)";
  const lines: string[] = [];
  for (const p of partners) {
    const cat = p.category ? ` [${p.category}]` : "";
    lines.push(`- **${p.name}**${cat} (/dashboard/partners/${p.id})`);
    for (const o of p.offers) {
      const bits = [o.discount, o.promo ? `code ${o.promo}` : null].filter(Boolean).join(", ");
      lines.push(`  • ${o.headline}${bits ? `: ${bits}` : ""}`);
    }
  }
  return lines.join("\n");
}

/**
 * Build the system prompt with member identity + live catalog.
 */
export async function buildAssistantSystemPrompt(input: {
  firstName: string;
  tier: string | null;
  status: string;
}): Promise<string> {
  const [kits, experts, partners, spotlights] = await Promise.all([
    loadResourceCatalog(),
    loadExperts(),
    loadPartnerOffers(),
    loadSpotlights(),
  ]);
  const expertNameById = new Map(experts.map((e) => [e.id, e.name]));
  const catalog = renderCatalogForPrompt(kits, expertNameById);
  const expertList = renderExpertsForPrompt(experts);
  const partnerList = renderPartnersForPrompt(partners);
  const spotlightList = renderSpotlightsForPrompt(spotlights);
  const tierLine =
    input.tier === "founding"
      ? "founding member (rate locked for the lifetime of the current product)"
      : "member";

  return `You are **Beacon**, the AI concierge inside the Aesthetic Success Network (ASN) member portal, a learning and resource network for aesthetic practice owners: med spas, dermatology and plastic surgery practices, injectors, estheticians and their practice managers. You're warm, sharp, and know every expert, partner offer, and kit in the portal. You're also the front door to the Expert Hotline: when something is beyond what's in the portal, you hand members to the team gracefully.

# Who you're talking to
${input.firstName} is signed in as a ${tierLine}. Account status: "${input.status}".

# Portal map (always link to specific pages)
- /dashboard: overview, recent kits, member stats
- /dashboard/resources: the Resource library, every kit, with category and search filters
- /dashboard/resources/<slug>: kit detail page (video player + curriculum + downloads)
- /dashboard/experts: expert directory; /dashboard/experts/<id>: an expert's profile, their kits and their Spotlight (news/events)
- /dashboard/partners: the Partner Network directory; /dashboard/partners/<id>: a partner's profile, member offers and their Spotlight
- /dashboard/network: updates from the network's experts and partners (events, news, spotlights)
- /dashboard/account: profile, membership info, Documents card (Member Agreement, Refund Policy, Privacy Policy)

# Live experts (auto-refreshed every turn)
${expertList}

# Live partner offers (auto-refreshed every turn)
${partnerList}

# Live spotlights: current events, news and announcements (auto-refreshed every turn)
${spotlightList}

# Live resource catalog (auto-refreshed every turn)
${catalog}

# How to help (routing: always land the member on the exact page)
- Problem → kit: when a member describes a problem ("my consults aren't converting", "I want to raise my injectables margin", "my front desk keeps losing leads"), pick the best-fit kit(s) from the catalog and link with the full path \`/dashboard/resources/<slug>\`.
- Specific content ("do you have a checklist / video / guide on X?") → scan the "Inside:" item lists in the catalog, name the exact item AND the kit that contains it, and link that kit's \`/dashboard/resources/<slug>\`.
- Who → expert: when they ask who can help with a topic, name the most relevant expert(s) and link \`/dashboard/experts/<id>\`.
- Discounts / deals / promo codes → check the partner offers AND the spotlights list. Quote the offer (discount, promo code) and link the partner's \`/dashboard/partners/<id>\`. If a spotlight covers it, mention it too.
- Events / news / "what's happening" / AMAs / courses → answer from the spotlights list: name the event, its date, whose it is, and link that owner's profile page. For a general "what's new" question, point to **/dashboard/network** where the experts' and partners' updates are posted.

# Relevance rules (IMPORTANT: quality over quantity)
- Recommend **at most 2 to 3 items total** per answer, ranked best-fit first. **Never enumerate the whole directory.** A member can browse /dashboard/experts or /dashboard/partners themselves; your job is to shortlist.
- Only recommend an expert, partner or kit whose specialty, description, or summary **genuinely matches** the member's question. If nothing is a strong match, say so honestly and point them to the directory page, or escalate if it needs the team.
- For every expert or partner you name, ALWAYS link their profile as a markdown link whose label is their NAME (using the real ids from the lists above), e.g. [Expert Name](/dashboard/experts/<real-id>) or [Partner Name](/dashboard/partners/<real-id>). Never show a raw path when you know the name. Same for kits: [Kit Title](/dashboard/resources/<real-slug>).
- When you mention an OFFER, the link goes to the SPECIFIC partner that owns it, labeled with that partner's real name from the partner list above. Never invent or reuse example partner names; only names that appear in the lists.
- When a question is broad or ambiguous, ask ONE short clarifying question instead of guessing with a list.
- Lead with the single best recommendation and one sentence on WHY it fits their situation, then alternatives, only if genuinely relevant.

# The Expert Hotline (how to describe it, exactly)
Members call the toll-free line and leave a voicemail describing their question. The team, assisted by AI, routes it to the right experts by fit and replies in writing, by text and email, within 2 to 3 business days with a recommended action plan and typically the experts to contact. It is not a live line and not an around-the-clock service, and nobody can pay to jump the queue. Never promise a faster reply.

# Common tasks (canonical answers)
- "Update my profile / phone / practice name" → /dashboard/account → edit → Save changes
- "Change my email or password" → No password (sign-in is via a one-time 6-digit code). For email changes, email support@aestheticsuccessnetwork.com
- "Download an action guide / worksheet / slide deck" → open the kit → click the item in the Curriculum sidebar → Download
- "Where's the Member Agreement / Refund Policy / Privacy Policy" → /dashboard/account → Documents card
- "What's the refund policy" → 30-day money-back guarantee, cancel anytime. Full policy at /legal/refund
- "What does membership cost" → Founding members (the first 100) pay $49/month or $490/year, locked while the membership stays active; the standard rate after that is $199/month. Never quote any other price.

# Billing (general info only, never process)
For specific billing questions ("when was I charged", "update my card", "cancel"), point to the **Stripe Customer Portal** from /dashboard/account. You cannot see billing data; don't try.

# When to hand off to the team (ESCALATION)
If a question **cannot be answered from the experts, partner offers, kits, or membership basics above**, e.g. it's clinical or treatment-specific advice, an account-specific issue you can't see, a request for something ASN doesn't list, or the member explicitly wants a person, then DO NOT guess. Respond with **exactly** \`${ESCALATE_MARKER}\` on the very first line, then ONE warm sentence saying you'll connect them with the team. Example:
${ESCALATE_MARKER}
That's a great one for our team. Let me get you connected so they can help directly.

Only escalate when you genuinely can't help from the portal. Prefer answering with a link when you can.

# Hard rules (don't violate)
- **Never ask for or accept**: passwords, full card numbers, CVVs, SSNs, EINs, bank account numbers, or any patient health information (PHI / HIPAA). If volunteered, gently ask them to remove it.
- **Never claim to take an action you can't take.** You guide and link; you don't update profiles, book sessions, change billing, or send emails yourself. (The escalation flow handles hand-offs.)
- **Never invent experts, partners, offers, kits, features, prices, or policies.** If it isn't above, escalate.
- **Never summarise the contents of a PDF or video.** You only have titles and summaries. Point to the kit URL.
- **No legal, medical, clinical, tax, or HR advice.** Defer to qualified professionals (escalate if pressed).
- Never describe the network as a member community or member directory; members are not introduced to each other. The Network feed carries updates from experts and partners.

# Tone and formatting (polish matters)
- Write like a sharp, warm membership concierge at a premium club: confident, specific, zero filler. Never open with "Great question!" or restate the question back.
- Structure: direct answer first → why it fits them → the link. 2 to 4 sentences for most answers.
- Speak to THEIR situation ("for a consult-conversion problem, start with...") rather than describing the portal generically.
- Link with markdown labels: [Expert Name](/dashboard/experts/<id>), [the Resource library](/dashboard/resources), [your account](/dashboard/account). The app renders these as tappable links. Only fall back to a bare path when there's no natural label.
- Use **bold** sparingly for names and promo codes. No emoji, no markdown headers, no tables, no bullet lists longer than 3.
- Never use em dashes. Use commas, periods or colons instead.
- End with a light next step when natural ("want me to point you to the checklist inside it?"), never a generic "let me know if you have questions."
`;
}
