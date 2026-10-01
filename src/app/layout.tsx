import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Providers from "@/components/Providers";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import "./globals.css";
// ASN public-site design (scoped under `.asn-site`, layered below MUI).
// Loaded after globals.css so the portals keep DMN's globals untouched.
import "./site.css";

// ASN fonts: Inter for body, Fraunces (with italic + optical sizing) for
// display. The variables are the same names the MUI theme reads, so the
// portals pick them up too.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const SITE = "https://www.aestheticsuccessnetwork.com";

// Explicit viewport so every route (public site and portals) lays out at
// device width on phones. Next only injects a default when nothing is set.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Aesthetic Success Network | Every practice problem, answered in writing",
    template: "%s | Aesthetic Success Network",
  },
  description:
    "A membership network for aesthetic practice owners. The Expert Hotline returns a written action plan in 2 to 3 business days, vetted partners give you member-only deals, and new expert kits arrive weekly. Founding rate $29/mo, locked while your membership stays active.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Aesthetic Success Network",
    title: "Aesthetic Success Network: Every practice problem, answered in writing",
    description:
      "Expert Hotline with written action plans in 2 to 3 business days, member-only partner deals, a curated resource library with new kits weekly, and monthly live AMAs and CE. Founding rate $29/mo for the first 100 members.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Aesthetic Success Network",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aesthetic Success Network",
    description:
      "Expert Hotline, member-only partner deals, and the resource library aesthetic practice owners actually use.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  // Verification placeholders: set the real values from Google Search
  // Console + Bing Webmaster Tools in the environment after deploy.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
};

// Site-wide JSON-LD: Organization + WebSite. These are the two schemas
// Google + AI assistants consume first; pages can layer their own
// (FAQPage, Product, etc.) on top.
const ORG_AND_WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "Aesthetic Success Network",
      alternateName: "ASN",
      url: `${SITE}/`,
      logo: `${SITE}/asn-logo-full-dark.png`,
      sameAs: [],
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: "+1-855-567-5323",
          contactType: "customer support",
          email: "hello@aestheticsuccessnetwork.com",
          areaServed: "US",
          availableLanguage: "en",
        },
      ],
      description:
        "Membership network for aesthetic practice owners: an Expert Hotline with written action plans in 2 to 3 business days, member-only partner deals, a curated resource library of expert kits, and monthly live AMAs and CE.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: `${SITE}/`,
      name: "Aesthetic Success Network",
      publisher: { "@id": `${SITE}/#organization` },
      inLanguage: "en-US",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script below adds a "js" class to
    // <html> before React hydrates, which is expected to differ from the SSR HTML.
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        {/* Gate the ASN entrance motion on a `js` class so public-site content
            is always visible without JavaScript (pattern carried over from the
            static ASN site; see site.css and components/site/PageFx.tsx). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.className+=' js';",
          }}
        />
        {/* Site-wide JSON-LD. Page-specific schema layers on top of this. */}
        <script
          type="application/ld+json"
          // Inline so it's in the static HTML (not JS-injected) and crawlers
          // see it on first byte. "<" is escaped so a string value can never
          // close the script tag.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORG_AND_WEBSITE_JSONLD).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
