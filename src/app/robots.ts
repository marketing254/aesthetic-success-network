import type { MetadataRoute } from "next";

const SITE = "https://www.aestheticsuccessnetwork.com";

/**
 * Next.js auto-generates /robots.txt from this file.
 *
 * Strategy:
 *  - All search + AI crawlers can index public marketing pages.
 *  - Logged-in portals (/dashboard, /admin, /vendor/*, /expert/*, /seeker)
 *    are disallowed: they require auth, contain no SEO value, and would
 *    only ever return redirects to the relevant login page.
 *  - robots.txt Disallow is a prefix match, so the portal entries use a
 *    trailing slash ("/vendor/", "/expert/"). A bare "/expert" would also
 *    match the public /experts directory and block it. Same for
 *    "/companies" vs "/vendor/" (different words, but kept explicit).
 *  - We explicitly allow modern AI crawlers (GPTBot, ClaudeBot,
 *    PerplexityBot, Google-Extended, ChatGPT-User, anthropic-ai) because
 *    we want citation in LLM answers. A crawler that matches a named group
 *    ignores the "*" group, so each named group carries the same
 *    disallow list.
 *  - We block the training-only crawler CCBot (Common Crawl): it feeds
 *    dataset builders rather than search engines, so blocking it preserves
 *    training opt-out without losing search citation.
 */
const DISALLOW = [
  "/api/",
  "/admin",
  "/admin/",
  "/dashboard",
  "/dashboard/",
  "/vendor/",
  "/expert/",
  "/upgrade",
  "/auth/",
  "/member/login",
  "/seeker",
  "/seeker/",
];

const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default rule, everyone else
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      // Explicitly allow AI search bots so they can cite us, with the same
      // portal disallows as the default group.
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW,
      })),
      // Block training-only crawlers (no citation upside)
      { userAgent: "CCBot", disallow: "/" },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
