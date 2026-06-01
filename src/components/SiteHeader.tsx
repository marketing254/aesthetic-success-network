"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brand, navLinks } from "@/content";

function Logo() {
  return (
    <Link href="/" className="logo" aria-label={`${brand.name} · home`}>
      <span className="logo__mark" aria-hidden="true">
        ASN
      </span>
      <span className="logo__words">
        <span className="logo__name">Aesthetics Success Network</span>
        <span className="logo__sub">The aesthetic practice network</span>
      </span>
    </Link>
  );
}

function scrollToWaitlist(e: React.MouseEvent) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("waitlist");
  if (el) {
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function SiteHeader() {
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="nav2">
        <div className="nav2__inner">
          <Logo />

          {/* Pill cluster of nav links — one continuous rounded container */}
          <nav className="nav2__pill" aria-label="Primary">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                className="nav2__pill-link"
                href={l.href.startsWith("#") ? `/${l.href}` : l.href}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="nav2__right">
            <Link className="btn btn--gold nav2__cta" href="/#waitlist" onClick={scrollToWaitlist}>
              Join the waitlist
              <span className="nav2__arrow" aria-hidden="true">→</span>
            </Link>
            <span className="nav2__vendor">
              Already a vendor? <Link href="/#waitlist" onClick={scrollToWaitlist}>Sign in</Link>
            </span>
            <button
              type="button"
              className="nav2__burger"
              aria-label={drawer ? "Close menu" : "Open menu"}
              aria-expanded={drawer}
              data-open={drawer}
              onClick={() => setDrawer((v) => !v)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={`drawer${drawer ? " is-open" : ""}`} aria-hidden={!drawer}>
        <button
          type="button"
          className="drawer__scrim"
          aria-label="Close menu"
          tabIndex={drawer ? 0 : -1}
          onClick={() => setDrawer(false)}
        />
        <div className="drawer__panel" role="dialog" aria-label="Menu">
          <div className="drawer__head">
            <Logo />
            <button type="button" className="drawer__close" aria-label="Close menu" onClick={() => setDrawer(false)}>
              ✕
            </button>
          </div>
          <div className="drawer__card">
            <span className="eyebrow">Founding access</span>
            <p>
              Expert helpline, vendor savings, exclusive content, and a network of 500+ practice
              owners.
            </p>
          </div>
          <nav className="drawer__links" aria-label="Mobile">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                href={l.href.startsWith("#") ? `/${l.href}` : l.href}
                onClick={() => setDrawer(false)}
              >
                {l.label}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </nav>
          <Link
            className="btn btn--gold drawer__join"
            href="/#waitlist"
            onClick={(e) => {
              setDrawer(false);
              const el = document.getElementById("waitlist");
              if (el) {
                e.preventDefault();
                window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 280);
              }
            }}
          >
            Join the waitlist
          </Link>
          <Link className="btn btn--ghost drawer__signin" href="/#waitlist" onClick={() => setDrawer(false)}>
            Already a vendor? Sign in
          </Link>
        </div>
      </div>
    </>
  );
}
