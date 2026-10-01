"use client";
import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { ArrowRight } from "lucide-react";

/**
 * Mobile-only sticky bottom bar: appears once the visitor scrolls past
 * the hero, and dismisses itself when the final CTA section (#pricing)
 * comes into view — the hero's one ask, always one glance away.
 */
export default function StickyMobileCTA() {
  const [pastHero, setPastHero] = useState(false);
  const [atPricing, setAtPricing] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    const pricing = document.getElementById("pricing");
    const observers: IntersectionObserver[] = [];
    if (hero) {
      const o = new IntersectionObserver(([e]) => setPastHero(!e!.isIntersecting), {
        threshold: 0.05,
      });
      o.observe(hero);
      observers.push(o);
    }
    if (pricing) {
      const o = new IntersectionObserver(([e]) => setAtPricing(e!.isIntersecting), {
        threshold: 0.15,
      });
      o.observe(pricing);
      observers.push(o);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const show = pastHero && !atPricing;

  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1100,
        display: { xs: "block", md: "none" },
        transform: show ? "translateY(0)" : "translateY(110%)",
        transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
        p: 1.25,
        pb: "max(10px, env(safe-area-inset-bottom))",
        bgcolor: "rgba(251,248,241,0.92)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid rgba(155,123,58,0.2)",
      }}
    >
      <Box
        component="a"
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.75,
          py: 1.4,
          borderRadius: 2,
          bgcolor: "#D9A84B",
          color: "#0A1A2F",
          fontWeight: 800,
          fontSize: "0.98rem",
          textDecoration: "none",
          boxShadow: "0 8px 24px -8px rgba(160,120,35,0.5)",
        }}
      >
        Start your membership <ArrowRight size={17} />
      </Box>
    </Box>
  );
}
