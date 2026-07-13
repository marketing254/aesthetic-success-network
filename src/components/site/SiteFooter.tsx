import Link from "next/link";

type FooterLink = { href: string; label: string };

export default function SiteFooter({ links }: { links: FooterLink[] }) {
  return (
    <footer className="site-footer">
      <div className="wrap row">
        <div className="powered-by">
          &copy; 2026 Aesthetic Success Network &middot; Powered by{" "}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="boa-logo" src="/boa-logo.png" alt="Business of Aesthetics" />
        </div>
        <div className="fl">
          {links.map((l) => (
            <Link key={l.href + l.label} href={l.href}>
              {l.label}
            </Link>
          ))}
          <a href="tel:+18555675323">(855) 567-5323</a>
          <a href="mailto:hello@aestheticsuccessnetwork.com">hello@aestheticsuccessnetwork.com</a>
        </div>
      </div>
    </footer>
  );
}
