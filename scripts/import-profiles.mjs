#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * import-profiles.mjs
 *
 * Populate the member-portal + directory profile fields for accepted
 * experts / partners from a local assets folder, and upload their
 * headshots + logos to Storage.
 *
 * These people already exist in the DB (they accepted a founding invite
 * or were added from the admin console), so this UPDATES their
 * `experts` / `vendors` rows by email — it never creates rows.
 * Idempotent: safe to re-run.
 *
 * It does NOT touch status/verification (they're already approved from
 * acceptance) and it does NOT create offers (add those via Admin → Partner
 * offers, which handles the catalog item + review properly).
 *
 * The people to import live in a JSON file you keep OUTSIDE the repo
 * (it contains personal contact details). Shape: see PROFILE_EXAMPLE
 * below, or run with --print-example to dump a starter file.
 *
 * Usage (from the project root):
 *   node scripts/import-profiles.mjs --print-example > profiles.local.json
 *   node scripts/import-profiles.mjs --root "<assets-folder>" --profiles "<path>/profiles.local.json" --dry-run
 *   node scripts/import-profiles.mjs --root "<assets-folder>" --profiles "<path>/profiles.local.json"
 *
 * Image paths inside the JSON are relative to --root.
 * Partner `category` must be one of the ASN partner categories
 * (ASN-SWAP-CANON.md §4); the script refuses anything else.
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const landingDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(landingDir, ".env.local") });
dotenv.config({ path: path.join(landingDir, ".env") });

const args = parseArgs(process.argv.slice(2));

// ─── Example profile file (also printed by --print-example) ───────────────
const PROFILE_EXAMPLE = [
  {
    label: "Jane Doe / Example Skincare Co. (EXPERT + PARTNER)",
    expert: {
      email: "jane@example.com",
      display_name: "Jane Doe",
      full_name: "Jane Doe, RN",
      specialty: "Injectables pricing & margins",
      topics: "Injectables pricing & margins, Consult conversion",
      company_name: "Example Skincare Co.",
      website: "https://www.example.com",
      booking_link: "https://calendly.com/example/20",
      bio: "Two or three sentences the expert supplied, used on the directory card and profile.",
      headshot: "Jane Doe/Profile Assets/headshot.jpg",
    },
    partner: {
      contact_email: "jane@example.com",
      company_name: "Example Skincare Co.",
      display_name: "Example Skincare Co.",
      category: "Skincare & product lines",
      website: "https://www.example.com",
      calendar_link: "https://calendly.com/example/20",
      description: "One or two sentences about the company.",
      logo: "Jane Doe/Profile Assets/logo.png",
      offer_note: "Optional reminder of the member offer to add via Admin → Partner offers.",
    },
  },
  {
    label: "John Smith (EXPERT ONLY)",
    expert: {
      email: "john@example.com",
      display_name: "John Smith",
      full_name: "John Smith, PA-C",
      specialty: "Med spa operations",
      company_name: "Smith Consulting",
      bio: "Short bio.",
      headshot: "John Smith/Profile Assets/headshot.jpg",
    },
  },
];

if (args["print-example"]) {
  console.log(JSON.stringify(PROFILE_EXAMPLE, null, 2));
  process.exit(0);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

if (!args.root || !args.profiles) {
  console.error("usage: node scripts/import-profiles.mjs --root <assets-folder> --profiles <profiles.json> [--dry-run]");
  process.exit(1);
}

const ROOT = path.resolve(args.root);
const PROFILES_PATH = path.resolve(args.profiles);
const DRY_RUN = !!args["dry-run"];
const BUCKET = "kit-thumbnails"; // public bucket; headshots/logos go under profiles/

if (!existsSync(ROOT)) {
  console.error(`Assets folder doesn't exist: ${ROOT}`);
  process.exit(1);
}
if (!existsSync(PROFILES_PATH)) {
  console.error(`Profiles file doesn't exist: ${PROFILES_PATH}`);
  process.exit(1);
}

// ASN partner categories (ASN-SWAP-CANON.md §4). Mirrors vendorCategories in the app.
const PARTNER_CATEGORIES = [
  "Injectables & pharmaceuticals",
  "Devices & equipment (lasers, energy-based)",
  "Skincare & product lines",
  "Practice-management software",
  "Marketing & growth",
  "Patient financing",
  "Staffing & HR",
  "Coaching & consulting",
  "Continuing education",
  "Accounting & CFO",
  "Other",
];

// Never SVG: logos/avatars are rendered inline and SVG can carry scripts.
const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PEOPLE = JSON.parse(await fs.readFile(PROFILES_PATH, "utf8"));
if (!Array.isArray(PEOPLE)) {
  console.error("Profiles file must be a JSON array (see --print-example).");
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function mimeFor(f) {
  return MIME[path.extname(f).toLowerCase()] ?? null;
}
function slugify(s) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

async function uploadImage(relPath, destName) {
  const abs = path.join(ROOT, relPath);
  if (!existsSync(abs)) {
    console.warn(`   ! file not found, skipping: ${relPath}`);
    return null;
  }
  const contentType = mimeFor(relPath);
  if (!contentType) {
    console.warn(`   ! unsupported image type (png/jpg/webp only), skipping: ${relPath}`);
    return null;
  }
  const dest = `profiles/${destName}${path.extname(relPath).toLowerCase()}`;
  if (DRY_RUN) {
    console.log(`   [dry] upload ${relPath} -> ${BUCKET}/${dest}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(dest);
    return data?.publicUrl ?? null;
  }
  const buf = await fs.readFile(abs);
  const { error } = await supabase.storage.from(BUCKET).upload(dest, buf, {
    contentType,
    upsert: true,
  });
  if (error && !/already exists|Duplicate/i.test(error.message)) {
    throw new Error(`upload failed (${dest}): ${error.message}`);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(dest);
  console.log(`   ✓ uploaded ${dest}`);
  return data?.publicUrl ?? null;
}

async function updateRow(table, matchCol, matchVal, patch) {
  if (DRY_RUN) {
    console.log(`   [dry] update ${table} where ${matchCol}=${matchVal}:`, Object.keys(patch).join(", "));
    return true;
  }
  // Exact (case-insensitive) match on the email column — never a pattern.
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .ilike(matchCol, String(matchVal).replace(/[%_\\]/g, "\\$&"))
    .select("id");
  if (error) throw new Error(`${table} update failed: ${error.message}`);
  if (!data || data.length === 0) {
    console.warn(`   ! no ${table} row matched ${matchCol}=${matchVal} — is the person accepted/added yet?`);
    return false;
  }
  console.log(`   ✓ updated ${table} (${data.length} row)`);
  return true;
}

// ─── Driver ──────────────────────────────────────────────────────────────
(async () => {
  console.log(`Profiles import — root: ${ROOT}\n  profiles: ${PROFILES_PATH}${DRY_RUN ? "  (DRY RUN)" : ""}\n`);
  let ok = 0;
  let warn = 0;

  for (const person of PEOPLE) {
    console.log(`→ ${person.label ?? person.expert?.email ?? person.partner?.contact_email ?? "(unlabelled)"}`);

    // Expert
    if (person.expert) {
      const e = person.expert;
      if (!e.email || !e.display_name) {
        console.warn("   ! expert needs at least email + display_name — skipped");
        warn++;
      } else {
        const slug = slugify(e.display_name);
        let headshotUrl = null;
        try {
          if (e.headshot) headshotUrl = await uploadImage(e.headshot, `${slug}-headshot`);
        } catch (err) { console.warn(`   ! headshot: ${err.message}`); warn++; }
        const patch = {};
        // Only send the keys this person actually has, so an omitted key
        // never blanks an existing value.
        for (const key of ["display_name", "full_name", "specialty", "company_name", "bio", "website", "booking_link", "topics"]) {
          if (e[key] !== undefined) patch[key] = e[key];
        }
        if (headshotUrl) { patch.headshot_url = headshotUrl; patch.avatar_url = headshotUrl; }
        try {
          (await updateRow("experts", "email", e.email, patch)) ? ok++ : warn++;
        } catch (err) { console.error(`   ! expert update: ${err.message}`); warn++; }
      }
    }

    // Partner (vendor)
    if (person.partner) {
      const p = person.partner;
      if (!p.contact_email || !p.company_name) {
        console.warn("   ! partner needs at least contact_email + company_name — skipped");
        warn++;
      } else if (p.category !== undefined && !PARTNER_CATEGORIES.includes(p.category)) {
        console.warn(`   ! partner category "${p.category}" is not an ASN category — skipped. Use one of: ${PARTNER_CATEGORIES.join(" | ")}`);
        warn++;
      } else {
        const slug = slugify(p.company_name);
        let logoUrl = null;
        try {
          if (p.logo) logoUrl = await uploadImage(p.logo, `${slug}-logo`);
        } catch (err) { console.warn(`   ! logo: ${err.message}`); warn++; }
        const patch = {};
        for (const key of ["company_name", "display_name", "category", "website", "calendar_link", "description"]) {
          if (p[key] !== undefined) patch[key] = p[key];
        }
        if (logoUrl) { patch.logo_url = logoUrl; patch.avatar_url = logoUrl; }
        try {
          (await updateRow("vendors", "contact_email", p.contact_email, patch)) ? ok++ : warn++;
        } catch (err) { console.error(`   ! partner update: ${err.message}`); warn++; }
        if (p.offer_note) console.log(`   ↳ Offer to add via Admin → Partner offers: "${p.offer_note}"`);
      }
    }
    console.log("");
  }

  console.log(`Done. updated=${ok}  warnings=${warn}`);
  if (warn > 0) console.log("Review warnings above (usually: person not accepted yet, or a missing image file).");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}
