import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AS";
}

async function getExpert(id: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("expert_applications")
    .select("id, full_name, display_name, company, topics, bio, headshot_url, website, booking_link, status")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.status !== "approved" || !data.bio) return null;
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const expert = await getExpert(id).catch(() => null);
  if (!expert) return {};
  const name = (expert.display_name as string) || (expert.full_name as string);
  return { title: name, description: (expert.bio as string).slice(0, 160) };
}

export default async function ExpertProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expert = await getExpert(id);
  if (!expert) notFound();

  const name = (expert.display_name as string) || (expert.full_name as string) || "Network expert";
  const topics = ((expert.topics as string) ?? "")
    .split(/[,\n;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/experts", label: "For Experts", active: true },
          { href: "/partners", label: "For Partners" },
        ]}
        cta={{ href: "/experts#apply", label: "Apply as an expert" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap">
          <div className="profile-head">
            <div className="profile-avatar">
              {expert.headshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={expert.headshot_url as string} alt={name} />
              ) : (
                initials(name)
              )}
            </div>
            <div>
              <span className="eyebrow">Network Expert</span>
              <h1 style={{ fontSize: 40 }}>{name}</h1>
              {expert.company ? <p className="sub">{expert.company as string}</p> : null}
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
          <article className="legal-doc" style={{ maxWidth: 720 }}>
            <p>{expert.bio as string}</p>
          </article>

          <div className="cta-row" style={{ marginTop: 30 }}>
            {expert.booking_link ? (
              <a className="btn bronze" href={expert.booking_link as string} target="_blank" rel="noopener noreferrer">
                Book a meeting &rarr;
              </a>
            ) : null}
            {expert.website ? (
              <a className="btn ghost" href={expert.website as string} target="_blank" rel="noopener noreferrer">
                Visit website
              </a>
            ) : null}
            <Link className="btn ghost" href="/experts">
              &larr; Back to all experts
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/experts", label: "For Experts" },
          { href: "/partners", label: "For Partners" },
          { href: "/provider-agreement", label: "Provider Agreement" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx revealSelector="section .legal-doc, .cta-row" />
    </>
  );
}
