import "server-only";
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from "@react-pdf/renderer";

/**
 * The PUBLIC Provider Agreement as a PDF, built from the same HTML the
 * /agreement/provider page shows (src/content/legal/provider-agreement.ts).
 * Pure JavaScript (@react-pdf/renderer), so it works on Vercel where no
 * headless browser exists. The HTML is a small, known subset (h2, p, ol,
 * ul, li, b, a, span) and is converted to text blocks here.
 */

Font.registerHyphenationCallback((word) => [word]);

const C = { ink: "#0A1A2F", soft: "#3B4A55", muted: "#5C6770", gold: "#A07823", line: "#D8D2C1" };

const st = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10.5, color: C.soft, lineHeight: 1.5, padding: 48, paddingTop: 56 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.ink },
  brandSub: { fontSize: 7, color: C.gold, letterSpacing: 2, marginTop: 2 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 20, lineHeight: 1.15 },
  meta: { fontSize: 9, color: C.muted, marginTop: 4, marginBottom: 18, paddingBottom: 12, borderBottom: `2 solid ${C.gold}` },
  h2: { fontSize: 12.5, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 16, marginBottom: 6 },
  p: { marginBottom: 7 },
  li: { flexDirection: "row", marginBottom: 4 },
  liMark: { width: 16, color: C.gold, fontFamily: "Helvetica-Bold" },
  liBody: { flex: 1 },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 7, color: C.muted, textAlign: "center", borderTop: `1 solid ${C.line}`, paddingTop: 8 },
});

type Block = { kind: "h2" | "p" | "li"; text: string; mark?: string };

function decode(s: string): string {
  return s
    .replace(/<\/span>/g, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&middot;/g, "·")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Turn the legal HTML into ordered blocks. Lists keep their numbering. */
export function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const re = /<(h2|p|ol|ul|li|\/ol|\/ul)(?:[^>]*)>([\s\S]*?)(?=<(?:h2|p|ol|ul|li|\/ol|\/ul)(?:[^>]*)>|$)/g;
  let listKind: "ol" | "ul" | null = null;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[1];
    const inner = m[2];
    if (tag === "ol") { listKind = "ol"; n = 0; continue; }
    if (tag === "ul") { listKind = "ul"; n = 0; continue; }
    if (tag === "/ol" || tag === "/ul") { listKind = null; continue; }
    const text = decode(inner);
    if (!text) continue;
    if (tag === "h2") blocks.push({ kind: "h2", text });
    else if (tag === "p") blocks.push({ kind: "p", text });
    else if (tag === "li") {
      n += 1;
      blocks.push({ kind: "li", text, mark: listKind === "ol" ? `${n}.` : "·" });
    }
  }
  return blocks;
}

function Doc({ meta, blocks }: { meta: string; blocks: Block[] }) {
  return (
    <Document title="ASN Provider Agreement" author="Aesthetic Success Network" creator="aestheticsuccessnetwork.com">
      <Page size="LETTER" style={st.page} wrap>
        <Text style={st.brand}>Aesthetic Success Network</Text>
        <Text style={st.brandSub}>POWERED BY BUSINESS OF AESTHETICS</Text>
        <Text style={st.title}>Provider Agreement</Text>
        <Text style={st.meta}>{meta}</Text>
        {blocks.map((b, i) =>
          b.kind === "h2" ? (
            <Text key={i} style={st.h2} minPresenceAhead={60}>{b.text}</Text>
          ) : b.kind === "p" ? (
            <Text key={i} style={st.p}>{b.text}</Text>
          ) : (
            <View key={i} style={st.li} wrap={false}>
              <Text style={st.liMark}>{b.mark}</Text>
              <Text style={st.liBody}>{b.text}</Text>
            </View>
          ),
        )}
        <Text style={st.footer} fixed>
          Aesthetic Success Network, operated by Ekwa Marketing Inc. · Powered by Business of Aesthetics · aestheticsuccessnetwork.com/agreement/provider
        </Text>
      </Page>
    </Document>
  );
}

export async function renderPublicAgreementPdf(meta: string, html: string): Promise<Buffer> {
  return renderToBuffer(<Doc meta={decode(meta)} blocks={htmlToBlocks(html)} />);
}
