"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NavLink = { href: string; label: string; active?: boolean };

export default function SiteNav({
  links,
  cta,
}: {
  links: NavLink[];
  cta: { href: string; label: string };
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`site-nav${scrolled ? " scrolled" : ""}`}>
      <div className="wrap row">
        <Link href="/" className="brand" aria-label="Aesthetic Success Network home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/asn-logo.png" alt="Aesthetic Success Network" />
        </Link>
        <div className="nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={l.active ? "active" : undefined}>
              {l.label}
            </Link>
          ))}
          <Link className="btn solid" href={cta.href}>
            {cta.label}
          </Link>
        </div>
      </div>
    </nav>
  );
}
