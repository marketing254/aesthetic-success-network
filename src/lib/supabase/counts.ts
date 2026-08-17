import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Count rows without transferring any.
 *
 * `head: true` + `count: "exact"` makes PostgREST answer with the total in
 * the Content-Range header and an empty body, so a 50,000-row table costs
 * the same as an empty one. Prefer this over `select("id").length` — that
 * pattern downloads the whole table just to measure it.
 *
 *   const total   = await countRows(db, "waitlist_signups");
 *   const pending = await countRows(db, "expert_applications",
 *                                   { in: { status: ["new", "in_review"] } });
 *
 * Filters are a small declarative spec rather than a builder callback so
 * this stays free of postgrest-js internal types.
 */
export type CountFilter = {
  /** column = value */
  eq?: Record<string, string | number | boolean>;
  /** column IN (…values) */
  in?: Record<string, readonly (string | number)[]>;
  /** column >= value */
  gte?: Record<string, string | number>;
};

/**
 * Returns 0 rather than throwing when the table doesn't exist yet (some
 * installs haven't run the later migrations) or the query fails — these
 * are dashboard figures, never authorization decisions.
 */
export async function countRows(
  supabase: SupabaseClient,
  table: string,
  filter?: CountFilter,
): Promise<number> {
  try {
    let query = supabase.from(table).select("*", { count: "exact", head: true });

    for (const [column, value] of Object.entries(filter?.eq ?? {})) {
      query = query.eq(column, value);
    }
    for (const [column, values] of Object.entries(filter?.in ?? {})) {
      query = query.in(column, values as (string | number)[]);
    }
    for (const [column, value] of Object.entries(filter?.gte ?? {})) {
      query = query.gte(column, value);
    }

    const { count, error } = await query;
    if (error) {
      console.error(`[counts] ${table} failed:`, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error(`[counts] ${table} threw:`, err);
    return 0;
  }
}
