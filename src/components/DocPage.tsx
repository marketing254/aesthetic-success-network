import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import Reveal from "./Reveal";
import type { DocPageData } from "@/docs";

export default function DocPage({ data }: { data: DocPageData }) {
  return (
    <div className="shell">
      <SiteHeader />
      <main>
        <article className="doc wrap">
          <Reveal className="doc__hero">
            <span className="eyebrow">{data.badge}</span>
            <h1>{data.title}</h1>
            <p className="doc__tagline">{data.tagline}</p>
            <p className="doc__intro">{data.intro}</p>
            <div className="doc__meta">
              <span>
                Effective <b>{data.effectiveDate}</b>
              </span>
              <span>
                Updated <b>{data.lastUpdated}</b>
              </span>
            </div>
          </Reveal>

          <Reveal className="doc__terms" as="dl">
            {data.keyTerms.map((t) => (
              <div className="doc__term" key={t.label}>
                <div className="k">{t.label}</div>
                <div className="v">{t.value}</div>
                <div className="s">{t.sub}</div>
              </div>
            ))}
          </Reveal>

          <div className="doc__body">
            <div className="doc__sticky">{data.title}</div>
            <div className="doc__sections">
              {data.sections.map((s) => (
                <Reveal className="doc__section" key={s.number}>
                  <span className="n">{s.number}</span>
                  <div>
                    <h2>{s.title}</h2>
                    {s.body && <p>{s.body}</p>}
                    {s.items && (
                      <ul>
                        {s.items.map((it) => (
                          <li key={it}>{it}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Reveal>
              ))}
              <p className="doc__footnote">{data.footnote}</p>
            </div>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
