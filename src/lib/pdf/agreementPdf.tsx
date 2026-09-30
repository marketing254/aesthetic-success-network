import "server-only";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";

/**
 * ASN Provider Agreement PDF — server-only.
 *
 * ASN uses ONE Provider Agreement for experts, partners and providers who
 * hold both capabilities (text ported from _asn-source-copy/
 * provider-agreement.html). The role only changes the title line and
 * whether the personalized member offer is printed.
 *
 * Renders the signed agreement as a real PDF (not HTML masquerading as
 * one) so the file works in email attachments, downloads, and legal
 * review. Called from /api/join/partner, /api/join/expert and the portal
 * trial-start routes after Stripe confirms the subscription creation. The
 * buffer is uploaded to the `agreements` storage bucket and the path
 * stored on the vendors/experts row.
 */

// Bundled fonts would need to ship with the deploy — we stay on the
// built-in Helvetica family so the PDF has zero external asset deps.
Font.registerHyphenationCallback((word) => [word]);

const BRAND = {
  name: "Aesthetic Success Network",
  short: "ASN",
  entity: "Ekwa Marketing Inc.",
  legalLine: "Aesthetic Success Network, operated by Ekwa Marketing Inc.",
  poweredBy: "Powered by Business of Aesthetics",
  host: "aestheticsuccessnetwork.com",
  agreementUrl: "aestheticsuccessnetwork.com/agreement/provider",
  contactEmail: "hello@aestheticsuccessnetwork.com",
  phone: "(855) 567-5323",
  logoFile: "asn-logo-full-white.png",
} as const;

const COLORS = {
  ink: "#0A1A2F",
  inkSoft: "#3B4A55",
  muted: "#5C6770",
  gold: "#A07823",
  goldTint: "#F7EED9",
  line: "#D8D2C1",
} as const;

// ASN brand lockup, embedded as a data URI so the PDF has zero external
// asset dependency (works in email attachments + offline legal review).
// Read once per server process from /public. Falls back to the text
// wordmark if the file is missing so PDF generation never hard-fails.
let LOGO_DATA_URL: string | null | undefined;
function getLogoDataUrl(): string | null {
  if (LOGO_DATA_URL !== undefined) return LOGO_DATA_URL;
  try {
    const file = path.join(process.cwd(), "public", BRAND.logoFile);
    const b64 = fs.readFileSync(file).toString("base64");
    LOGO_DATA_URL = `data:image/png;base64,${b64}`;
  } catch {
    LOGO_DATA_URL = null;
  }
  return LOGO_DATA_URL;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: COLORS.inkSoft,
    lineHeight: 1.5,
    padding: 48,
    paddingTop: 56,
  },
  header: {
    marginBottom: 24,
    borderBottom: `2 solid ${COLORS.gold}`,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 44,
    height: 44,
    marginRight: 10,
    objectFit: "contain",
  },
  wordmark: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    letterSpacing: 4,
  },
  wordmarkSub: {
    fontSize: 7,
    color: COLORS.muted,
    letterSpacing: 2,
    marginTop: 2,
  },
  titleEyebrow: {
    fontSize: 8,
    color: COLORS.gold,
    letterSpacing: 3,
    marginTop: 22,
    fontFamily: "Helvetica-Bold",
  },
  title: {
    fontSize: 22,
    color: COLORS.ink,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    lineHeight: 1.15,
  },
  titleSub: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 4,
  },
  parties: {
    marginTop: 22,
    padding: 14,
    borderRadius: 4,
    backgroundColor: COLORS.goldTint,
    border: `1 solid ${COLORS.gold}`,
  },
  partyRow: { flexDirection: "row", marginBottom: 4 },
  partyLabel: {
    width: 90,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    fontSize: 9,
  },
  partyValue: { flex: 1, color: COLORS.ink, fontSize: 9 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: { marginBottom: 8 },
  commitmentRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  commitmentNumber: {
    width: 18,
    fontFamily: "Helvetica-Bold",
    color: COLORS.gold,
  },
  commitmentBody: { flex: 1 },
  commitmentTitle: {
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginBottom: 2,
  },
  bulletRow: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 12, color: COLORS.gold, fontFamily: "Helvetica-Bold" },
  bulletBody: { flex: 1 },
  feeRow: {
    flexDirection: "row",
    padding: 6,
    borderBottom: `1 solid ${COLORS.line}`,
  },
  feeRowHead: {
    flexDirection: "row",
    padding: 6,
    backgroundColor: "#F5F1E8",
    borderTop: `1 solid ${COLORS.line}`,
    borderBottom: `1 solid ${COLORS.line}`,
  },
  feeCol: { flex: 1, fontSize: 9 },
  feeColStrong: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
  },
  signatureBlock: {
    marginTop: 24,
    padding: 14,
    border: `1 solid ${COLORS.ink}`,
    borderRadius: 4,
  },
  signatureTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginBottom: 8,
  },
  signatureField: {
    flexDirection: "row",
    marginBottom: 4,
  },
  signatureLabel: {
    width: 90,
    fontSize: 9,
    color: COLORS.muted,
  },
  signatureValue: {
    flex: 1,
    fontSize: 9,
    color: COLORS.ink,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7,
    color: COLORS.muted,
    textAlign: "center",
    borderTop: `1 solid ${COLORS.line}`,
    paddingTop: 8,
  },
});

// Copy: the ASN Provider Agreement (Experts and Partners), ported from
// _asn-source-copy/provider-agreement.html with no em-dashes. Kept inline
// so the PDF has zero runtime dependency on the app's data files. If the
// public /agreement/provider page changes, update this too.
const PARTNER_COMMITMENTS = [
  {
    n: "1",
    title: "Best deal",
    body:
      "Offer ASN members an exclusive discount or benefit at least as good as any offer you make available to comparable customers. Improvements are welcome anytime; reductions require our written approval and notice to members.",
  },
  {
    n: "2",
    title: "Stay reachable",
    body: "Maintain a responsive presence and respond to member leads within one business day.",
  },
  {
    n: "3",
    title: "Booking link",
    body: "Supply and maintain a working booking link (for example Calendly or Cal.com).",
  },
  {
    n: "4",
    title: "Evolve with the network",
    body:
      "Accept term changes made with 30 days' advance notice; if a change materially reduces your benefits or increases your fees, you may terminate within the notice window with no further obligation.",
  },
  {
    n: "5",
    title: "Pay the fee",
    body:
      "$39 per month for months 1 to 12 (locked launch rate, first charge the day you add a card), then $149 per month from month 13 (Featured Partner rate).",
  },
];

const PARTNER_RECEIVES = [
  "A vetted partner profile with your logo and your member-exclusive offer, placed in your category.",
  "Pre-qualified lead routing with a dashboard and conversion data.",
  "The Verified Partner badge for your marketing (the license to use it ends when this agreement ends).",
  "Podcast, webinar, and co-marketing features across the Business of Aesthetics network.",
];

const EXPERT_TERMS = [
  "Experts share one recording (up to about one hour) of themselves teaching a topic, plus supporting details. We produce the content kit (training video, action guide, checklist, key takeaways, worksheet, slide deck, wall poster, and extras), and you approve it before it goes live under your profile. You keep ownership of your content and grant ASN a license to produce, host, and distribute the kits to members. Expert access pricing: $0 for months 1 to 6, then $39 per month, and it stays $39 per month for as long as your expert access remains continuously active.",
  "Paid courses: you may list your own paid courses to members. You keep 70% of net course revenue; the network retains 30%. Payouts are processed monthly. Hotline referrals are routed by fit, never by payment.",
];

const GENERAL_SECTIONS: { title: string; body: string }[] = [
  {
    title: "4. Fees and payment",
    body:
      "Invoices are due net 15. Fees are non-refundable except as stated in the Refund and Cancellation Policy. Late amounts may accrue up to 1.5% per month. Annual prepay earns two months free.",
  },
  {
    title: "5. Provider standards",
    body:
      "You confirm that you comply with applicable laws and professional standards, that you have the rights to any content and marks you provide, that you will support members responsively, and that you will avoid conduct that damages the network's brand or its members' trust.",
  },
  {
    title: "6. Confidentiality and member data",
    body:
      "Both parties protect the other's non-public information with reasonable care. Member contact details routed to you may be used only to respond to and service that lead. Selling member data or using it for unrelated marketing is prohibited, during and after the term.",
  },
  {
    title: "7. Changes to terms",
    body:
      "We may modify these terms with at least thirty (30) days' prior written notice. If a change materially reduces your benefits or increases your fees, you may terminate within the notice window with no further obligation.",
  },
  {
    title: "8. Term, renewal, and termination",
    body:
      "The initial term is 12 months from signup, renewing automatically for successive 12-month terms unless either party gives 30 days' non-renewal notice. Either party may terminate for convenience with 30 days' written notice. Either party may terminate immediately for a material breach that remains uncured 15 days after written notice, for insolvency, or for conduct that materially harms the network. On termination: the profile is removed, the badge license ends, and unpaid fees become due. Expert kits are unpublished from the member library; purchasers of paid courses retain access, and final course payouts are processed within 30 days.",
  },
  {
    title: "9. Disclaimers and liability",
    body:
      "We do not guarantee any specific number of leads, conversion rate, or revenue outcome. Neither party is liable for indirect or consequential damages or lost profits. Our cumulative liability is capped at the total fees you paid in the preceding 12 months. You indemnify ASN against third-party claims arising from your products, services, sales practices, or breach of this agreement.",
  },
  {
    title: "10. Miscellaneous",
    body:
      "The parties are independent contractors. No assignment without consent. This is the entire agreement; changes happen per Section 7 or by signed amendment. Electronic signatures are effective. This Agreement is governed by the laws of the Province of Ontario, Canada, and the federal laws of Canada applicable therein.",
  },
];

export type AgreementPdfInput = {
  role: "partner" | "expert" | "both";
  agreementVersion: string;
  signer: {
    name: string;
    email: string;
    companyName?: string | null;
  };
  // Personalized member offer (shown for partners / both). Founding
  // invites merge the noted offer here so the person reads their own
  // terms, not a blank.
  memberOffer?: string | null;
  signedAt: Date;
  ipHashLast6: string;
  // false → render as the personalized-but-unaccepted copy shown on the
  // invite page (signature block reads "Awaiting acceptance"). true →
  // the accepted receipt with the filled acceptance record.
  accepted?: boolean;
};

function roleLabelFor(role: AgreementPdfInput["role"]): string {
  if (role === "both") return "Expert and Partner";
  if (role === "partner") return "Partner";
  return "Expert";
}

function AgreementDoc({ input }: { input: AgreementPdfInput }) {
  const accepted = input.accepted !== false;
  const logoDataUrl = getLogoDataUrl();
  const roleLabel = roleLabelFor(input.role);
  const signedDate = input.signedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
  const showPartnerSections = input.role !== "expert";
  const showExpertSection = input.role !== "partner";

  return (
    <Document
      title={`${BRAND.short} Provider Agreement (${roleLabel}): ${input.signer.name}`}
      author={BRAND.name}
      creator={BRAND.host}
    >
      <Page size="LETTER" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            {logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoDataUrl} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.wordmark}>{BRAND.short}</Text>
              <Text style={styles.wordmarkSub}>{BRAND.name.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.titleEyebrow}>{roleLabel.toUpperCase()} · PROVIDER AGREEMENT</Text>
          <Text style={styles.title}>
            {BRAND.short} Provider Agreement ({input.agreementVersion})
          </Text>
          <Text style={styles.titleSub}>
            For Experts and Partners · {BRAND.legalLine} · {BRAND.poweredBy}
          </Text>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Between:</Text>
            <Text style={styles.partyValue}>
              {`${BRAND.legalLine} ("ASN", "we", "us")`}
            </Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>And:</Text>
            <Text style={styles.partyValue}>
              {`${input.signer.name}${input.signer.companyName ? ` · ${input.signer.companyName}` : ""} ("Provider", "you")`}
            </Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Capability:</Text>
            <Text style={styles.partyValue}>{roleLabel}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Effective:</Text>
            <Text style={styles.partyValue}>{signedDate} UTC</Text>
          </View>
        </View>

        {/* Preamble */}
        <Text style={styles.sectionTitle}>What you are agreeing to</Text>
        <Text style={styles.paragraph}>
          Expert and Partner are capabilities on one provider account; a provider can hold both.
          This agreement takes effect when you sign up as a provider and covers both capabilities.
          Sections 1 and 2 apply to Partners, Section 3 applies to Experts, and the remaining
          sections apply to all providers.
        </Text>
        <Text style={styles.paragraph}>
          {`By clicking "I agree" on ${BRAND.host}, ${input.signer.name} ("Provider") agrees to be bound by this Provider Agreement with ASN. Provider's electronic acceptance has the same legal effect as a handwritten signature under applicable e-signature laws.`}
        </Text>

        {/* 1. Partner commitments */}
        <Text style={styles.sectionTitle}>1. The five partner commitments</Text>
        {showPartnerSections ? (
          PARTNER_COMMITMENTS.map((c) => (
            <View key={c.n} style={styles.commitmentRow}>
              <Text style={styles.commitmentNumber}>{c.n}.</Text>
              <View style={styles.commitmentBody}>
                <Text style={styles.commitmentTitle}>{c.title}</Text>
                <Text>{c.body}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.paragraph}>
            Applies to the Partner capability. It becomes effective for you if you add a partner
            listing to this provider account.
          </Text>
        )}

        {/* 2. What partners receive */}
        <Text style={styles.sectionTitle}>2. What partners receive</Text>
        {showPartnerSections ? (
          PARTNER_RECEIVES.map((line, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>·</Text>
              <Text style={styles.bulletBody}>{line}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.paragraph}>Applies to the Partner capability.</Text>
        )}

        {/* 3. Expert terms */}
        <Text style={styles.sectionTitle}>3. Expert terms</Text>
        {showExpertSection ? (
          EXPERT_TERMS.map((line, i) => (
            <Text key={i} style={styles.paragraph}>
              {line}
            </Text>
          ))
        ) : (
          <Text style={styles.paragraph}>
            Applies to the Expert capability. It becomes effective for you if you add an expert
            profile to this provider account.
          </Text>
        )}

        {/* Fee schedule. Partner capability: $39 x 12 months from the day
            the card is added, then $149 (no free period). Expert
            capability: a free period, then $39 with no increase. */}
        {showPartnerSections ? (
          <>
            <Text style={styles.sectionTitle}>
              {showExpertSection ? "Fee schedule: partner listing" : "Fee schedule"}
            </Text>
            <View style={styles.feeRowHead}>
              <Text style={[styles.feeColStrong, { flex: 1 }]}>Period</Text>
              <Text style={[styles.feeColStrong, { flex: 0.7 }]}>Fee</Text>
              <Text style={[styles.feeColStrong, { flex: 2 }]}>Note</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={[styles.feeCol, { flex: 1 }]}>Months 1 to 12</Text>
              <Text style={[styles.feeCol, { flex: 0.7 }]}>$39/mo</Text>
              <Text style={[styles.feeCol, { flex: 2 }]}>Locked launch rate; first charge the day the card is added</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={[styles.feeCol, { flex: 1 }]}>Month 13 onward</Text>
              <Text style={[styles.feeCol, { flex: 0.7 }]}>$149/mo</Text>
              <Text style={[styles.feeCol, { flex: 2 }]}>Standard rate</Text>
            </View>
          </>
        ) : null}
        {showExpertSection ? (
          <>
            <Text style={styles.sectionTitle}>
              {showPartnerSections ? "Fee schedule: expert access" : "Fee schedule"}
            </Text>
            <View style={styles.feeRowHead}>
              <Text style={[styles.feeColStrong, { flex: 1 }]}>Period</Text>
              <Text style={[styles.feeColStrong, { flex: 0.7 }]}>Fee</Text>
              <Text style={[styles.feeColStrong, { flex: 2 }]}>Note</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={[styles.feeCol, { flex: 1 }]}>Months 1 to 6</Text>
              <Text style={[styles.feeCol, { flex: 0.7 }]}>$0</Text>
              <Text style={[styles.feeCol, { flex: 2 }]}>Founding waiver via 180-day Stripe trial; card on file</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={[styles.feeCol, { flex: 1 }]}>Month 7 onward</Text>
              <Text style={[styles.feeCol, { flex: 0.7 }]}>$39/mo</Text>
              <Text style={[styles.feeCol, { flex: 2 }]}>Locked rate, no increase</Text>
            </View>
          </>
        ) : null}

        {/* Member offer: personalized. Shown for partner / both. */}
        {input.memberOffer && input.role !== "expert" ? (
          <>
            <Text style={styles.sectionTitle}>Your member offer</Text>
            <Text style={styles.paragraph}>
              {input.signer.companyName ?? input.signer.name} commits the following exclusive
              benefit to ASN members: {input.memberOffer}
            </Text>
          </>
        ) : null}

        {/* 4 to 10 */}
        {GENERAL_SECTIONS.map((s) => (
          <React.Fragment key={s.title}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.paragraph}>{s.body}</Text>
          </React.Fragment>
        ))}

        <Text style={styles.sectionTitle}>11. Contact and full text</Text>
        <Text style={styles.paragraph}>
          Questions about this agreement: {BRAND.contactEmail} or {BRAND.phone}. The standing,
          human-readable version of this agreement is published at {BRAND.agreementUrl} and is
          incorporated by reference.
        </Text>

        {/* Signature block: "Acceptance record" once accepted, otherwise
            a personalized-but-pending prepared-for block on the invite copy. */}
        <View style={styles.signatureBlock}>
          <Text style={styles.signatureTitle}>
            {accepted ? "Acceptance record" : "Prepared for"}
          </Text>
          <View style={styles.signatureField}>
            <Text style={styles.signatureLabel}>{accepted ? "Accepted by:" : "Name:"}</Text>
            <Text style={styles.signatureValue}>{input.signer.name}</Text>
          </View>
          <View style={styles.signatureField}>
            <Text style={styles.signatureLabel}>Email:</Text>
            <Text style={styles.signatureValue}>{input.signer.email}</Text>
          </View>
          {input.signer.companyName ? (
            <View style={styles.signatureField}>
              <Text style={styles.signatureLabel}>Company:</Text>
              <Text style={styles.signatureValue}>{input.signer.companyName}</Text>
            </View>
          ) : null}
          <View style={styles.signatureField}>
            <Text style={styles.signatureLabel}>Capability:</Text>
            <Text style={styles.signatureValue}>{roleLabel}</Text>
          </View>
          {accepted ? (
            <>
              <View style={styles.signatureField}>
                <Text style={styles.signatureLabel}>Accepted at:</Text>
                <Text style={styles.signatureValue}>{signedDate} UTC</Text>
              </View>
              <View style={styles.signatureField}>
                <Text style={styles.signatureLabel}>Version:</Text>
                <Text style={styles.signatureValue}>{input.agreementVersion}</Text>
              </View>
              <View style={styles.signatureField}>
                <Text style={styles.signatureLabel}>IP fingerprint:</Text>
                <Text style={styles.signatureValue}>SHA-256 · {input.ipHashLast6}</Text>
              </View>
            </>
          ) : (
            <View style={styles.signatureField}>
              <Text style={styles.signatureLabel}>Status:</Text>
              <Text style={styles.signatureValue}>
                Awaiting electronic acceptance via your private invite link
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.footer} fixed>
          {BRAND.short} Provider Agreement {input.agreementVersion} · {input.signer.email} ·{" "}
          {BRAND.agreementUrl}
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Render the agreement to a Buffer suitable for Supabase Storage upload
 * or email attachment. Server-only — @react-pdf/renderer imports native
 * fontkit/canvg which don't work in the browser.
 */
export async function renderAgreementPdf(input: AgreementPdfInput): Promise<Buffer> {
  return renderToBuffer(<AgreementDoc input={input} />);
}
