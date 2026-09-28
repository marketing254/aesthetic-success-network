import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import JsonLd from "@/components/seo/JsonLd";
import { PUBLISHED_BLOG_ARTICLES, BLOG_INDEX_HEADING, BLOG_INDEX_STANDFIRST } from "@/lib/blog";

/**
 * /blog: the ASN blog index (phase-one holdback: not in the nav or the
 * sitemap). Fed by the in-repo registry in src/lib/blog.ts, which ships
 * empty; the page renders an honest "no articles yet" state and never
 * crashes on an empty list.
 */
const SITE = "https://www.aestheticsuccessnetwork.com";

export const metadata: Metadata = {
  title: "Blog: Aesthetic Practice Growth, Operations and Leadership",
  description: BLOG_INDEX_STANDFIRST,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: `${BLOG_INDEX_HEADING} | Aesthetic Success Network`,
    description: BLOG_INDEX_STANDFIRST,
    url: `${SITE}/blog`,
    // Empty registry at launch: fall back to the site OG image.
    images: [PUBLISHED_BLOG_ARTICLES[0]?.hero.src ?? "/og-image.png"],
  },
};

const BLOG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "@id": `${SITE}/blog#blog`,
  url: `${SITE}/blog`,
  name: BLOG_INDEX_HEADING,
  description: BLOG_INDEX_STANDFIRST,
  publisher: { "@id": `${SITE}/#organization` },
  inLanguage: "en-US",
  blogPost: PUBLISHED_BLOG_ARTICLES.map((a) => ({
    "@type": "BlogPosting",
    "@id": `${SITE}/blog/${a.slug}#article`,
    headline: a.title,
    url: `${SITE}/blog/${a.slug}`,
  })),
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}

export default function BlogIndexPage() {
  const posts = PUBLISHED_BLOG_ARTICLES;
  return (
    <SitePage>
      <JsonLd data={BLOG_JSONLD} />
      <SiteNav />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">The Blog</span>
          <h1>
            Practice growth, <em>without</em> the fluff.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            {BLOG_INDEX_STANDFIRST}
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          {posts.length === 0 && (
            <p className="lead" style={{ margin: "0 auto", textAlign: "center" }}>
              No articles are published yet. The first approved articles will appear here; until
              then, the expert kits inside the membership are where the guidance lives.
            </p>
          )}
          {posts.length > 0 && (
            <div className="feature-grid--cards blog-grid" style={{ marginTop: 0 }}>
              {posts.map((post) => (
                <Link key={post.slug} className="feat blog-card" href={`/blog/${post.slug}`}>
                  <div className="blog-meta">
                    <span className="blog-cat">{post.category}</span>
                    <span className="blog-date">{formatDate(post.datePublished)}</span>
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <span className="blog-readmore">Read the article &rarr;</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="final" id="join">
        <div className="wrap">
          <h2>
            The full guidance lives <em>inside</em>.
          </h2>
          <p className="lead2">
            Every kit, the Expert Hotline and the partner deals, included with membership.
          </p>
          <div className="cta-row" style={{ display: "flex", justifyContent: "center" }}>
            <Link className="btn bronze" href="/join/member">
              Start your membership
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />

      <PageFx revealSelector="section .kicker, .feature-grid--cards .feat, .final h2, .final .lead2" grids={[".blog-grid"]} />
    </SitePage>
  );
}
