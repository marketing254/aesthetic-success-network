"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a fetch-on-mount list fresh without a manual reload.
 *
 * Re-runs `load` (a) whenever the tab regains focus or becomes visible
 * again, and (b) every `intervalMs` while the tab is visible. Nothing
 * runs while the tab is hidden, so a page left open in the background
 * costs nothing. Used by the job lists on the member, admin and job
 * seeker sides so an approval on one screen shows up on the other
 * within seconds, and a fresh application appears while the practice
 * is looking at its applicants.
 *
 * Deliberately plain polling rather than Supabase Realtime: every job
 * list here reads through a server route that applies ownership checks
 * and signs CV links, and none of that can be replicated by a browser
 * subscription to the raw tables.
 */
export function useLiveRefresh(load: () => Promise<void> | void, opts: { intervalMs?: number; enabled?: boolean } = {}): void {
  const { intervalMs = 15_000, enabled = true } = opts;
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    let inFlight = false;
    const run = () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      Promise.resolve(loadRef.current()).finally(() => {
        inFlight = false;
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(run, intervalMs);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [intervalMs, enabled]);
}
