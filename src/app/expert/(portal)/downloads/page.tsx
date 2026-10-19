"use client";

import ProviderDownloads from "@/components/shared/ProviderDownloads";

/** Expert-only downloads: social packs and share kits (never members). */
export default function ExpertDownloadsPage() {
  return <ProviderDownloads endpoint="/api/expert/downloads" who="expert" />;
}
