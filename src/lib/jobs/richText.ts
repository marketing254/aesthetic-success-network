/**
 * "Rich text, plain formatting only, no images" — the spec's words for
 * the job description and the requirements field.
 *
 * We do NOT store HTML and we do not run a rich text editor. A public
 * page rendering member-authored HTML is an XSS hole waiting for the
 * first spammer who gets through review, and sanitising it properly is
 * a dependency and an ongoing liability for the sake of bold text.
 *
 * Instead the member types plain text and we recognise exactly one piece
 * of formatting: a line starting with `-`, `*` or `•` is a bullet. That
 * covers what dental job ads actually use — "what the day looks like",
 * "what we're looking for" — and nothing else can be expressed, so
 * nothing else needs escaping.
 *
 * The parse lives here, once, because three surfaces have to agree on
 * it: the public job page (React elements), the schema.org description
 * that Google reads (an HTML string), and the standalone demo. If a
 * bullet renders as a bullet on the page but as a literal "- " in the
 * Google for Jobs card, the markup stops matching the page — which is
 * the one thing that gets a posting dropped.
 *
 * Client-safe: no server-only imports, no DOM, no HTML input.
 */

export type JobTextBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; items: string[] };

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;

/**
 * Plain text → blocks.
 *
 * Blank lines separate paragraphs. A run of bullet lines becomes one
 * list, whether or not a blank line precedes it, because members write
 * an intro line and then bullets straight underneath it.
 */
export function jobTextBlocks(text: string): JobTextBlock[] {
  const blocks: JobTextBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ kind: "paragraph", lines: para });
      para = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: "list", items: list });
      list = [];
    }
  };

  for (const rawLine of (text ?? "").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const bullet = BULLET_RE.exec(line);

    if (bullet) {
      // A bullet ends the paragraph above it without needing a blank line.
      flushPara();
      const item = bullet[1].trim();
      // "-" on its own is a stray dash, not an empty bullet.
      if (item) list.push(item);
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      flushList();
      continue;
    }

    flushList();
    para.push(line.trim());
  }

  flushPara();
  flushList();
  return blocks;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Plain text → the HTML string Google expects in JobPosting.description.
 *
 * Escaped first, then wrapped — the member's text can never contribute
 * markup, only content. Google's documented allowlist for this field
 * includes <p>, <ul>, <li> and <br>, which is exactly what comes out.
 */
export function jobTextToHtml(text: string): string {
  const html = jobTextBlocks(text)
    .map((block) =>
      block.kind === "list"
        ? `<ul>${block.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
        : `<p>${block.lines.map(esc).join("<br>")}</p>`,
    )
    .join("");
  // An empty description can't reach here through validateJobInput (30
  // char minimum), but jsonLd must never emit an empty required field.
  return html || `<p>${esc((text ?? "").trim())}</p>`;
}

/** Does this text use any formatting at all? Used to hint in the form. */
export function hasBullets(text: string): boolean {
  return jobTextBlocks(text).some((b) => b.kind === "list");
}
