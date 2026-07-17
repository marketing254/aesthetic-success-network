/**
 * Extract a readable message from any thrown value. Supabase/PostgREST
 * errors are plain objects (not Error instances), so `instanceof Error`
 * alone hides their message behind "Unknown error".
 */
export function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Unknown error";
}
