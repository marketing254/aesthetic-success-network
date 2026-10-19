"use client";

import ProviderDownloads from "@/components/shared/ProviderDownloads";

/** Company-only downloads: kit overview and launch materials (never members). */
export default function VendorDownloadsPage() {
  return <ProviderDownloads endpoint="/api/vendor/downloads" who="company" />;
}
