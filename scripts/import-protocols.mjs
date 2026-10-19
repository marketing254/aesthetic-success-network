#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * import-protocols.mjs  (Lester's upload guide, 19 Oct 2026)
 *
 * Uploads Protocols from a local folder (downloaded from the experts' Drive
 * folders) using scripts/protocols-manifest.json for the exact words.
 *
 * Per Protocol folder (found anywhere under --root by its title):
 *   00 - Portal card.png            -> cover (kit-thumbnails, public)
 *   01..10 (12 files incl. 09 x2)   -> member content (member-resources),
 *                                      one `resources` row each, in order
 *   11 - Expert Social Pack (...)   -> expert-only downloads
 *                                      (provider-assets, private) - NEVER members
 *
 * Visibility:
 *   manifest status "approved" -> members see it (is_published + approved)
 *   manifest status "pending"  -> only the expert sees it in their portal
 *
 * Also handles the manifest's owner_packs (expert/company-only downloads)
 * and company_pages (media on a company's public page).
 *
 * Usage (from asn-landing/):
 *   node scripts/import-protocols.mjs --root "D:/Aesthetics Success Network/Protocols" --dry-run
 *   node scripts/import-protocols.mjs --root "<path>"                       # upload everything found
 *   node scripts/import-protocols.mjs --root "<path>" --only "Signature Niche"
 *   node scripts/import-protocols.mjs --set-status approved --only "Retail Gap"   # Lester approved one
 *   node scripts/import-protocols.mjs --sample-for rushdha@ekwa.com --only "Technology Decision"
 *        (copies an uploaded Protocol's rows to a test expert as a hidden sample;
 *         no files are uploaded twice. Remove with --remove-sample-for <email>)
 *
 * Idempotent: a Protocol whose slug already exists is skipped (files and
 * rows). Needs migration 0076. Reads .env.local (service-role key).
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

try {
  let undici;
  try { undici = await import("node:undici"); } catch { undici = await import("undici"); }
  if (undici?.Agent && undici?.setGlobalDispatcher) {
    undici.setGlobalDispatcher(new undici.Agent({ headersTimeout: 0, bodyTimeout: 0, connectTimeout: 60_000, keepAliveTimeout: 60_000, keepAliveMaxTimeout: 600_000 }));
  }
} catch { /* retries below still cover most uploads */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const landingDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(landingDir, ".env.local"), quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

// ── CLI ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const ROOT = opt("--root") ? path.resolve(opt("--root")) : null;
const DRY = flag("--dry-run");
const ONLY = opt("--only")?.toLowerCase() ?? null;
const SET_STATUS = opt("--set-status");
const SAMPLE_FOR = opt("--sample-for")?.toLowerCase();
const REMOVE_SAMPLE_FOR = opt("--remove-sample-for")?.toLowerCase();

const manifest = JSON.parse(await fs.readFile(path.join(__dirname, "protocols-manifest.json"), "utf8"));
const protocols = manifest.protocols.filter((p) => !ONLY || p.title.toLowerCase().includes(ONLY));

// ── helpers ──────────────────────────────────────────────────────────────
const MIME = { ".pdf": "application/pdf", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mov": "video/quicktime", ".txt": "text/plain", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
const mimeFor = (f) => MIME[path.extname(f).toLowerCase()] ?? "application/octet-stream";
const assetKind = (f) => { const m = mimeFor(f); return m.startsWith("image/") ? "image" : m.startsWith("video/") ? "video" : m.startsWith("audio/") ? "audio" : m === "application/pdf" ? "pdf" : "other"; };
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/&/g, " and ").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^the-/, "");
const safeName = (f) => f.replace(/[^\w.\-() ]+/g, "").replace(/\s+/g, "-");

// Lester's 12 files: display name, library kind, order.
const SLOTS = [
  { re: /^01\s*-\s*Start Here\.pdf$/i, title: "Start Here", kind: "action_guide" },
  { re: /^02\s*-\s*Practice Scorecard\.pdf$/i, title: "Practice Scorecard", kind: "worksheet" },
  { re: /^03\s*-\s*Full Session Video\.mp4$/i, title: "Full Session Video", kind: "video_full" },
  { re: /^04\s*-\s*The Protocol \(guide\)\.pdf$/i, title: "The Protocol (guide)", kind: "action_guide" },
  { re: /^05\s*-\s*Audio\.mp3$/i, title: "Audio", kind: "audio" },
  { re: /^06\s*-\s*Scripts Pack\.pdf$/i, title: "Scripts Pack", kind: "other" },
  { re: /^07\s*-\s*Checklist and SOP\.pdf$/i, title: "Checklist and SOP", kind: "checklist" },
  { re: /^08\s*-\s*Numbers Sheet\.pdf$/i, title: "Numbers Sheet", kind: "worksheet" },
  { re: /^09\s*-\s*Team Huddle \(guide\)\.pdf$/i, title: "Team Huddle (guide)", kind: "other" },
  { re: /^09\s*-\s*Team Huddle \(video\)\.mp4$/i, title: "Team Huddle (video)", kind: "video_explainer" },
  { re: /^10\s*-\s*Patient Handout\.pdf$/i, title: "Patient Handout", kind: "other" },
];

async function walkDirs(dir, out = []) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) if (e.isDirectory()) { const p = path.join(dir, e.name); out.push(p); await walkDirs(p, out); }
  return out;
}
async function walkFiles(dir, out = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walkFiles(p, out); else out.push(p);
  }
  return out;
}

async function upload(bucket, objectPath, absFile) {
  if (DRY) { console.log(`    [dry] ${bucket}/${objectPath}`); return; }
  const buf = await fs.readFile(absFile);
  const mb = buf.length / 1048576;
  const attempts = mb > 100 ? 5 : 3;
  for (let a = 1; a <= attempts; a += 1) {
    if (mb > 40 && a === 1) console.log(`    uploading ${mb.toFixed(0)} MB ${path.basename(absFile)} ...`);
    const { error } = await supabase.storage.from(bucket).upload(objectPath, buf, { contentType: mimeFor(absFile), upsert: true });
    if (!error || /already exists|Duplicate/i.test(error.message)) return;
    console.log(`    attempt ${a} failed: ${error.message}`);
    if (a === attempts) throw new Error(`Upload failed: ${bucket}/${objectPath}: ${error.message}`);
    await new Promise((r) => setTimeout(r, Math.min(3000 * 2 ** (a - 1), 30000)));
  }
}
const publicUrl = (bucket, p) => supabase.storage.from(bucket).getPublicUrl(p).data.publicUrl;

async function expertByEmail(email) {
  const { data } = await supabase.from("experts").select("id, full_name").ilike("email", email).maybeSingle();
  return data;
}
async function vendorByEmail(email) {
  const { data } = await supabase.from("vendors").select("id, company_name").ilike("contact_email", email).maybeSingle();
  return data;
}

// ── --set-status ─────────────────────────────────────────────────────────
if (SET_STATUS) {
  if (!["approved", "pending"].includes(SET_STATUS) || !ONLY) {
    console.error('Use: --set-status approved|pending --only "<part of the title>"');
    process.exit(1);
  }
  for (const p of protocols) {
    const approved = SET_STATUS === "approved";
    const { data, error } = await supabase.from("resources")
      .update({ is_published: approved, submission_status: approved ? "approved" : "pending_review", approved_at: approved ? new Date().toISOString() : null })
      .eq("topic_slug", slugify(p.title)).select("id");
    console.log(error ? `✗ ${p.title}: ${error.message}` : `✓ ${p.title}: ${SET_STATUS} (${data.length} files)`);
  }
  process.exit(0);
}

// ── --sample-for / --remove-sample-for ───────────────────────────────────
if (SAMPLE_FOR || REMOVE_SAMPLE_FOR) {
  const who = await expertByEmail(SAMPLE_FOR ?? REMOVE_SAMPLE_FOR);
  if (!who) { console.error("No expert with that email."); process.exit(1); }
  if (REMOVE_SAMPLE_FOR) {
    const r1 = await supabase.from("resources").delete().like("topic_slug", "sample-%").eq("originating_expert_id", who.id).select("id");
    const r2 = await supabase.from("provider_assets").delete().like("group_slug", "sample-%").eq("expert_id", who.id).select("id");
    console.log(`✓ removed ${r1.data?.length ?? 0} sample files and ${r2.data?.length ?? 0} sample downloads from ${who.full_name}`);
    process.exit(0);
  }
  const p = protocols[0];
  if (!p) { console.error('Add --only "<part of an uploaded Protocol title>"'); process.exit(1); }
  const src = slugify(p.title), dst = `sample-${src}`;
  const { data: rows } = await supabase.from("resources").select("*").eq("topic_slug", src);
  if (!rows?.length) { console.error(`Upload "${p.title}" first.`); process.exit(1); }
  const { data: exists } = await supabase.from("resources").select("id").eq("topic_slug", dst).limit(1);
  if (exists?.length) { console.log("Sample already exists."); process.exit(0); }
  const copies = rows.map(({ id, created_at, updated_at, ...r }) => ({ ...r, topic_slug: dst, topic_title: `Sample: ${r.topic_title}`, originating_expert_id: who.id, is_published: false, submission_status: "pending_review", approved_at: null }));
  const { error } = await supabase.from("resources").insert(copies);
  if (error) { console.error(error.message); process.exit(1); }
  const { data: assets } = await supabase.from("provider_assets").select("*").eq("group_slug", `${src}-social`);
  if (assets?.length) await supabase.from("provider_assets").insert(assets.map(({ id, created_at, ...a }) => ({ ...a, expert_id: who.id, vendor_id: null, group_slug: `sample-${a.group_slug}`, group_title: `Sample: ${a.group_title}` })));
  console.log(`✓ sample "${p.title}" added to ${who.full_name} (hidden from members). Remove with --remove-sample-for ${SAMPLE_FOR}`);
  process.exit(0);
}

// ── upload ───────────────────────────────────────────────────────────────
if (!ROOT) { console.error('Missing --root "<folder with the downloaded Protocols>"'); process.exit(1); }
const allDirs = await walkDirs(ROOT);
const summary = [];

for (const p of protocols) {
  try {
    await importOne(p);
  } catch (err) {
    console.log(`  ✗ stopped: ${err?.message ?? err}. Nothing saved for this Protocol; fix and re-run.`);
    summary.push([p.title, `failed: ${String(err?.message ?? err).slice(0, 60)}`]);
  }
}

async function importOne(p) {
  const slug = slugify(p.title);
  console.log(`\n■ ${p.title}`);
  const dir = allDirs.find((d) => { const n = path.basename(d).toLowerCase(); return n === p.title.toLowerCase() || n.endsWith(`- ${p.title.toLowerCase()}`); });
  if (!dir) { console.log("  - folder not found under --root (download it from Drive first)"); summary.push([p.title, "folder missing"]); return; }
  const expert = await expertByEmail(p.expert_email);
  if (!expert) { console.log(`  - no expert account for ${p.expert_email} yet (they have not accepted); skipped`); summary.push([p.title, "no expert account yet"]); return; }
  const { data: existing } = await supabase.from("resources").select("id").eq("topic_slug", slug).limit(1);
  if (existing?.length) { console.log("  - already uploaded; skipped"); summary.push([p.title, "already uploaded"]); return; }

  const names = (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name);
  const card = names.find((n) => /^00\s*-\s*Portal card\.(png|jpe?g|webp)$/i.test(n));
  const missing = SLOTS.filter((s) => !names.some((n) => s.re.test(n))).map((s) => s.title);
  if (!card) missing.unshift("Portal card");
  if (missing.length) { console.log(`  ! missing files: ${missing.join(", ")}. Skipped so a half Protocol never shows.`); summary.push([p.title, `missing: ${missing.join(", ")}`]); return; }

  const cardPath = `protocols/${slug}${path.extname(card).toLowerCase()}`;
  await upload("kit-thumbnails", cardPath, path.join(dir, card));
  const cardUrl = publicUrl("kit-thumbnails", cardPath);

  const approved = p.status === "approved";
  const now = new Date().toISOString();
  const rows = [];
  for (const [i, s] of SLOTS.entries()) {
    const file = names.find((n) => s.re.test(n));
    const obj = `protocols/${slug}/${safeName(file)}`;
    await upload("member-resources", obj, path.join(dir, file));
    const st = await fs.stat(path.join(dir, file));
    rows.push({
      topic_slug: slug, topic_title: p.title, topic_summary: p.description, category: p.category, tags: p.tags,
      portal_card_url: cardUrl, resource_card_url: cardUrl, thumbnail_url: cardUrl,
      title: s.title, description: null, kind: s.kind, storage_path: publicUrl("member-resources", obj),
      mime_type: mimeFor(file), file_size_bytes: st.size, position: (i + 1) * 10,
      is_free: false, is_published: approved, submission_status: approved ? "approved" : "pending_review",
      submitted_at: now, approved_at: approved ? now : null, kit_type: "standard", originating_expert_id: expert.id,
    });
  }
  if (!DRY) {
    const { error } = await supabase.from("resources").insert(rows);
    if (error) { console.log(`  ✗ save failed: ${error.message}`); summary.push([p.title, `error: ${error.message}`]); return; }
  }

  // Expert-only social pack (never members).
  const social = allDirs.find((d) => path.dirname(d) === dir && /^11\s*-\s*Expert Social Pack/i.test(path.basename(d)));
  let socialCount = 0;
  if (social) {
    const files = (await walkFiles(social)).sort();
    const assets = [];
    for (const [i, f] of files.entries()) {
      const obj = `protocols/${slug}/social/${safeName(path.relative(social, f))}`;
      await upload("provider-assets", obj, f);
      const st = await fs.stat(f);
      assets.push({ expert_id: expert.id, audience: "owner", group_slug: `${slug}-social`, group_title: `Social pack: ${p.title}`, title: path.basename(f, path.extname(f)), kind: assetKind(f), storage_path: obj, mime_type: mimeFor(f), file_size_bytes: st.size, position: i });
    }
    if (!DRY && assets.length) {
      const { error } = await supabase.from("provider_assets").upsert(assets, { onConflict: "group_slug,storage_path" });
      if (error) console.log(`  ! social pack save failed: ${error.message}`);
    }
    socialCount = assets.length;
  }
  console.log(`  ✓ ${rows.length + 1} files (card + ${rows.length}) for ${expert.full_name} (${approved ? "visible to members" : "hidden from members until approved"}), ${socialCount} social pack files`);
  summary.push([p.title, `${DRY ? "would upload" : "uploaded"}, ${approved ? "approved" : "pending"}, social ${socialCount}`]);
}

// Owner packs + company pages (only when not filtering to one Protocol).
async function uploadPack({ ownerKey, ownerId, audience, groupSlug, groupTitle, files }) {
  const assets = [];
  for (const [i, f] of files.entries()) {
    const obj = `${audience === "owner" ? "owner" : "company"}/${groupSlug}/${safeName(f.rel)}`;
    await upload("provider-assets", obj, f.abs);
    const st = await fs.stat(f.abs);
    assets.push({ [ownerKey]: ownerId, audience, group_slug: groupSlug, group_title: groupTitle, title: f.title ?? path.basename(f.abs, path.extname(f.abs)), kind: f.kind ?? assetKind(f.abs), storage_path: obj, mime_type: mimeFor(f.abs), file_size_bytes: st.size, position: f.position ?? i });
  }
  if (!DRY && assets.length) {
    const { error } = await supabase.from("provider_assets").upsert(assets, { onConflict: "group_slug,storage_path" });
    if (error) throw new Error(error.message);
  }
  return assets.length;
}

if (!ONLY) {
  const allFiles = await walkFiles(ROOT);
  for (const pk of manifest.owner_packs ?? []) {
    const owner = pk.expert_email ? await expertByEmail(pk.expert_email) : await vendorByEmail(pk.vendor_email);
    const label = `Owner pack "${pk.group_title}"`;
    if (!owner) { summary.push([label, "owner has no account yet"]); continue; }
    let files = [];
    if (pk.folder_match) {
      const d = allDirs.find((x) => path.basename(x).toLowerCase().includes(pk.folder_match.toLowerCase()));
      if (d) files = (await walkFiles(d)).sort().map((abs) => ({ abs, rel: path.relative(d, abs) }));
    } else if (pk.file_match) {
      files = allFiles.filter((f) => path.basename(f).toLowerCase().includes(pk.file_match.toLowerCase())).map((abs) => ({ abs, rel: path.basename(abs) }));
    }
    if (!files.length) { summary.push([label, "files not found under --root"]); continue; }
    const n = await uploadPack({ ownerKey: pk.expert_email ? "expert_id" : "vendor_id", ownerId: owner.id, audience: "owner", groupSlug: slugify(`${pk.group_title}-${pk.expert_email ?? pk.vendor_email}`), groupTitle: pk.group_title, files });
    summary.push([label, `${DRY ? "would upload" : "uploaded"} ${n} files`]);
  }
  for (const cp of manifest.company_pages ?? []) {
    const label = `Company page media (${cp.vendor_email})`;
    const vendor = await vendorByEmail(cp.vendor_email);
    if (!vendor) { summary.push([label, "company has no account yet"]); continue; }
    const d = allDirs.find((x) => path.basename(x).toLowerCase().includes(cp.folder_match.toLowerCase()));
    if (!d) { summary.push([label, "folder not found under --root"]); continue; }
    const inDir = await walkFiles(d);
    const files = cp.files.map((spec, i) => { const abs = inDir.find((f) => path.basename(f).toLowerCase().endsWith(spec.match.toLowerCase())); return abs ? { abs, rel: path.basename(abs), title: spec.role === "card" ? "card" : spec.title, kind: spec.kind, position: i } : null; }).filter(Boolean);
    const n = await uploadPack({ ownerKey: "vendor_id", ownerId: vendor.id, audience: "company_page", groupSlug: slugify(`company-${cp.vendor_email}`), groupTitle: vendor.company_name, files });
    summary.push([label, `${DRY ? "would upload" : "uploaded"} ${n} files`]);
  }
}

console.log(`\n${DRY ? "DRY RUN (nothing uploaded)" : "Done"}:`);
for (const [t, s] of summary) console.log(`  ${t.padEnd(46)} ${s}`);
