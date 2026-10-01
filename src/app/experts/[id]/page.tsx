import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isHiddenFromDirectory } from "@/lib/directoryVisibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /experts/[id]: PUBLIC profile page for an accepted expert, in the ASN
 * design. Data and gating are DMN's: only ACTIVE experts with a headshot and
 * a bio are public, and only public-safe fields are rendered (never email,
 * phone, billing, or the booking link, which is a member-portal benefit).
 * Kit titles are a public teaser; spotlights show kind + date only.
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

async function getExpert(id: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("experts")
    .select("id, display_name, full_name, specialty, company_name, bio, topics, website, headshot_url, status, email")
    .eq("id", id)
    .maybeSingle();
  // Same publish-ready gate as the directory: no headshot/bio -> not public.
  if (!data || data.status !== "active" || !data.headshot_url || !data.bio) return null;
  if (isHiddenFromDirectory(data.email)) return null;
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const expert = await getExpert(id).catch(() => null);
  if (!expert) return { title: "Expert not found", robots: { index: false } };
  const name = expert.display_name || expert.full_name || "ASN Expert";
  return {
    title: `${name}, ASN Expert`,
    description: String(expert.bio).slice(0, 160),
    alternates: { canonical: `/experts/${expert.id}` },
  };
}

export default async function PublicExpertProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expert = await getExpert(id);
  if (!expert) notFound();

  const sb = getSupabaseAdmin();

  // Kit titles only: a public teaser; the content stays members-only.
  const { data: kitRows } = await sb
    .from("resources")
    .select("topic_slug, topic_title")
    .eq("originating_expert_id", id)
    .eq("is_published", true)
    .eq("submission_status", "approved");
  const kits = [...new Map((kitRows ?? []).map((r) => [r.topic_slug, r.topic_title as string])).values()];

  // Spotlight teaser: kind + date ONLY. Titles and bodies stay members-only.
  const { data: spotRows } = await sb
    .from("profile_spotlights")
    .select("id, kind, event_date")
    .eq("expert_id", id)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(5);
  const spotlights = (spotRows ?? []).map((s) => ({
    id: s.id as string,
    kind: String(s.kind).charAt(0).toUpperCase() + String(s.kind).slice(1),
    dateLabel: s.event_date
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(s.event_date))
      : null,
  }));

  const name = expert.display_name || expert.full_name || "ASN Expert";
  const topics = String(expert.topics ?? "")
    .split(/[,\n;]+/)
    .map((t: string) => t.trim())
    .filter(Boolean);
  const bioParagraphs = String(expert.bio)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <SitePage>
      <SiteNav active="/experts" />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap" style={{ display: "block" }}>
          <div className="profile-head">
            <div className="profile-avatar">
              {expert.headshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={expert.headshot_url} alt={name} />
              ) : (
                initials(name)
              )}
            </div>
            <div>
              <span className="eyebrow">Network Expert</span>
              <h1 style={{ fontSize: 40 }}>{name}</h1>
              {expert.specialty || expert.company_name ? (
                <p className="sub" style={{ marginBottom: 0 }}>
                  {[expert.specialty, expert.company_name].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {topics.length > 0 && (
                <div className="profile-topics">
                  {topics.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <article className="profile-bio">
            {bioParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>

          {kits.length > 0 && (
            <div className="profile-section">
              <span className="kicker">Kits in the resource library</span>
              <div className="locked-list">
                {kits.map((k) => (
                  <div className="row" key={k}>
                    <span>{k}</span>
                    <span className="lk">Members only</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {spotlights.length > 0 && (
            <div className="profile-section">
              <span className="kicker">Recent spotlights</span>
              <div className="locked-list">
                {spotlights.map((s) => (
                  <div className="row" key={s.id}>
                    <span>
                      <span className="blur" aria-hidden>
                        Member-only spotlight content
                      </span>
                    </span>
                    <span className="lk">
                      {s.kind}
                      {s.dateLabel ? ` · ${s.dateLabel}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="profile-section">
            <span className="kicker">Book a meeting</span>
            <p className="lead" style={{ margin: "0 0 16px" }}>
              Booking {name} is a member benefit. Members reach the bench, the kits and every
              company deal from one login.
            </p>
            <div className="cta-row" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link className="btn bronze" href="/join/member">
                Start your membership
              </Link>
              {expert.website ? (
                <a className="btn ghost" href={expert.website} target="_blank" rel="noopener noreferrer">
                  Visit website
                </a>
              ) : null}
              <Link className="btn ghost" href="/experts">
                &larr; Back to all experts
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      <PageFx revealSelector="section .profile-bio, .profile-section" />
    </SitePage>
  );
}
