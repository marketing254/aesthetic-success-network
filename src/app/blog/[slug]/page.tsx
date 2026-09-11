import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getPostBySlug, getRelatedPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let post;
  try {
    post = await getPostBySlug(slug);
  } catch {
    return {};
  }
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : undefined,
    },
  };
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(slug, 3);
  const paragraphs = post.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/blog", label: "Blog", active: true },
          { href: "/resources", label: "Resources" },
        ]}
        cta={{ href: "/#join", label: "Join the waitlist" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          {post.category ? <span className="eyebrow">{post.category}</span> : null}
          <h1>{post.title}</h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            {post.excerpt}
          </p>
          <div className="micro" style={{ justifyContent: "center" }}>
            <span>{post.authorName}</span>
            {formatDate(post.publishedAt) ? <span>{formatDate(post.publishedAt)}</span> : null}
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <article className="legal-doc blog-article">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>
        </div>
      </section>

      {related.length > 0 && (
        <section style={{ paddingTop: 0 }}>
          <div className="wrap center">
            <span className="kicker">Keep reading</span>
            <h2 className="title">More from the blog</h2>
            <div className="feature-grid--cards" style={{ marginTop: 34 }}>
              {related.map((r) => (
                <Link key={r.slug} className="feat blog-card" href={`/blog/${r.slug}`}>
                  <div className="blog-meta">
                    {r.category ? <span className="blog-cat">{r.category}</span> : null}
                  </div>
                  <h3>{r.title}</h3>
                  <p>{r.excerpt}</p>
                  <span className="blog-readmore">Read the article &rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter
        links={[
          { href: "/blog", label: "Blog" },
          { href: "/pricing", label: "Pricing" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx revealSelector="section .kicker, h2.title, .blog-article p, .feature-grid--cards .feat" />
    </>
  );
}
