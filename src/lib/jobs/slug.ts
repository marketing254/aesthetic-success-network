import "server-only";
import { randomBytes } from "node:crypto";
import { roleLabel } from "./constants";

/**
 * Public job URLs, e.g. /jobs/nurse-injector-rn-np-austin-tx-4f2a.
 *
 * The words carry the search terms Google matches on, the four-character
 * suffix guarantees uniqueness without a retry loop or a lookup — two
 * practices in Austin hiring a hygienist on the same day is not a rare
 * event on a board this size.
 *
 * A slug is assigned once at insert and never regenerated. Editing the
 * title of a live post must NOT move its URL: we promoted that link to
 * the Facebook group and Google has it indexed.
 */

const SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no i/l/o/0/1

function words(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function randomSuffix(len = 4): string {
  // crypto over Math.random: slugs are public identifiers, and a
  // predictable suffix would let anyone enumerate posts that are still
  // in review by guessing URLs.
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i += 1) out += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length];
  return out;
}

export function buildJobSlug(input: {
  role: string;
  role_other?: string | null;
  location: string;
}): string {
  const rolePart = words(roleLabel(input.role, input.role_other)).slice(0, 4);
  const locationPart = words(input.location).slice(0, 3);
  const stem = [...rolePart, ...locationPart].join("-").slice(0, 100).replace(/-+$/, "");
  // Everything could strip to nothing if a member typed a location in a
  // non-latin script; "job" keeps the URL readable rather than bare.
  return `${stem || "job"}-${randomSuffix()}`;
}
