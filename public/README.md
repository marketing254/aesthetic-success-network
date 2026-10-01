# Aesthetic Success Network
## Logo asset pack (`public/`)

Everything the site, emails and PDFs reference lives in this folder.
File names are lowercase-hyphenated.

### Brand marks

| File | Size / shape | Use |
|---|---|---|
| `asn-nav-icon.png` | 128 px square, navy rounded tile with the gold monogram | `src/components/brand/Logo.tsx` (header, drawer, footer, logins, portal sidebars). Works on light and dark surfaces; never apply a brightness/invert filter to it. |
| `asn-app-icon.png` | square app tile | Source for `src/app/icon.png` (Next.js favicon convention) and any app-store / PWA tile. |
| `apple-touch-icon.png` | 180 x 180 | Source for `src/app/apple-icon.png`. |
| `favicon-32.png`, `favicon-48.png`, `favicon.ico` | 32 / 48 px | Legacy favicon sizes for browsers that ignore the Next.js convention. |
| `asn-logo-full-white.png` | full horizontal lockup, for light backgrounds | Emails, PDFs (agreement and welcome pack headers), print. |
| `asn-logo-full-dark.png` | full horizontal lockup, for dark backgrounds | Organization JSON-LD `logo`, dark email footers, the source of the OG image. |
| `og-image.png` | 1200 x 630 | Open Graph / Twitter card image (`src/app/layout.tsx`). |

### Partner and team art

| File | Use |
|---|---|
| `boa-logo.png` | Business of Aesthetics, the "Powered by" chip in the footer, `PoweredByStrip` and the `/partners` logo grid. |
| `ekwa-logo.png` | Ekwa Marketing Inc., the operating entity, shown next to BOA in the same places. |
| `team/naren-arulrajah.jpg` | Naren Arulrajah, Founder & CEO, Ekwa Marketing (FoundingTeam). |
| `team/lester-de-alwis.png` | Lester De Alwis, Co-Founder, Aesthetic Success Network (FoundingTeam). |

### Agreements and policies (`agreements/`)

`asn-member-agreement.pdf`, `asn-provider-agreement.pdf` (one agreement
for experts, partners and expert+partner), `asn-refund-and-cancellation-policy.pdf`,
`asn-privacy-policy.pdf`.

### Crawler files

`llms.txt` (AI-crawler site summary) and `pricing.md` (machine-readable
pricing). Both use the canonical origin `https://www.aestheticsuccessnetwork.com`.

### Brand tokens

| Role | Hex |
|---|---|
| Navy (primary text, tiles, dark surfaces) | `#0A1320` (theme `ink`) / `#0E2A3D` (theme `primary`) / `#0A1A2F` (page constant) |
| Gold (accent) | `#D9A84B` (bright `#F0C16E`, deep `#A07823`) |
| Ivory (light backgrounds, knockout) | `#F6F1E7` (cream `#FBF8F1`, `#F8F5EE`) |

### Type

- Display: **Fraunces** (`--font-display`), weight 500, used for h1 to h4 and the wordmark.
- Body: **Manrope** (`--font-body`).

### Rules

- Minimum size for the tile mark: 16 px (favicon). Minimum for the full lockup: 120 px wide on screen.
- Clearspace around the tile: one quarter of its width on every side.
- Do not recolor the gold, stretch or rotate any mark, or place the dark lockup on a busy image without a solid plate.
- Never reintroduce another brand's logo into the "Powered by" set; it is Business of Aesthetics and Ekwa Marketing only.
