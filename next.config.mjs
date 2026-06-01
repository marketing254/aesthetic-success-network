import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to THIS app so the build never wanders into a
  // parent folder (the repo may also contain src/, TD - Member Network/, etc.).
  // This is the usual fix for failures at the "Collecting build traces" step.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
