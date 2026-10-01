import "server-only";

/**
 * One brand header for every email: the ASN monogram tile from a fixed
 * public URL (the live site serves it, so it renders locally, on previews
 * and in production; NEXT_PUBLIC_APP_URL would be localhost in dev and
 * inboxes cannot load that) with the network name as text beside it.
 * Override the image with EMAIL_LOGO_URL if the asset ever moves.
 */
export const EMAIL_LOGO_URL =
  process.env.EMAIL_LOGO_URL ?? "https://www.aestheticsuccessnetwork.com/asn-nav-icon.png";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";

/** Inline-styled table: 40px monogram + "Aesthetic Success Network". */
export function emailBrandHeader(opts: { dark?: boolean; size?: number; center?: boolean } = {}): string {
  const dark = opts.dark === true;
  const size = opts.size ?? 40;
  const color = dark ? "#F6F1E7" : "#0A1320";
  const sub = dark ? "rgba(246,241,231,0.7)" : "#8A6528";
  const inner = opts.center ? "margin:0 auto;" : "";
  // Full-width outer table so the header is a block of its own and never
  // floats beside the heading that follows it.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;margin:0 0 18px;">
  <tr><td align="${opts.center ? "center" : "left"}" style="padding:0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${inner}">
  <tr>
    <td style="padding:0 12px 0 0;vertical-align:middle;">
      <img src="${EMAIL_LOGO_URL}" alt="ASN" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border-radius:10px;" />
    </td>
    <td style="vertical-align:middle;font-family:${FONT};">
      <div style="font-size:16px;font-weight:700;color:${color};line-height:1.2;">Aesthetic Success Network</div>
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${sub};margin-top:3px;">Powered by Business of Aesthetics</div>
    </td>
  </tr>
</table>
  </td></tr>
</table>`;
}
