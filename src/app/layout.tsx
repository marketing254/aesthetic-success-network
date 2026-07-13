import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://aestheticsuccessnetwork.com"),
  title: {
    default: "Aesthetic Success Network | Every practice problem, answered in writing",
    template: "%s | Aesthetic Success Network",
  },
  description:
    "A membership for aesthetic practice owners: the Expert Hotline (written action plans in 2–3 business days), exclusive vetted-vendor deals, and a growing library of expert kits. Powered by Business of Aesthetics.",
  openGraph: {
    type: "website",
    siteName: "Aesthetic Success Network",
    title: "Aesthetic Success Network | Every practice problem, answered in writing",
    description:
      "The Expert Hotline, member-only vendor deals, and a growing library of expert kits, all in one membership for aesthetic practice owners.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the inline script below adds a "js" class to
    // <html> before React hydrates, which is expected to differ from the SSR HTML.
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        {/* Gate entrance motion on a `js` class so content is always visible
            without JavaScript (pattern carried over from the static site). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.className+=' js';",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
