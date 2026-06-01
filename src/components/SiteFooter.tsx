import Link from "next/link";
import Brand from "./Brand";
import { brand, footer, footerLinks } from "@/content";

/** Ft1 · Mast-headed footer. */
export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__top">
          <div className="footer__brand">
            <Brand showPill={false} />
            <p>{footer.brandDescription}</p>
            <div className="footer__actions">
              <Link className="btn btn--on-slab" href="/#waitlist">
                {footer.primaryCta}
              </Link>
              <a className="btn btn--ghost-on-slab" href={`mailto:${brand.email}`}>
                {footer.secondaryCta}
              </a>
            </div>
          </div>
          <div className="footer__cols">
            {Object.entries(footerLinks).map(([group, links]) => (
              <div className="footer__col" key={group}>
                <h4>{group}</h4>
                <ul>
                  {links.map((l) => (
                    <li key={l.label}>
                      {l.href.startsWith("#") ? (
                        <Link href={`/${l.href}`}>{l.label}</Link>
                      ) : (
                        <Link href={l.href}>{l.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="footer__bottom">
          <span>{footer.copyright}</span>
          <span>{footer.dataNote}</span>
        </div>
      </div>
    </footer>
  );
}
