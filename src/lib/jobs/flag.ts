/**
 * Job board kill-switch.
 *
 * Until launch the whole feature is dark: the middleware answers 404 on
 * every job-board page and API, and the nav shells hide their links,
 * unless NEXT_PUBLIC_JOB_BOARD_ENABLED=true. It is NEXT_PUBLIC_ so the
 * same value works in the middleware, server components and the client
 * nav. Set it in .env.local for local testing; it is NOT set in Vercel,
 * so a deploy of this branch shows members nothing.
 */
export function jobBoardEnabled(): boolean {
  return process.env.NEXT_PUBLIC_JOB_BOARD_ENABLED === "true";
}
