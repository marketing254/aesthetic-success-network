import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import JsonLd from "@/components/seo/JsonLd";
import { PUBLISHED_BLOG_ARTICLES, BLOG_CTA_LABEL, getBlogArticle, type BlogBlock } from "@/lib/blog";

const SITE = "https://www.aestheticsuccessnetwork.com";

/**
 * /blog/[slug]: one server-rendered page per approved article, in the ASN
 * design. Slugs, titles, descriptions and copy come verbatim from the
 * registry in src/lib/blog.ts (empty at launch, so every slug 404s until
 * the approver adds articles). Statically prerendered via
 * generateStaticParams; dynamicParams=false keeps unreleased slugs at 404.
 */
export function generateStaticParams() {
  return PUBLISHED_BLOG_ARTICLES.map((a) => ({ slug: a.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getBlogArticle(slug);
  if (!article) return {};
  return {
    title: { absolute: article.metaTitle },
    description: article.metaDescription,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.metaDescription,
      url: `${SITE}/blog/${article.slug}`,
      siteName: "Aesthetic Success Network",
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
      authors: [article.expert.name],
      images: [{ url: article.hero.src, alt: article.hero.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.metaTitle,
      description: article.metaDescription,
      images: [article.hero.src],
    },
  };
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}

/** Renders `**bold**` spans from approved support copy. */
function withBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
  );
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.kind) {
    case "p":
      return <p className={block.lead ? "lead-p" : undefined}>{block.text}</p>;
    case "h2":
      return <h2 id={block.id}>{block.text}</h2>;
    case "h3":
      return <h3>{block.text}</h3>;
    case "ul":
      return (
        <ul>
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol>
          {block.items.map((it, i) => (
            <li key={i}>
              {it.strong ? <b>{it.strong} </b> : null}
              {it.text}
            </li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote>
          {block.text}
          {block.cite ? <cite>{block.cite}</cite> : null}
        </blockquote>
      );
    case "formula":
      return (
        <div className="formula">
          {block.parts.map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getBlogArticle(slug);
  if (!article || article.published === false) notFound();

  const related = PUBLISHED_BLOG_ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);
  const toc = article.body.filter((b): b is Extract<BlogBlock, { kind: "h2" }> => b.kind === "h2");

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${SITE}/blog/${article.slug}#article`,
        headline: article.title,
        description: article.metaDescription,
        image: `${SITE}${article.hero.src}`,
        datePublished: article.datePublished,
        dateModified: article.dateModified,
        inLanguage: "en-US",
        // The ASN editorial team writes the article; the expert's guidance is
        // the source. Never mark the expert as author (brief rule).
        author: {
          "@type": "Organization",
          name: "Aesthetic Success Network editorial team",
          url: SITE,
        },
        mentions: {
          "@type": "Person",
          name: article.expert.name,
          jobTitle: article.expert.role,
          ...(article.expert.profileHref ? { url: `${SITE}${article.expert.profileHref}` } : {}),
        },
        publisher: { "@id": `${SITE}/#organization` },
        mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/blog/${article.slug}` },
        isPartOf: { "@id": `${SITE}/blog#blog` },
        articleSection: article.category,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
          { "@type": "ListItem", position: 3, name: article.title, item: `${SITE}/blog/${article.slug}` },
        ],
      },
      ...(article.faqs && article.faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              "@id": `${SITE}/blog/${article.slug}#faq`,
              mainEntity: article.faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <SitePage>
      <JsonLd data={jsonld} />
      <SiteNav />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">{article.category}</span>
          <h1>{article.title}</h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            {article.dek}
          </p>
          <div className="blog-byline">
            {article.expert.headshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.expert.headshotUrl} alt={article.expert.name} />
            ) : null}
            <span>
              With{" "}
              {article.expert.profileHref ? (
                <Link href={article.expert.profileHref} style={{ textDecoration: "underline" }}>
                  {article.expert.name}
                </Link>
              ) : (
                article.expert.name
              )}
              , {article.expert.role} &middot; {formatDate(article.datePublished)} &middot;{" "}
              {article.readTime}
            </span>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          {article.hero.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="blog-hero-img" src={article.hero.src} alt={article.hero.alt} />
          ) : null}
          <article className="legal-doc blog-article" style={{ padding: 0 }}>
            {article.quickAnswer ? (
              <div className="quick-answer">
                <div className="tag">Quick answer</div>
                <p style={{ margin: 0 }}>{article.quickAnswer}</p>
              </div>
            ) : null}
            {toc.length > 1 ? (
              <nav className="blog-toc" aria-label="In this article">
                <div className="tag">In this article</div>
                {toc.map((h) => (
                  <a key={h.id} href={`#${h.id}`}>
                    {h.toc}
                  </a>
                ))}
              </nav>
            ) : null}
            {article.body.map((b, i) => (
              <Block key={i} block={b} />
            ))}

            {article.faqs && article.faqs.length > 0 ? (
              <div className="faq" style={{ marginTop: 34 }}>
                <h2>Frequently asked questions</h2>
                {article.faqs.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            ) : null}

            <div className="quick-answer" style={{ marginTop: 34 }}>
              <div className="tag">{article.takeaway.eyebrow}</div>
              <h3 style={{ margin: "0 0 8px" }}>{article.takeaway.title}</h3>
              <p style={{ margin: 0 }}>{article.takeaway.body}</p>
            </div>

            <div className="invite-box" style={{ margin: "26px 0 0", maxWidth: "none" }}>
              <span className="kicker">The kit</span>
              <h3 style={{ margin: "8px 0 6px" }}>{article.kitCta.kitName}</h3>
              <p style={{ marginBottom: 14 }}>{article.kitCta.description}</p>
              {article.kitCta.support ? (
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
                  {withBold(article.kitCta.support)}
                </p>
              ) : null}
              <Link className="btn bronze" href={article.kitCta.href}>
                {article.kitCta.label ?? BLOG_CTA_LABEL}
              </Link>
            </div>
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
                    <span className="blog-cat">{r.category}</span>
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

      <SiteFooter />

      <PageFx revealSelector="section .kicker, h2.title, .feature-grid--cards .feat" />
    </SitePage>
  );
}
