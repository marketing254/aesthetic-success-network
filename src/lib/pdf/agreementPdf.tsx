import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from "@react-pdf/renderer";

/**
 * Signed agreement PDF for the member/expert/partner billing e-sign
 * flow. Deliberately stays on built-in Helvetica — no custom font
 * registration, no logo asset — so it renders identically everywhere
 * with zero external dependencies. This is legal evidence of what was
 * agreed to, not a marketing document.
 */

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", color: "#1a1a1a" },
  brand: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  tagline: { fontSize: 8, color: "#8b8577", marginBottom: 24, textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 16 },
  row: { flexDirection: "row", marginBottom: 6 },
  label: { width: 140, color: "#8b8577" },
  value: { flex: 1, fontFamily: "Helvetica-Bold" },
  section: { marginTop: 18, marginBottom: 8, fontSize: 12, fontFamily: "Helvetica-Bold" },
  paragraph: { marginBottom: 8, lineHeight: 1.5 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 8, color: "#8b8577" },
});

const ROLE_LABEL: Record<AgreementPdfInput["role"], string> = {
  member: "Founding Member",
  expert: "Founding Expert",
  partner: "Founding Partner",
};

const ROLE_TERMS: Record<AgreementPdfInput["role"], string[]> = {
  member: [
    "This confirms your enrollment in the Aesthetic Success Network membership program at the plan and rate shown above.",
    "Your locked rate applies for the lifetime of your continuous membership. Cancelling forfeits the locked rate; rejoining is at the standard rate in effect at that time.",
  ],
  expert: [
    "Months 1 through 6 of your program are free. Starting your billing trial locks in the $49/month Growth rate for months 7 through 12, then $199/month from month 13 onward, for the lifetime of your continuous participation.",
    "This discounted Growth rate is limited to the first 20 founding experts. Cancelling forfeits the locked rate.",
    "Paid courses: you keep 70% of net course revenue; the network retains 30%.",
  ],
  partner: [
    "Months 1 through 6 of your program are free. Starting your billing trial locks in the $49/month Growth rate for months 7 through 12, then $199/month from month 13 onward, for the lifetime of your continuous participation.",
    "Cancelling forfeits the locked rate; rejoining is at the standard rate in effect at that time.",
  ],
};

export type AgreementPdfInput = {
  role: "member" | "expert" | "partner";
  agreementVersion: string;
  planLabel: string;
  signer: { name: string; email: string; companyName?: string | null };
  signedAt: Date;
  ipHashLast6: string;
};

function AgreementDoc({ input }: { input: AgreementPdfInput }) {
  const dateLabel = input.signedAt.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>Aesthetic Success Network</Text>
        <Text style={styles.tagline}>Powered by Business of Aesthetics</Text>
        <Text style={styles.title}>{ROLE_LABEL[input.role]} Agreement — Signed Confirmation</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Signer</Text>
          <Text style={styles.value}>{input.signer.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{input.signer.email}</Text>
        </View>
        {input.signer.companyName ? (
          <View style={styles.row}>
            <Text style={styles.label}>Company</Text>
            <Text style={styles.value}>{input.signer.companyName}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.label}>Plan</Text>
          <Text style={styles.value}>{input.planLabel}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Signed at</Text>
          <Text style={styles.value}>{dateLabel}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Agreement version</Text>
          <Text style={styles.value}>{input.agreementVersion}</Text>
        </View>

        <Text style={styles.section}>Terms agreed to</Text>
        {ROLE_TERMS[input.role].map((line, i) => (
          <Text key={i} style={styles.paragraph}>
            {line}
          </Text>
        ))}

        <Text style={styles.footer}>
          Aesthetic Success Network · Ekwa Marketing Inc. · Signature captured electronically. IP
          hash (last 6): {input.ipHashLast6}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderAgreementPdf(input: AgreementPdfInput): Promise<Buffer> {
  return renderToBuffer(<AgreementDoc input={input} />);
}
