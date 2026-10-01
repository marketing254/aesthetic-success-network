/**
 * Server-renders JSON-LD into the page HTML. Use this for page-specific
 * structured data (FAQPage, Product, BreadcrumbList, etc.); the root
 * Organization + WebSite schema is in app/layout.tsx.
 *
 * IMPORTANT: `dangerouslySetInnerHTML` is intentional. JSON-LD must be
 * raw JSON inside a <script> tag, not React children, so the quotes are
 * not HTML-escaped. The one character that matters is "<": a string value
 * containing "</script>" would otherwise close the tag early, so every "<"
 * is emitted as the JSON escape <, which parses back to "<" and is
 * inert inside the script element.
 */
export function serializeJsonLd(data: object | object[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
