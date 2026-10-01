"use client";
import { useEffect, useState } from "react";

/**
 * Returns true when the signed-in user ALSO holds the given role (i.e.
 * they're dual-role), so a portal can show a "View as …" switcher.
 * Backed by GET /api/me/roles. Fails closed (returns false) on any error.
 */
export function useAlsoHasRole(role: "expert" | "vendor"): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/roles", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { expert?: boolean; vendor?: boolean };
        if (!cancelled) setHas(!!body?.[role]);
      } catch {
        /* ignore — no switcher shown */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);
  return has;
}
