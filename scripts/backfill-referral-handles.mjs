#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * backfill-referral-handles.mjs
 *
 * Ensures every active expert + partner has a referral code AND a vanity
 * handle (aestheticsuccessnetwork.com/<handle>), so their shareable link exists
 * immediately instead of only being minted on first portal login.
 *
 * Idempotent: existing codes keep their code; a missing handle is filled in.
 * Requires 0046_referral_slug_revenue.sql to have been run first.
 *
 * Usage (from landing/):
 *   node scripts/backfill-referral-handles.mjs --dry-run
 *   node scripts/backfill-referral-handles.mjs
 */

import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(dir, "..", ".env.local") });
const DRY = process.argv.includes("--dry-run");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ---- mirror of lib/referral.ts (kept in sync) ----
function slugifyHandle(name) {
  const words = (name || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  while (words.length > 1 && ["the", "a", "an"].includes(words[0])) words.shift();
  let h = words.slice(0, 2).join("");
  if (h.length < 4 && words.length > 2) h = words.slice(0, 3).join("");
  return h.slice(0, 20);
}
const CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SUF_ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
function code(prefix) {
  let s = ""; for (let i = 0; i < 4; i++) s += CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)];
  const clean = (prefix || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "ASN";
  return clean + s;
}
function suf(n) { let s = ""; for (let i = 0; i < n; i++) s += SUF_ALPHA[Math.floor(Math.random() * SUF_ALPHA.length)]; return s; }

async function handleTaken(h) {
  const { data } = await sb.from("referral_codes").select("id").ilike("slug", h).maybeSingle();
  return !!data;
}
async function allocHandle(name, fallbackCode) {
  const base = slugifyHandle(name) || fallbackCode.toLowerCase();
  if (!(await handleTaken(base))) return base;
  for (let i = 0; i < 8; i++) { const c = `${base}-${suf(i < 4 ? 2 : 3)}`; if (!(await handleTaken(c))) return c; }
  return `${base}-${fallbackCode.toLowerCase()}`;
}

async function ensureFor(ownerCol, ownerId, name) {
  const { data: existing } = await sb.from("referral_codes").select("id, code, slug").eq(ownerCol, ownerId).maybeSingle();
  if (existing) {
    if (existing.slug) return { name, code: existing.code, slug: existing.slug, action: "ok" };
    const slug = await allocHandle(name, existing.code);
    if (!DRY) await sb.from("referral_codes").update({ slug }).eq("id", existing.id);
    return { name, code: existing.code, slug, action: "handle-added" };
  }
  const c = code(name);
  const slug = await allocHandle(name, c);
  if (!DRY) {
    const { error } = ownerCol === "expert_id"
      ? await sb.from("referral_codes").insert({ expert_id: ownerId, code: c, slug })
      : await sb.from("referral_codes").insert({ vendor_id: ownerId, code: c, slug });
    if (error) return { name, error: error.message, action: "FAILED" };
  }
  return { name, code: c, slug, action: "created" };
}

async function main() {
  console.log(`Backfill referral handles${DRY ? "  (DRY RUN)" : ""}\n`);
  const { error: colErr } = await sb.from("referral_codes").select("slug").limit(1);
  if (colErr) { console.error("✗ referral_codes.slug missing — run 0046 first."); process.exit(1); }

  const { data: experts } = await sb.from("experts").select("id, display_name, full_name, status").not("status", "in", "(archived,suspended)");
  const { data: vendors } = await sb.from("vendors").select("id, display_name, company_name, status").eq("status", "approved");

  console.log(`Experts: ${experts?.length ?? 0}, Partners: ${vendors?.length ?? 0}\n`);
  for (const e of experts ?? []) {
    const r = await ensureFor("expert_id", e.id, e.display_name || e.full_name || "ASN");
    console.log(`  [${r.action.padEnd(12)}] expert  ${String(r.name).padEnd(24)} -> /${r.slug ?? "?"}  (${r.code ?? r.error})`);
  }
  for (const v of vendors ?? []) {
    const r = await ensureFor("vendor_id", v.id, v.display_name || v.company_name || "ASN");
    console.log(`  [${r.action.padEnd(12)}] partner ${String(r.name).padEnd(24)} -> /${r.slug ?? "?"}  (${r.code ?? r.error})`);
  }
  console.log("\nDone.");
}
main().catch((e) => { console.error(e); process.exit(1); });
