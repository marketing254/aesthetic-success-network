"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Public-site navigation (ASN plain-CSS design).
 *
 * Links follow the ASN canon (section 6): What is ASN, Experts,
 * Companies, Reviews, Pricing, FAQ. "Sign in" opens a small menu with the
 * three DMN portals (member / expert / vendor logins). The primary CTA
 * starts the DMN member signup flow at /join/member.
 *
 * Below 1080px the links collapse behind a hamburger into a panel that
 * lists the same links, the three sign-in links and the CTA.
 */
export const NAV_LINKS = [
  { href: "/#inside", label: "What is ASN", match: "/" },
  { href: "/experts", label: "Experts", match: "/experts" },
  { href: "/companies", label: "Companies", match: "/companies" },
  { href: "/pricing", label: "Pricing", match: "/pricing" },
  { href: "/#math", label: "The math", match: "" },
  { href: "/#faq", label: "FAQ", match: "" },
] as const;

export const SIGN_IN_LINKS = [
  { href: "/member/login", label: "Members", sub: "Aesthetic practice owners and practitioners" },
  { href: "/expert/login", label: "Experts", sub: "Coaches, consultants and educators" },
  { href: "/vendor/login", label: "Companies", sub: "Vendors and service providers" },
] as const;


export default function SiteNav({ active }: { active?: string }) {
  const pathname = usePathname() ?? "";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [signinOpen, setSigninOpen] = useState(false);
  const signinRef = useRef<HTMLDivElement | null>(null);

  // Close both menus whenever the route changes (covers navigations that
  // don't go through a link's onClick, e.g. back/forward). State is
  // adjusted during render on a pathname change rather than in an effect,
  // so there is no extra committed frame with the menu still open.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
    setSigninOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menus on Escape and on an outside click.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSigninOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (signinRef.current && !signinRef.current.contains(e.target as Node)) setSigninOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const isActive = (l: (typeof NAV_LINKS)[number]) => {
    if (active) return active === l.href || active === l.match;
    return l.match !== "" && (l.match === "/" ? pathname === "/" && l.href === "/#inside" : pathname.startsWith(l.match));
  };

  return (
    <nav className={`site-nav${scrolled ? " scrolled" : ""}${open ? " open" : ""}`}>
      <div className="wrap row">
        <Link href="/" className="brand" aria-label="Aesthetic Success Network home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand-logo"
            src="/asn-nav-icon.png"
            alt="Aesthetic Success Network"
            width={44}
            height={44}
          />
          <span className="brand-name">
            <span className="brand-name-main">Aesthetic Success Network</span>
            <span className="brand-name-sub">Powered by Business of Aesthetics</span>
          </span>
        </Link>

        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={isActive(l) ? "active" : undefined}>
              {l.label}
            </Link>
          ))}
          <div className={`nav-signin${signinOpen ? " is-open" : ""}`} ref={signinRef}>
            <button
              type="button"
              className="signin-btn"
              aria-haspopup="menu"
              aria-expanded={signinOpen}
              onClick={() => setSigninOpen((v) => !v)}
            >
              Sign in <span className="chev" aria-hidden />
            </button>
            {signinOpen && (
              <div className="signin-menu" role="menu">
                <span className="sm-label">Choose your portal</span>
                {SIGN_IN_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} role="menuitem" onClick={() => setSigninOpen(false)}>
                    <b>{l.label}</b>
                    <span>{l.sub}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="nav-mobile">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={isActive(l) ? "active" : undefined} onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
        <span className="nm-label">Sign in</span>
        {SIGN_IN_LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
