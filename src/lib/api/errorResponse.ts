import "server-only";
import { NextResponse } from "next/server";

/**
 * Centralised API error responses.
 *
 * The rule: detailed errors (DB messages, stack traces, Stripe error codes,
 * SQL constraint names, JWT payloads) NEVER cross the network back to the
 * browser. They stay in server logs where only operators can read them.
 *
 * The client gets one of a small set of generic messages chosen by error
 * category. The optional `code` field lets the UI route to a specific user
 * action (e.g. "ratelimited" → show a retry timer) without leaking the
 * underlying detail.
 *
 * Usage:
 *
 *   try {
 *     await admin.from('members').update({...}).eq('id', id);
 *   } catch (err) {
 *     return serverError(err, { route: 'PATCH /api/member/me' });
 *   }
 *
 * The browser sees:  { error: "Something went wrong. Please try again." }
 * The server sees:   [error] PATCH /api/member/me — duplicate key violation on...
 */

const GENERIC_BY_STATUS: Record<number, string> = {
  400: "That request couldn't be processed. Please check what you entered and try again.",
  401: "Please sign in to continue.",
  403: "You don't have access to that.",
  404: "We couldn't find that.",
  409: "That action couldn't be completed right now.",
  413: "That file is too large.",
  422: "Something about that submission isn't valid. Please review and try again.",
  429: "Too many attempts in a short time. Wait a minute, then try again.",
  500: "Something went wrong. Please try again.",
  502: "We're having trouble reaching a service. Please try again.",
  503: "That service isn't available right now. Please try again shortly.",
};

type ServerErrorContext = {
  /** e.g. 'POST /api/expert/posts' — for log triage */
  route?: string;
  /** Override the default status code (default 500). */
  status?: number;
  /** Stable code the client UI can switch on (e.g. 'ratelimited'). */
  code?: string;
  /** Optional override of the user-facing message (must be sanitised). */
  publicMessage?: string;
  /** Extra context for the server log only. */
  extra?: Record<string, unknown>;
};

/**
 * Log the full error to the server console, return a generic message to
 * the client. Default status is 500.
 *
 * Server log includes: the route, the original error, and any extra
 * context. None of this travels to the browser.
 */
export function serverError(
  err: unknown,
  ctx: ServerErrorContext = {},
): NextResponse {
  const status = ctx.status ?? 500;
  const route = ctx.route ?? "(unknown route)";

  // Server-only log. Operators read this via Vercel / hosting logs.
  // The browser never sees it.
  const errSummary =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { value: err };
  // Using console.error so it surfaces in production server logs
  // regardless of NODE_ENV. The next.config.ts `removeConsole` excludes
  // 'error' so even client bundles keep console.error available — but
  // this file is server-only so it never reaches a client bundle.
  console.error(`[api:error] ${route} (${status})`, {
    err: errSummary,
    ...(ctx.extra ?? {}),
  });

  const publicMessage =
    ctx.publicMessage ?? GENERIC_BY_STATUS[status] ?? GENERIC_BY_STATUS[500]!;

  return NextResponse.json(
    { error: publicMessage, ...(ctx.code ? { code: ctx.code } : {}) },
    { status },
  );
}

/**
 * Client-input errors — bad JSON, missing fields, validation failures.
 * Same generic-message guarantee, but tuned for the 4xx range and lets
 * the caller pass a short user-facing hint that's already sanitised.
 *
 * Use for cases where you WANT to tell the user what to fix — e.g.
 * "Email is required" or "Password must be at least 8 characters". Never
 * pass through DB / Stripe / internal error text here.
 */
export function clientError(
  publicMessage: string,
  ctx: { status?: number; code?: string; route?: string; extra?: Record<string, unknown> } = {},
): NextResponse {
  const status = ctx.status ?? 400;
  // Sanity-check: refuse to surface anything that looks like an internal
  // error string. If a caller passes a raw Error.message by accident,
  // we strip it down to the generic message.
  const safe = isInternalLeakage(publicMessage)
    ? GENERIC_BY_STATUS[status] ?? GENERIC_BY_STATUS[400]!
    : publicMessage;
  if (ctx.route) {
    console.warn(`[api:client] ${ctx.route} (${status}) — ${safe}`, ctx.extra ?? {});
  }
  return NextResponse.json(
    { error: safe, ...(ctx.code ? { code: ctx.code } : {}) },
    { status },
  );
}

/**
 * Returns true if the string smells like an internal/runtime error or
 * a DB constraint message we shouldn't show to the user. Used as a
 * defensive guard so a passthrough of `err.message` accidentally
 * reaching clientError() still gets scrubbed.
 */
function isInternalLeakage(s: string): boolean {
  const lower = s.toLowerCase();
  return (
    lower.includes("constraint") ||
    lower.includes("violation") ||
    lower.includes("duplicate key") ||
    lower.includes("foreign key") ||
    lower.includes("relation \"") ||
    lower.includes("column \"") ||
    lower.includes("stack trace") ||
    lower.includes("at object.") ||
    lower.includes("at function.") ||
    /^[A-Z]\w+Error:\s/.test(s) // "TypeError: ...", "ReferenceError: ..."
  );
}

/**
 * Sugar — convenience wrappers for the common cases. Each just calls
 * serverError/clientError with the right status, but reads cleaner at
 * the call site.
 */
export const apiError = {
  badRequest: (msg = GENERIC_BY_STATUS[400]!, route?: string) =>
    clientError(msg, { status: 400, route }),
  unauthorized: (route?: string) =>
    clientError(GENERIC_BY_STATUS[401]!, { status: 401, route }),
  forbidden: (route?: string) =>
    clientError(GENERIC_BY_STATUS[403]!, { status: 403, route }),
  notFound: (route?: string) =>
    clientError(GENERIC_BY_STATUS[404]!, { status: 404, route }),
  conflict: (msg = GENERIC_BY_STATUS[409]!, route?: string) =>
    clientError(msg, { status: 409, route }),
  validation: (msg = GENERIC_BY_STATUS[422]!, route?: string) =>
    clientError(msg, { status: 422, route }),
  rateLimited: (route?: string) =>
    clientError(GENERIC_BY_STATUS[429]!, { status: 429, route, code: "ratelimited" }),
  internal: (err: unknown, ctx: ServerErrorContext = {}) =>
    serverError(err, ctx),
};
