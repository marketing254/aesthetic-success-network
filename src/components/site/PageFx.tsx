"use client";

import { useEffect } from "react";

/**
 * Ports the static site's entrance/scroll/line-art behavior 1:1:
 *  - hero elements fade in with a staggered delay (forced reflow, no rAF)
 *  - sections get a `.reveal` class and an IntersectionObserver adds `.in`
 *  - SVG line-art paths with `.draw` animate stroke-dashoffset, with a
 *    setTimeout fallback so the art can never stay hidden
 *  - respects prefers-reduced-motion
 *
 * `revealSelector` / `grids` mirror each HTML page's original script.
 */
export default function PageFx({
  revealSelector,
  grids = [],
  gridDelay = 0.08,
}: {
  revealSelector: string;
  grids?: string[];
  gridDelay?: number;
}) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── SVG line-art draw ──────────────────────────────────────────
    function draw(scope: Element) {
      const paths = Array.prototype.slice.call(
        scope.querySelectorAll(".draw"),
      ) as (SVGGeometryElement & HTMLElement)[];
      paths.forEach((p, i) => {
        let len = 600;
        try {
          len = p.getTotalLength();
        } catch {
          /* keep fallback */
        }
        if (reduce) {
          p.style.strokeDasharray = "none";
          p.style.strokeDashoffset = "0";
          return;
        }
        p.style.strokeDasharray = String(len);
        p.style.strokeDashoffset = String(len);
        p.getBoundingClientRect();
        p.style.transition = `stroke-dashoffset 1.7s cubic-bezier(.22,.61,.36,1) ${i * 0.1}s`;
        p.style.strokeDashoffset = "0";
        setTimeout(() => {
          p.style.transition = "none";
          p.style.strokeDashoffset = "0";
        }, 2600 + i * 120);
      });
    }

    const portrait = document.getElementById("portrait");
    if (portrait) draw(portrait);

    const arts = Array.prototype.slice.call(document.querySelectorAll(".articon")) as Element[];
    let artIo: IntersectionObserver | null = null;
    if (arts.length) {
      if (reduce) {
        arts.forEach(draw);
      } else {
        artIo = new IntersectionObserver(
          (es) => {
            es.forEach((e) => {
              if (e.isIntersecting) {
                draw(e.target);
                artIo?.unobserve(e.target);
              }
            });
          },
          { threshold: 0.3 },
        );
        arts.forEach((s) => artIo?.observe(s));
      }
    }

    if (reduce) return;

    // ── Hero entrance ──────────────────────────────────────────────
    const heroEls = Array.prototype.slice.call(
      document.querySelectorAll(
        ".hero .eyebrow,.hero h1,.hero .sub,.hero .cta-row,.hero .micro,.hero .hero-count,.hero-art",
      ),
    ) as HTMLElement[];
    heroEls.forEach((el, i) => {
      el.style.transitionDelay = `${0.06 + i * 0.1}s`;
    });
    void document.body.offsetWidth;
    heroEls.forEach((el) => el.classList.add("in"));

    // ── Scroll reveal ──────────────────────────────────────────────
    const els = Array.prototype.slice.call(
      document.querySelectorAll(revealSelector),
    ) as HTMLElement[];
    els.forEach((el) => el.classList.add("reveal"));
    grids.forEach((g) => {
      const grid = document.querySelector(g);
      if (!grid) return;
      Array.prototype.slice.call(grid.children).forEach((c, i) => {
        (c as HTMLElement).style.transitionDelay = `${i * gridDelay}s`;
      });
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      artIo?.disconnect();
    };
  }, [revealSelector, grids, gridDelay]);

  return null;
}
