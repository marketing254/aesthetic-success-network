/**
 * Wrapper every ASN public page renders. The `.asn-site` class is the scope
 * for src/app/site.css (fonts, palette, resets, motion); nothing in that
 * stylesheet applies outside it, so the MUI portals are never restyled.
 */
export default function SitePage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className ? `asn-site ${className}` : "asn-site"}>{children}</div>;
}
