import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getPublishedPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Straight-talk articles on pricing, staffing, marketing and operations for aesthetic practice owners, from the Aesthetic Success Network team and its experts.",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}

export default async function BlogIndexPage() {
  let posts: Awaited<ReturnType<typeof getPublishedPosts>> = [];
  let loadFailed = false;
  try {
    posts = await getPublishedPosts();
  } catch (err) {
    console.error("[blog] failed to load posts:", err);
    loadFailed = true;
  }

  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/blog", label: "Blog", active: true },
          { href: "/resources", label: "Resources" },
          { href: "/pricing", label: "Pricing" },
        ]}
        cta={{ href: "/#join", label: "Join the waitlist" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">The Blog</span>
          <h1>
            Practice growth, <em>without</em> the fluff.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            Pricing, staffing, marketing and operations articles written for owners who are
            actually running a practice, not chasing another framework.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          {loadFailed && (
            <p className="lead" style={{ margin: "0 0 24px" }}>
              We couldn&rsquo;t load the blog right now. Please check back shortly.
            </p>
          )}
          {!loadFailed && posts.length === 0 && (
            <p className="lead" style={{ margin: "0 0 24px" }}>
              New articles are coming soon. Join the waitlist and we&rsquo;ll let you know when the
              first one lands.
            </p>
          )}
          <div className="feature-grid--cards blog-grid">
            {posts.map((post) => (
              <Link key={post.slug} className="feat blog-card" href={`/blog/${post.slug}`}>
                <div className="blog-meta">
                  {post.category ? <span className="blog-cat">{post.category}</span> : null}
                  {formatDate(post.publishedAt) ? (
                    <span className="blog-date">{formatDate(post.publishedAt)}</span>
                  ) : null}
                </div>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <span className="blog-readmore">Read the article &rarr;</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/resources", label: "Resources" },
          { href: "/pricing", label: "Pricing" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx revealSelector="section .kicker, .feature-grid--cards .feat" grids={[".blog-grid"]} />
    </>
  );
}
