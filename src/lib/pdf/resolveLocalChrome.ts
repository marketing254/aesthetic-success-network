import "server-only";
import { existsSync } from "node:fs";

/**
 * Dev-only: locate a system-installed Chrome/Edge for local PDF rendering.
 * Kept in its own module and dynamically imported so this never gets
 * pulled into the Vercel serverless bundle for the routes that render
 * agreement PDFs — the env-var-derived path here isn't statically
 * analyzable, which would otherwise make Next's file tracer bundle the
 * whole project into those functions.
 */
export function resolveLocalChromeExecutable(): string {
  const configured =
    process.env.CHROME_PATH ??
    process.env.CHROMIUM_PATH ??
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    null;
  if (configured && existsSync(/* turbopackIgnore: true */ configured)) return configured;

  const commonPaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = commonPaths.find((candidate) => existsSync(/* turbopackIgnore: true */ candidate));
  if (found) return found;

  throw new Error(
    "Headless Chrome was not found. Set CHROME_PATH, CHROMIUM_PATH, or PUPPETEER_EXECUTABLE_PATH so founding agreement PDFs can be rendered.",
  );
}
