import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { loadExperts, loadPartnerOffers, loadResourceCatalog } from "@/lib/ai/assistant";

/**
 * The "everything ASN offers" member pack, a branded PDF built live from
 * the database, sent to a member after Beacon escalates a question.
 *
 * File name and export names are kept from the DMN port (other modules
 * import renderDmnPackPdf); only the brand and copy changed.
 *
 * Design: navy cover page with gold accents, then content pages with a
 * gold-ruled section system and bordered entry cards. Runs on
 * @react-pdf/renderer (no headless browser) with the built-in Helvetica
 * family; the ASN palette carries the brand.
 */

const BRAND_NAME = "Aesthetic Success Network";
const HOTLINE_PHONE = "(855) 567-5323";
const SUPPORT_EMAIL = "support@aestheticsuccessnetwork.com";

const INK = "#0A1A2F";
const INK_SOFT = "#3B4A55";
const INK_MUTED = "#7A8590";
const GOLD = "#A07823";
const GOLD_LIGHT = "#D9A84B";
const LINE = "#E6DDCF";
const PAPER = "#FBF8F1";

const s = StyleSheet.create({
  // ── Cover ────────────────────────────────────────────────────────────
  cover: { backgroundColor: INK, color: "#FFFFFF", paddingTop: 120, paddingHorizontal: 64, paddingBottom: 64 },
  coverRule: { width: 56, height: 3, backgroundColor: GOLD_LIGHT, marginBottom: 28 },
  coverEyebrow: { fontFamily: "Helvetica-Bold", fontSize: 10, letterSpacing: 3, color: GOLD_LIGHT, textTransform: "uppercase", marginBottom: 16 },
  coverTitle: { fontFamily: "Helvetica-Bold", fontSize: 34, lineHeight: 1.15, marginBottom: 20, color: "#FFFFFF" },
  coverSub: { fontSize: 12, lineHeight: 1.6, color: "#C7CFD8", maxWidth: 380, marginBottom: 44 },
  coverCard: { backgroundColor: "#10233C", borderRadius: 8, padding: 20, borderLeftWidth: 3, borderLeftColor: GOLD_LIGHT, maxWidth: 420 },
  coverCardLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 2, color: GOLD_LIGHT, textTransform: "uppercase", marginBottom: 8 },
  coverCardText: { fontSize: 11, lineHeight: 1.55, color: "#EAEEF2", fontStyle: "italic" },
  coverMeta: { position: "absolute", bottom: 56, left: 64, right: 64, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#22364F", paddingTop: 16 },
  coverMetaText: { fontSize: 9, color: "#8FA0B0" },

  // ── Content pages ────────────────────────────────────────────────────
  page: { backgroundColor: "#FFFFFF", paddingTop: 56, paddingBottom: 64, paddingHorizontal: 52, fontSize: 10, color: INK_SOFT, lineHeight: 1.5 },
  section: { marginBottom: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 10 },
  sectionRule: { width: 26, height: 2.5, backgroundColor: GOLD, marginRight: 10 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 15, color: INK },
  sectionCount: { fontSize: 9, color: INK_MUTED, marginLeft: 8, marginTop: 3 },
  sectionIntro: { fontSize: 9.5, color: INK_MUTED, marginBottom: 12, maxWidth: 440 },

  card: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 12, marginBottom: 8, backgroundColor: "#FFFFFF" },
  cardAccent: { borderLeftWidth: 3, borderLeftColor: GOLD },
  cardName: { fontFamily: "Helvetica-Bold", fontSize: 11.5, color: INK, marginBottom: 2 },
  cardMeta: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1.2, color: GOLD, textTransform: "uppercase", marginBottom: 4 },
  cardBody: { fontSize: 9.5, color: INK_SOFT, lineHeight: 1.5 },
  cardFoot: { fontSize: 8.5, color: INK_MUTED, marginTop: 4 },

  offerRow: { flexDirection: "row", marginTop: 6, backgroundColor: PAPER, borderRadius: 4, padding: 8 },
  offerBullet: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: GOLD, marginRight: 6 },
  offerText: { flex: 1, fontSize: 9.5, color: INK_SOFT, lineHeight: 1.45 },
  promo: { fontFamily: "Helvetica-Bold", color: INK },

  empty: { fontSize: 9.5, color: INK_MUTED, fontStyle: "italic", marginBottom: 10 },

  footer: { position: "absolute", bottom: 26, left: 52, right: 52, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  footerText: { fontSize: 8, color: INK_MUTED },

  closing: { marginTop: 18, backgroundColor: INK, borderRadius: 8, padding: 18 },
  closingTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, color: "#FFFFFF", marginBottom: 6 },
  closingText: { fontSize: 9.5, color: "#C7CFD8", lineHeight: 1.55 },
  closingGold: { fontFamily: "Helvetica-Bold", color: GOLD_LIGHT },
});

type PackData = {
  memberName: string;
  question: string;
  dateLabel: string;
  experts: Awaited<ReturnType<typeof loadExperts>>;
  partners: Awaited<ReturnType<typeof loadPartnerOffers>>;
  kits: Awaited<ReturnType<typeof loadResourceCatalog>>;
};

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{BRAND_NAME} · ASN member pack · Powered by Business of Aesthetics</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionHead({ title, count, intro }: { title: string; count: string; intro: string }) {
  return (
    <View>
      <View style={s.sectionHead}>
        <View style={s.sectionRule} />
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionCount}>{count}</Text>
      </View>
      <Text style={s.sectionIntro}>{intro}</Text>
    </View>
  );
}

function PackDocument({ memberName, question, dateLabel, experts, partners, kits }: PackData) {
  return (
    <Document title={`${BRAND_NAME}: ASN member pack`} author={BRAND_NAME}>
      {/* ── Cover ── */}
      <Page size="A4" style={s.cover}>
        <View style={s.coverRule} />
        <Text style={s.coverEyebrow}>{BRAND_NAME}</Text>
        <Text style={s.coverTitle}>Your ASN member pack</Text>
        <Text style={s.coverSub}>
          Every expert, partner offer, and kit your membership unlocks, prepared for you while our team works on
          your question. Expect a written reply by text and email within 2 to 3 business days.
        </Text>
        {question ? (
          <View style={s.coverCard}>
            <Text style={s.coverCardLabel}>Your question</Text>
            <Text style={s.coverCardText}>{`"${question.length > 260 ? `${question.slice(0, 257)}...` : question}"`}</Text>
          </View>
        ) : null}
        <View style={s.coverMeta}>
          <Text style={s.coverMetaText}>Prepared for {memberName}</Text>
          <Text style={s.coverMetaText}>{dateLabel}</Text>
        </View>
      </Page>

      {/* ── Experts ── */}
      <Page size="A4" style={s.page}>
        <SectionHead
          title="Your Experts"
          count={`${experts.length} on the bench`}
          intro="Practising specialists who teach inside the portal. Open any profile from Experts in your dashboard to see their kits, spotlights, and how to reach them."
        />
        {experts.length === 0 ? (
          <Text style={s.empty}>New experts are being onboarded. Check the Experts page in your portal.</Text>
        ) : (
          experts.map((e) => (
            <View key={e.id} style={[s.card, s.cardAccent]} wrap={false}>
              <Text style={s.cardName}>{e.name}</Text>
              {e.specialty ? <Text style={s.cardMeta}>{e.specialty}</Text> : null}
              {e.bio ? <Text style={s.cardBody}>{e.bio.replace(/\s+/g, " ").trim().slice(0, 260)}</Text> : null}
            </View>
          ))
        )}
        <Footer />
      </Page>

      {/* ── Partners & offers ── */}
      <Page size="A4" style={s.page}>
        <SectionHead
          title="Partner Network & Member Offers"
          count={`${partners.length} partners`}
          intro="Vetted companies with member-exclusive pricing. Redeem any offer from the Partners page in your dashboard. Promo codes are included below."
        />
        {partners.length === 0 ? (
          <Text style={s.empty}>New partners are being onboarded. Check the Partners page in your portal.</Text>
        ) : (
          partners.map((p) => (
            <View key={p.id} style={s.card} wrap={false}>
              <Text style={s.cardName}>{p.name}</Text>
              {p.category ? <Text style={s.cardMeta}>{p.category}</Text> : null}
              {p.description ? <Text style={s.cardBody}>{p.description.replace(/\s+/g, " ").trim().slice(0, 220)}</Text> : null}
              {p.offers.map((o, i) => (
                <View key={i} style={s.offerRow}>
                  <Text style={s.offerBullet}>◆</Text>
                  <Text style={s.offerText}>
                    {o.headline}
                    {o.discount ? `: ${o.discount}` : ""}
                    {o.promo ? <Text style={s.promo}>  ·  Code: {o.promo}</Text> : null}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
        <Footer />
      </Page>

      {/* ── Resources ── */}
      <Page size="A4" style={s.page}>
        <SectionHead
          title="The Resource Library"
          count={`${kits.length} kits`}
          intro="Training videos, action guides, checklists, and slide decks, organised as kits. Open the Resource library in your dashboard and pick up any of these."
        />
        {kits.length === 0 ? (
          <Text style={s.empty}>Kits are being published. Check the Resource library in your portal.</Text>
        ) : (
          kits.map((k) => (
            <View key={k.slug} style={s.card} wrap={false}>
              <Text style={s.cardName}>{k.title}</Text>
              <Text style={s.cardMeta}>
                {[k.category, `${k.itemCount} item${k.itemCount === 1 ? "" : "s"}`, k.videoCount > 0 ? `${k.videoCount} video${k.videoCount === 1 ? "" : "s"}` : null, k.isFree ? "Free" : null]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
              {k.summary ? <Text style={s.cardBody}>{k.summary.replace(/\s+/g, " ").trim().slice(0, 200)}</Text> : null}
              {k.itemTitles.length > 0 ? (
                <Text style={s.cardFoot}>Inside: {k.itemTitles.slice(0, 6).join(" · ")}{k.itemCount > 6 ? " · ..." : ""}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* Closing card */}
        <View style={s.closing} wrap={false}>
          <Text style={s.closingTitle}>Getting the most from your membership</Text>
          <Text style={s.closingText}>
            Ask <Text style={s.closingGold}>Beacon</Text> inside your portal for a shortlist matched to any problem, leave a
            voicemail on the Expert Hotline at <Text style={s.closingGold}>{HOTLINE_PHONE}</Text> for a written action plan
            within 2 to 3 business days, or reply to the email this pack arrived with. It reaches{" "}
            <Text style={s.closingGold}>{SUPPORT_EMAIL}</Text> directly.
          </Text>
        </View>
        <Footer />
      </Page>
    </Document>
  );
}

/** Load all portal data and render the pack PDF to a Buffer. */
export async function renderDmnPackPdf(input: { memberName: string; question: string; dateLabel: string }): Promise<Buffer> {
  const [experts, partners, kits] = await Promise.all([
    loadExperts(),
    loadPartnerOffers(),
    loadResourceCatalog(),
  ]);
  return renderToBuffer(
    <PackDocument
      memberName={input.memberName}
      question={input.question}
      dateLabel={input.dateLabel}
      experts={experts}
      partners={partners}
      kits={kits}
    />,
  );
}
