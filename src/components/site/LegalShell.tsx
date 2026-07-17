import Link from "next/link";

type FooterLink = { href: string; label: string };

/**
 * Shared frame for the legal/draft documents — topbar, DRAFT banner,
 * document column, footer. Content goes in as children.
 */
export default function LegalShell({
  title,
  meta,
  footerLinks,
  children,
}: {
  title: string;
  meta: string;
  footerLinks: FooterLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="legal-body">
      <div className="legal-topbar">
        <div className="in">
          <Link className="legal-brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="brandmark"
              src="/asn-nav-icon.png"
              alt="Aesthetic Success Network"
              width={34}
              height={34}
            />
            <span className="bt">
              Aesthetic Success Network
              <span>Powered by Business of Aesthetics</span>
            </span>
          </Link>
          <Link className="back" href="/">
            &larr; Back to the site
          </Link>
        </div>
      </div>

      <div className="legal-doc">
        <h1>{title}</h1>
        <div className="meta">{meta}</div>
        {children}
      </div>

      <footer className="legal-footer">
        &copy; 2026 Aesthetic Success Network &middot; Ekwa Marketing Inc. &middot; Powered by
        Business of Aesthetics
        {footerLinks.map((l) => (
          <span key={l.href}>
            {" "}
            &middot; <Link href={l.href}>{l.label}</Link>
          </span>
        ))}
      </footer>
    </div>
  );
}
