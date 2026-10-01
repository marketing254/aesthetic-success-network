import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DM_Sans, Libre_Caslon_Display } from "next/font/google";
import SummitLandingView from "@/components/events/SummitLandingView";
import { SUMMIT, SUMMIT_ENABLED } from "@/lib/events/summit";
import "./summit.css";

/**
 * /summit — the ASN summit landing page (paid-ads), placeholder until an
 * event exists. The route 404s unless SUMMIT_ENABLED === "true"; it is not
 * linked from the site or the sitemap.
 *
 * Campaign parameters are read in the browser, and nothing touches the
 * database until a visitor submits the form. noindex: a paid-traffic
 * conversion page, per the brief.
 */
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--summit-sans", display: "swap" });
const serif = Libre_Caslon_Display({ subsets: ["latin"], weight: "400", variable: "--summit-serif", display: "swap" });

export const metadata: Metadata = {
  title: `${SUMMIT.title} and ASN Membership Trial | Aesthetic Success Network`,
  description: `${SUMMIT.subtitle}. Included with a 30-day Aesthetic Success Network membership trial.`,
  robots: { index: false, follow: false },
  openGraph: {
    title: `${SUMMIT.title}: live summit, ${SUMMIT.dateLabel}`,
    description: `${SUMMIT.subtitle}. Included with a 30-day ASN membership trial.`,
    type: "website",
  },
};

export default function SummitPage() {
  if (!SUMMIT_ENABLED) notFound();
  return (
    <div className={`summit ${sans.variable} ${serif.variable}`}>
      <SummitLandingView event={{ title: SUMMIT.title, subtitle: SUMMIT.subtitle, dateLabel: SUMMIT.dateLabel, timeLabel: SUMMIT.timeLabel }} />
    </div>
  );
}
