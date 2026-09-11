import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Resource Library",
  description:
    "A preview of the Aesthetic Success Network resource library: expert-built kits on pricing, staffing, marketing and compliance, added weekly for members.",
};

type KitTeaser = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  expert_name: string;
};

const CATEGORIES = [
  {
    title: "Pricing & Margins",
    body: "Worksheets and audit checklists for pricing injectables, devices and packages without guessing.",
  },
  {
    title: "Staffing & Hiring",
    body: "Interview guides, comp-plan templates and onboarding SOPs for injectors, estheticians and front desk.",
  },
  {
    title: "Marketing & Consults",
    body: "Consult scripts, ad-creative swipe files and referral-program templates that convert without pressure.",
  },
  {
    title: "Compliance & Operations",
    body: "State-by-state scope-of-practice notes, chart-audit checklists and vendor-vetting templates.",
  },
];

async function getPublishedKitTeasers(): Promise<KitTeaser[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_kits")
    .select("id, title, category, summary, expert_name")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(9);
  if (error) throw error;
  return (data ?? []) as KitTeaser[];
}

export default async function ResourcesPage() {
  let kits: KitTeaser[] = [];
  try {
    kits = await getPublishedKitTeasers();
  } catch (err) {
    console.error("[resources] failed to load kit teasers:", err);
  }

  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/resources", label: "Resources", active: true },
          { href: "/blog", label: "Blog" },
          { href: "/pricing", label: "Pricing" },
        ]}
        cta={{ href: "/#join", label: "Join the waitlist" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">Resource Library</span>
          <h1>
            New expert kits, <em>every week</em>.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            Training videos, action guides, checklists, worksheets and slide decks, built by
            working experts and matched to real practice problems. Full kits are a member
            benefit; here&rsquo;s a preview of what&rsquo;s inside.
          </p>
        </div>
      </header>

      <section id="categories">
        <div className="wrap center">
          <span className="kicker">What&rsquo;s in the library</span>
          <h2 className="title">
            Four categories. <em>Growing</em> every week.
          </h2>
          <div className="feature-grid--cards">
            {CATEGORIES.map((c) => (
              <div key={c.title} className="feat">
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap center">
          <span className="kicker">Latest kits</span>
          <h2 className="title">
            A preview of what&rsquo;s <em>live</em> right now.
          </h2>
          {kits.length === 0 ? (
            <p className="lead">
              The library is being built by our founding experts. New kits land weekly once the
              network opens &mdash; join the waitlist to get first access.
            </p>
          ) : (
            <div className="feature-grid--cards resource-grid">
              {kits.map((k) => (
                <div key={k.id} className="feat resource-card">
                  {k.category ? <span className="rc-kind">{k.category}</span> : null}
                  <h3>{k.title}</h3>
                  <p>{k.summary ?? "Training video, action guide and worksheet."}</p>
                  <span className="blog-readmore">By {k.expert_name} &middot; Members only</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="final" id="join">
        <div className="wrap">
          <h2>
            Unlock the full <em>library</em>.
          </h2>
          <p className="lead2">
            Every kit, every week, included with membership. Join the waitlist and pay nothing
            today.
          </p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <a className="btn bronze" href="/#join">
              Join the founding waitlist
            </a>
          </div>
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/blog", label: "Blog" },
          { href: "/tools", label: "Tools" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx
        revealSelector="section .kicker, h2.title, .lead, .feature-grid--cards .feat, .final h2, .final .lead2"
        grids={[".resource-grid"]}
      />
    </>
  );
}
