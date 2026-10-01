import Link from "next/link";

/**
 * Public-site footer (ASN plain-CSS design, dark band).
 *
 * Columns follow the ASN canon (section 6): Network, Agreements, Legal.
 * The brand column carries the "Powered by Business of Aesthetics" lockup,
 * the tracked phone number and the general inbox. No em dashes.
 */
const NETWORK = [
  { href: "/#inside", label: "What is ASN?" },
  { href: "/experts", label: "Experts" },
  { href: "/companies", label: "Companies" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#math", label: "The math" },
  { href: "/#faq", label: "FAQ" },
];

const AGREEMENTS = [
  { href: "/agreement/member", label: "Member Agreement" },
  { href: "/agreement/provider", label: "Provider Agreement" },
];

const LEGAL = [
  { href: "/legal/refund", label: "Refund & Cancellation Policy" },
  { href: "/legal/privacy", label: "Privacy Policy" },
];

function Column({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="fcol">
      <h4>{title}</h4>
      {links.map((l) => (
        <Link key={l.href + l.label} href={l.href}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <div className="powered-by">
              Powered by{" "}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="boa-logo"
                src="/boa-logo.png"
                alt="Business of Aesthetics"
                width={63}
                height={30}
                loading="lazy"
                decoding="async"
              />
            </div>
            <p>
              A membership for aesthetic practice owners: the Expert Hotline with a written action
              plan in 2 to 3 business days, member-only company deals, and a curated resource
              library of expert kits.
            </p>
            <div className="foot-contact">
              <a href="tel:+18555675323">(855) 567-5323</a>
              <a href="mailto:hello@aestheticsuccessnetwork.com">hello@aestheticsuccessnetwork.com</a>
            </div>
          </div>
          <Column title="Network" links={NETWORK} />
          <Column title="Agreements" links={AGREEMENTS} />
          <Column title="Legal" links={LEGAL} />
        </div>
        <div className="foot-bottom">
          <span>&copy; 2026 Aesthetic Success Network &middot; Powered by Business of Aesthetics</span>
          <span className="note">
            We do not store patient data. The Aesthetic Success Network is a training, education and
            business-services platform.
          </span>
        </div>
      </div>
    </footer>
  );
}
