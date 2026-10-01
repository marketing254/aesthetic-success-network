#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * import-resources.mjs
 *
 * Bulk-import every kit folder under `<root>/Resources/` into Supabase.
 *
 * What it does, per kit folder:
 *   1. Detects kit_type:
 *        - "book_club"  if "Book Study Guide.pdf" exists, or any "Short *.mp4"
 *        - "standard"   otherwise
 *   2. Uploads the cover artwork into the `kit-thumbnails` bucket.
 *   3. Uploads every content file into the `member-resources` bucket.
 *   4. Inserts a `resources` row per content file with the right kind,
 *      title, position; plus topic-level metadata (slug, title, category,
 *      portal_card_url, resource_card_url, kit_type, book_club_payload).
 *
 * Idempotent: if a kit's topic_slug already exists in `resources`, the
 * whole folder is skipped (we don't try to diff individual files).
 *
 * Usage:
 *   # 1. Make sure landing/.env.local has:
 *   #      NEXT_PUBLIC_SUPABASE_URL=...
 *   #      SUPABASE_SERVICE_ROLE_KEY=...
 *   # 2. Run from the landing/ directory:
 *   node scripts/import-resources.mjs --root "<path-to-your-Resources-folder>" --category "Pricing & Margins"
 *
 *   Options:
 *     --root <path>         resources folder root (required)
 *     --category <name>     category for standard kits. One of the ASN canon list:
 *                           Pricing & Margins | Consult & Conversion | Team & Culture |
 *                           Patient Experience | Marketing & Growth | Operations & Compliance
 *     --only "<kit-name>"   import only one folder (exact name match), repeatable
 *     --dry-run             print actions without uploading or inserting
 *     --publish             mark kits as published + approved (default: pending_review)
 *     --book-club-category  override category for book-club kits (default: "Book Club")
 *
 * Run order:
 *   - Run migrations 0026 / 0027 / 0028 first.
 *   - First run can be `--dry-run` to verify the plan.
 *   - Subsequent runs are idempotent (existing slugs skipped).
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Node 18+ ships fetch via undici internally. Try to import the
// dispatcher so we can disable the 5-minute body timeout for huge
// uploads (387 MB training videos can take 10+ minutes). Both
// `node:undici` (Node 22+) and the standalone `undici` package are
// tried; if neither is present we silently continue and rely on
// uploadFile()'s retry-with-backoff for resilience.
try {
  let undici;
  try {
    undici = await import("node:undici");
  } catch {
    undici = await import("undici");
  }
  if (undici?.Agent && undici?.setGlobalDispatcher) {
    undici.setGlobalDispatcher(
      new undici.Agent({
        headersTimeout: 0,
        bodyTimeout: 0,
        connectTimeout: 60_000,
        keepAliveTimeout: 60_000,
        keepAliveMaxTimeout: 600_000,
      }),
    );
    console.log("◇ undici dispatcher: unbounded timeouts enabled for large uploads");
  }
} catch {
  // No undici available; the retry loop below is our only mitigation.
  // Most uploads still succeed — Node's default body timeout is 5 min,
  // which covers files up to ~150 MB on a 5 Mbps uplink.
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const landingDir = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(landingDir, ".env.local") });
dotenv.config({ path: path.join(landingDir, ".env") });

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

// ─── CLI ─────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
if (!args.root) {
  console.error("Missing --root <path-to-Resources-folder>");
  process.exit(1);
}
const ROOT = path.resolve(args.root);
// ASN canon resource categories (ASN-SWAP-CANON.md §4). The admin kit editor
// offers exactly these, so the importer refuses anything else to keep the
// library filters clean. Book Club kits use BOOK_CLUB_CATEGORY instead.
const RESOURCE_CATEGORIES = [
  "Pricing & Margins",
  "Consult & Conversion",
  "Team & Culture",
  "Patient Experience",
  "Marketing & Growth",
  "Operations & Compliance",
];
const DEFAULT_CATEGORY = args.category || null;
if (DEFAULT_CATEGORY && !RESOURCE_CATEGORIES.includes(DEFAULT_CATEGORY)) {
  console.error(
    `Unknown --category "${DEFAULT_CATEGORY}". Use one of: ${RESOURCE_CATEGORIES.join(" | ")}`,
  );
  process.exit(1);
}
const BOOK_CLUB_CATEGORY = args["book-club-category"] || "Book Club";
const ONLY = Array.isArray(args.only) ? args.only : args.only ? [args.only] : [];
const DRY_RUN = !!args["dry-run"];
const PUBLISH = !!args["publish"];
// Attribution: when set, every imported kit is tied to this expert / vendor
// (originating_expert_id / originating_vendor_id). Attributed kits are
// MEMBER-PORTAL ONLY — the public /api/resources endpoint excludes them.
const EXPERT_EMAIL = (args["expert-email"] || "").trim().toLowerCase() || null;
const VENDOR_EMAIL = (args["vendor-email"] || "").trim().toLowerCase() || null;
// Force the square social cover ("Cover - Square (social).png") as the kit
// thumbnail instead of the default "Card - Portal Grid".
// The square social cover is now the DEFAULT portal card (it matches the
// 1:1 grid tile). `--portrait-cover` opts back into the 3:4 "Card - Portal
// Grid" image. `--square-cover` is accepted as a no-op so older documented
// commands keep working.
const PORTRAIT_COVER = !!args["portrait-cover"];

// Resolved once at startup from the emails above.
let ORIGINATING_EXPERT_ID = null;
let ORIGINATING_VENDOR_ID = null;

if (!existsSync(ROOT)) {
  console.error(`Folder doesn't exist: ${ROOT}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Slot mapping: file basename → resource row metadata ─────────────────
// Standard kit slot map. Book Club shorts are detected dynamically.
const STANDARD_SLOTS = [
  { match: /^Training Video\.mp4$/i,         kind: "video_full",          title: "Training Video",       position: 10, bucket: "member-resources" },
  { match: /^Action Guide\.pdf$/i,           kind: "action_guide",        title: "Action Guide",         position: 20, bucket: "member-resources" },
  { match: /^Book Study Guide\.pdf$/i,       kind: "book_study_guide",    title: "Book Study Guide",     position: 20, bucket: "member-resources" },
  { match: /^Discussion Questions\.pdf$/i,   kind: "discussion_questions",title: "Discussion Questions", position: 25, bucket: "member-resources" },
  { match: /^Key Takeaways\.pdf$/i,          kind: "key_takeaways",       title: "Key Takeaways",        position: 30, bucket: "member-resources" },
  { match: /^Infographic\.pdf$/i,            kind: "infographic",         title: "Infographic",          position: 35, bucket: "member-resources" },
  { match: /^Infographic\.png$/i,            kind: "infographic_image",   title: "Infographic Image",    position: 36, bucket: "member-resources" },
  { match: /^Checklist\.pdf$/i,              kind: "checklist",           title: "Checklist",            position: 40, bucket: "member-resources" },
  { match: /^Worksheet\.pdf$/i,              kind: "worksheet",           title: "Worksheet",            position: 50, bucket: "member-resources" },
  { match: /^Slide Deck\.pdf$/i,             kind: "slide_deck",          title: "Slide Deck",           position: 60, bucket: "member-resources" },
  { match: /^Slide Deck\.pptx$/i,            kind: "slide_deck",          title: "Slide Deck (PowerPoint)", position: 65, bucket: "member-resources" },
  { match: /^Wall Poster\.pdf$/i,            kind: "other",               title: "Wall Poster",          position: 70, bucket: "member-resources" },
];

// Covers (uploaded to kit-thumbnails bucket).
const COVER_PORTAL_RE = /^Card - Portal Grid.*\.png$/i;
const COVER_SQUARE_RE = /^Cover - Square \(social\)\.png$/i;
const COVER_HERO_RE = /^Cover - Detail Hero \(wide\)\.png$/i;
const SHORT_RE = /^Short (\d+) \(9x16\) - (.+?)\.mp4$/i;
// Landscape (16x9) video types shipped by newer expert kits. These are NOT
// video_short — that kind drives the portal's vertical 9x16 shorts rail.
//   "Expert Spotlight - Connect Before You Treat.mp4"
//   "Highlight 2 (16x9) - Know the End Goal.mp4"
const SPOTLIGHT_RE = /^Expert Spotlight( \(Full\))? - (.+?)\.mp4$/i;
const HIGHLIGHT_RE = /^Highlight (\d+) \(16x9\) - (.+?)\.mp4$/i;

const MIME = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".webp": "image/webp",
};

// ─── Helpers ─────────────────────────────────────────────────────────────
function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function mimeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

async function listKitFolders(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name);
}

function detectKitType(filenames) {
  // Only a Book Study Guide marks a true Book Club kit. Shorts alone do
  // NOT — expert kits ship 9×16 shorts too and must stay "standard" so
  // they keep their real category + no Book Club badge.
  if (filenames.some((n) => /^Book Study Guide\.pdf$/i.test(n))) return "book_club";
  return "standard";
}

function findShorts(filenames) {
  const out = [];
  for (const name of filenames) {
    const m = name.match(SHORT_RE);
    if (m) {
      out.push({
        index: Number(m[1]),
        principle: m[2].trim(),
        filename: name,
      });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

async function publicUrl(bucket, storagePath) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data?.publicUrl ?? null;
}

async function uploadFile(bucket, storagePath, absFilePath, contentType) {
  if (DRY_RUN) {
    console.log(`    [dry] upload -> ${bucket}/${storagePath}`);
    return await publicUrl(bucket, storagePath);
  }
  const stats = await fs.stat(absFilePath);
  const sizeMb = stats.size / 1024 / 1024;
  const buf = await fs.readFile(absFilePath);

  // Retry with exponential backoff. Large videos (200+ MB) on residential
  // uplinks often fail on first attempt with "fetch failed" / ECONNRESET
  // or hit Node's 5-minute body timeout. Bump attempt count + cap backoff.
  const MAX_ATTEMPTS = sizeMb > 200 ? 8 : sizeMb > 100 ? 5 : 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      if (sizeMb > 50 && attempt === 1) {
        console.log(`    uploading ${sizeMb.toFixed(0)} MB → ${bucket}/${storagePath} (may take a while)`);
      } else if (attempt > 1) {
        console.log(`    retry ${attempt}/${MAX_ATTEMPTS} for ${bucket}/${storagePath}`);
      }
      const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buf, {
          contentType,
          upsert: true,
        });
      if (error) {
        // A "resource already exists" error after a previous attempt that
        // actually finished but lost the response means the file IS there;
        // treat as success.
        if (/already exists|Duplicate/i.test(error.message)) {
          console.log(`    already on storage — treating as success`);
          return await publicUrl(bucket, storagePath);
        }
        throw new Error(error.message);
      }
      return await publicUrl(bucket, storagePath);
    } catch (err) {
      lastErr = err;
      console.log(`    attempt ${attempt} failed: ${err?.message ?? err}`);
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = Math.min(3000 * Math.pow(2, attempt - 1) + Math.random() * 2000, 60_000);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw new Error(
    `Upload failed (${bucket}/${storagePath}) after ${MAX_ATTEMPTS} attempts: ${lastErr?.message ?? "unknown"}`,
  );
}

async function kitSlugExists(slug) {
  const { data, error } = await supabase
    .from("resources")
    .select("id")
    .eq("topic_slug", slug)
    .limit(1);
  if (error) throw new Error(`DB read failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

// ─── Driver ──────────────────────────────────────────────────────────────
(async () => {
  console.log(`Importing from: ${ROOT}`);
  console.log(`Default category: ${DEFAULT_CATEGORY ?? "(none)"}`);
  console.log(`Book Club category: ${BOOK_CLUB_CATEGORY}`);
  console.log(`Publish on insert: ${PUBLISH ? "yes (approved)" : "no (pending_review)"}`);

  // Resolve attribution once. Fail loudly if the person isn't in the DB yet
  // (they must have accepted / been added first), so we never silently import
  // an unattributed — and therefore publicly-visible — kit.
  if (EXPERT_EMAIL) {
    const { data, error } = await supabase
      .from("experts")
      .select("id, full_name")
      .eq("email", EXPERT_EMAIL)
      .maybeSingle();
    if (error || !data) {
      console.error(`No expert found with email ${EXPERT_EMAIL}. Add/accept them first, then re-run.`);
      process.exit(1);
    }
    ORIGINATING_EXPERT_ID = data.id;
    console.log(`Attributing kits to EXPERT: ${data.full_name} <${EXPERT_EMAIL}> (${data.id})`);
  }
  if (VENDOR_EMAIL) {
    const { data, error } = await supabase
      .from("vendors")
      .select("id, company_name")
      .eq("contact_email", VENDOR_EMAIL)
      .maybeSingle();
    if (error || !data) {
      console.error(`No partner found with contact_email ${VENDOR_EMAIL}. Add/accept them first, then re-run.`);
      process.exit(1);
    }
    ORIGINATING_VENDOR_ID = data.id;
    console.log(`Attributing kits to PARTNER: ${data.company_name} <${VENDOR_EMAIL}> (${data.id})`);
  }
  console.log(
    PORTRAIT_COVER
      ? "Thumbnail: 'Card - Portal Grid' (3:4 portrait — opted in via --portrait-cover)."
      : "Thumbnail: 'Cover - Square (social)' 2160x2160 (default, matches the 1:1 grid tile).",
  );
  if (ORIGINATING_EXPERT_ID || ORIGINATING_VENDOR_ID) {
    console.log("→ These kits are MEMBER-PORTAL ONLY (excluded from the public resources page).\n");
  }

  if (DRY_RUN) console.log("DRY RUN — nothing will be uploaded or inserted.\n");

  const allFolders = await listKitFolders(ROOT);
  const bookClubFolder = allFolders.find((n) => /^Book club resources$/i.test(n));
  const kitFolders = [];

  // Top-level folders are standard kits.
  for (const name of allFolders) {
    if (name === bookClubFolder) continue;
    kitFolders.push({ name, abs: path.join(ROOT, name) });
  }

  // Book club resources are one level deeper.
  if (bookClubFolder) {
    const bcRoot = path.join(ROOT, bookClubFolder);
    const inner = await fs.readdir(bcRoot, { withFileTypes: true });
    for (const e of inner) {
      if (e.isDirectory() && !e.name.startsWith(".")) {
        kitFolders.push({ name: e.name, abs: path.join(bcRoot, e.name) });
      }
    }
  }

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const k of kitFolders) {
    if (ONLY.length > 0 && !ONLY.includes(k.name)) continue;
    try {
      const parent = path.dirname(k.abs);
      const result = await runOneKit(k.name, parent);
      if (result?.ok) succeeded += 1;
      else if (result?.skipped) skipped += 1;
    } catch (err) {
      failed += 1;
      console.error(`  ! ${k.name} failed: ${err.message}`);
    }
  }

  console.log(`\nDone. succeeded=${succeeded}  skipped=${skipped}  failed=${failed}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Inline shim around importKit so we can pass a parent path explicitly
// without rewriting the original (which read `ROOT` globally).
async function runOneKit(folderName, parentDir) {
  // Folders may be named "Kit - Transition Without Turbulence"; strip the
  // leading "Kit -" so the displayed title + slug are clean.
  const displayName = folderName.replace(/^Kit\s*[-–—]\s*/i, "").trim() || folderName;
  const slug = slugify(displayName);
  if (!slug) return { skipped: true, reason: "empty slug" };

  console.log(`\n→ ${folderName}`);
  console.log(`  title: ${displayName}`);
  console.log(`  slug: ${slug}`);

  const abs = path.join(parentDir, folderName);
  const stat = await fs.stat(abs);
  if (!stat.isDirectory()) return { skipped: true, reason: "not a directory" };

  const entries = await fs.readdir(abs, { withFileTypes: true });
  const filenames = entries.filter((e) => e.isFile()).map((e) => e.name);
  const kitType = detectKitType(filenames);
  console.log(`  kit_type: ${kitType}`);

  if (await kitSlugExists(slug)) {
    console.log("  ✓ already in DB — skipping (idempotent)");
    return { skipped: true, reason: "exists" };
  }

  // Portal card = the SQUARE social cover (2160x2160).
  //
  // The portal grid renders a 1:1 tile, so a square source lands exactly.
  // "Card - Portal Grid (topic-led).png" is 3:4 portrait — cropping that
  // into the square tile zooms in and cuts the kit title off, which is
  // what happened to the Jul 2026 expert kits before this was flipped.
  // Every kit in the library uses the square cover; --portrait-cover is
  // kept only as an escape hatch if a future design needs the tall one.
  const portalCardName = PORTRAIT_COVER
    ? (filenames.find((n) => COVER_PORTAL_RE.test(n)) || filenames.find((n) => COVER_SQUARE_RE.test(n)))
    : (filenames.find((n) => COVER_SQUARE_RE.test(n)) || filenames.find((n) => COVER_PORTAL_RE.test(n)));
  const heroName = filenames.find((n) => COVER_HERO_RE.test(n));

  let portalCardUrl = null;
  let resourceCardUrl = null;
  if (portalCardName) {
    const dest = `${slug}/portal-card${path.extname(portalCardName).toLowerCase()}`;
    portalCardUrl = await uploadFile(
      "kit-thumbnails",
      dest,
      path.join(abs, portalCardName),
      mimeFor(portalCardName),
    );
  }
  if (heroName) {
    const dest = `${slug}/resource-card${path.extname(heroName).toLowerCase()}`;
    resourceCardUrl = await uploadFile(
      "kit-thumbnails",
      dest,
      path.join(abs, heroName),
      mimeFor(heroName),
    );
  }

  const rows = [];
  for (const slot of STANDARD_SLOTS) {
    const match = filenames.find((n) => slot.match.test(n));
    if (!match) continue;
    const safeName = match.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    const storagePath = `${slug}/${safeName}`;
    const stats = await fs.stat(path.join(abs, match));
    const publicLink = await uploadFile(
      slot.bucket,
      storagePath,
      path.join(abs, match),
      mimeFor(match),
    );
    rows.push({
      title: slot.title,
      kind: slot.kind,
      storage_path: storagePath,
      external_url: publicLink,
      mime_type: mimeFor(match),
      file_size_bytes: stats.size,
      position: slot.position,
    });
  }

  // Landscape 16x9 extras: the Expert Spotlight and the Highlight Moments.
  // Uploaded before the 9x16 shorts so they sit directly after the main
  // training video in the portal ordering.
  for (const filename of filenames) {
    const spot = SPOTLIGHT_RE.exec(filename);
    const high = HIGHLIGHT_RE.exec(filename);
    if (!spot && !high) continue;

    // Underscores appear in some source names ("You Can_t") — the title
    // shown to members comes from the kit, not the filename, so keep the
    // captured label but restore the apostrophe form where it's obvious.
    const label = (spot ? spot[2] : high[2]).replace(/_/g, "'").trim();
    const isFullSpot = !!(spot && spot[1]);
    const kind = spot ? "video_spotlight" : "video_highlight";
    const title = spot ? (isFullSpot ? "Expert Spotlight (Full)" : "Expert Spotlight") : `Highlight ${high[1]} — ${label}`;
    const position = spot ? (isFullSpot ? 13 : 12) : 80 + Number(high[1]);

    const safeName = filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    const storagePath = `${slug}/${safeName}`;
    const stats = await fs.stat(path.join(abs, filename));
    const publicLink = await uploadFile(
      "member-resources",
      storagePath,
      path.join(abs, filename),
      mimeFor(filename),
    );
    rows.push({
      title,
      kind,
      storage_path: storagePath,
      external_url: publicLink,
      mime_type: mimeFor(filename),
      file_size_bytes: stats.size,
      position,
    });
  }

  // Shorts upload for ANY kit that has them (expert kits ship 9×16 shorts
  // too); the book_club_payload is only attached for true Book Club kits.
  let bookClubPayload = null;
  {
    const shorts = findShorts(filenames);
    const shortsPayload = [];
    for (const s of shorts) {
      const safeName = s.filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
      const storagePath = `${slug}/${safeName}`;
      const stats = await fs.stat(path.join(abs, s.filename));
      const publicLink = await uploadFile(
        "member-resources",
        storagePath,
        path.join(abs, s.filename),
        mimeFor(s.filename),
      );
      const position = 100 + s.index;
      rows.push({
        title: s.principle,
        kind: "video_short",
        storage_path: storagePath,
        external_url: publicLink,
        mime_type: mimeFor(s.filename),
        file_size_bytes: stats.size,
        position,
      });
      shortsPayload.push({
        index: s.index,
        principle: s.principle,
        position,
        storage_path: storagePath,
        public_url: publicLink,
      });
    }
    if (kitType === "book_club") {
      bookClubPayload = {
        shorts: shortsPayload,
        has_infographic:
          filenames.some((n) => /^Infographic\.png$/i.test(n))
          || filenames.some((n) => /^Infographic\.pdf$/i.test(n)),
      };
    }
  }

  if (rows.length === 0) {
    console.log("  ! no content files matched — skipping");
    return { skipped: true, reason: "no_files" };
  }

  const category = kitType === "book_club" ? BOOK_CLUB_CATEGORY : DEFAULT_CATEGORY;
  const submissionStatus = PUBLISH ? "approved" : "pending_review";
  const isPublished = PUBLISH;
  const now = new Date().toISOString();

  const inserts = rows.map((r) => ({
    topic_slug: slug,
    topic_title: displayName,
    topic_summary: null,
    category,
    portal_card_url: portalCardUrl,
    resource_card_url: resourceCardUrl,
    title: r.title,
    description: null,
    kind: r.kind,
    storage_path: r.storage_path,
    external_url: r.external_url,
    mime_type: r.mime_type,
    file_size_bytes: r.file_size_bytes,
    position: r.position,
    is_free: false,
    is_published: isPublished,
    submission_status: submissionStatus,
    submitted_at: now,
    approved_at: PUBLISH ? now : null,
    kit_type: kitType,
    book_club_payload: kitType === "book_club" ? bookClubPayload : null,
    // Attribution → member-portal-only. Null for unattributed (public) kits.
    originating_expert_id: ORIGINATING_EXPERT_ID,
    originating_vendor_id: ORIGINATING_VENDOR_ID,
  }));

  if (DRY_RUN) {
    console.log(`  [dry] would insert ${inserts.length} rows`);
    return { ok: true, rowsInserted: inserts.length, dry: true };
  }

  const { error } = await supabase.from("resources").insert(inserts);
  if (error) {
    console.error(`  ! insert failed: ${error.message}`);
    return { skipped: true, reason: error.message };
  }
  console.log(`  ✓ inserted ${inserts.length} resources`);
  return { ok: true, rowsInserted: inserts.length };
}

// ─── Arg parser ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      if (out[key] !== undefined) {
        if (!Array.isArray(out[key])) out[key] = [out[key]];
        out[key].push(next);
      } else {
        out[key] = next;
      }
      i += 1;
    }
  }
  return out;
}
