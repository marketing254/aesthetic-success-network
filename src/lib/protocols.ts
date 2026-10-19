import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// resources.tags and provider_assets arrive with migration 0076 and are not
// in the generated types yet, so these queries use an untyped client.
const db = () => getSupabaseAdmin() as unknown as SupabaseClient;

/**
 * Protocols in the expert portal (Lester's guide, 19 Oct 2026).
 * A Protocol = the `resources` rows sharing one topic_slug, owned through
 * originating_expert_id. The expert sees all of their own, approved or not;
 * members see one only when is_published AND submission_status='approved'.
 *
 * Provider downloads = `provider_assets` (private bucket "provider-assets"):
 * the expert's social packs, share kits and launch packs, or a company's
 * own files. Members never see audience 'owner'.
 */

export type ProtocolStatus = "live" | "pending";

export type ProtocolSummary = {
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  cover: string | null;
  status: ProtocolStatus;
  fileCount: number;
  videoCount: number;
  pdfCount: number;
};

export type ProtocolFile = {
  id: string;
  title: string;
  kind: string;
  type: "video" | "audio" | "pdf" | "image" | "other";
  url: string;
  sizeBytes: number | null;
};

type Row = {
  id: string;
  topic_slug: string;
  topic_title: string;
  topic_summary: string | null;
  category: string | null;
  tags: string[] | null;
  portal_card_url: string | null;
  title: string;
  kind: string;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  position: number;
  is_published: boolean;
  submission_status: string;
};

const COLS =
  "id, topic_slug, topic_title, topic_summary, category, tags, portal_card_url, title, kind, storage_path, external_url, mime_type, file_size_bytes, position, is_published, submission_status";

function fileType(r: Pick<Row, "kind" | "mime_type">): ProtocolFile["type"] {
  const m = r.mime_type ?? "";
  if (m.startsWith("video/") || r.kind.startsWith("video_")) return "video";
  if (m.startsWith("audio/") || r.kind === "audio") return "audio";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  return "other";
}

function summarize(rows: Row[]): ProtocolSummary {
  const first = rows[0]!;
  const live = rows.every((r) => r.is_published && r.submission_status === "approved");
  return {
    slug: first.topic_slug,
    title: first.topic_title,
    description: first.topic_summary,
    category: first.category,
    tags: first.tags ?? [],
    cover: first.portal_card_url,
    status: live ? "live" : "pending",
    fileCount: rows.length + (first.portal_card_url ? 1 : 0),
    videoCount: rows.filter((r) => fileType(r) === "video").length,
    pdfCount: rows.filter((r) => fileType(r) === "pdf").length,
  };
}

export async function protocolsForExpert(expertId: string): Promise<ProtocolSummary[]> {
  const { data, error } = await db()
    .from("resources")
    .select(COLS)
    .eq("originating_expert_id", expertId)
    .order("topic_title", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  const groups = new Map<string, Row[]>();
  for (const r of (data ?? []) as Row[]) {
    const g = groups.get(r.topic_slug) ?? [];
    g.push(r);
    groups.set(r.topic_slug, g);
  }
  return [...groups.values()].map(summarize);
}

export async function protocolForExpert(
  expertId: string,
  slug: string,
): Promise<{ protocol: ProtocolSummary; files: ProtocolFile[] } | null> {
  if (!/^[a-z0-9-]{3,120}$/.test(slug)) return null;
  const { data, error } = await db()
    .from("resources")
    .select(COLS)
    .eq("originating_expert_id", expertId)
    .eq("topic_slug", slug)
    .order("position", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  if (!rows.length) return null;
  return {
    protocol: summarize(rows),
    files: rows
      .filter((r) => r.storage_path || r.external_url)
      .map((r) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        type: fileType(r),
        url: (r.storage_path ?? r.external_url) as string,
        sizeBytes: r.file_size_bytes,
      })),
  };
}

export type AssetGroup = {
  slug: string;
  title: string;
  files: { id: string; title: string; kind: string; url: string; downloadUrl: string; sizeBytes: number | null }[];
};

/** Owner-only downloads (or a company's public-page media), with 1-hour signed links. */
export async function providerAssets(
  owner: { expertId?: string; vendorId?: string },
  audience: "owner" | "company_page" = "owner",
): Promise<AssetGroup[]> {
  const sb = db();
  let q = sb
    .from("provider_assets")
    .select("id, group_slug, group_title, title, kind, storage_path, file_size_bytes, position")
    .eq("audience", audience)
    .order("group_title", { ascending: true })
    .order("position", { ascending: true });
  if (owner.expertId) q = q.eq("expert_id", owner.expertId);
  else if (owner.vendorId) q = q.eq("vendor_id", owner.vendorId);
  else return [];
  const { data, error } = await q;
  if (error) {
    // Migration 0076 not run yet: show nothing rather than break the portal.
    if (/provider_assets/.test(error.message)) return [];
    throw error;
  }
  const rows = data ?? [];
  if (!rows.length) return [];
  const paths = rows.map((r) => r.storage_path as string);
  const [{ data: view }, { data: dl }] = await Promise.all([
    sb.storage.from("provider-assets").createSignedUrls(paths, 3600),
    sb.storage.from("provider-assets").createSignedUrls(paths, 3600, { download: true }),
  ]);
  const viewMap = new Map((view ?? []).map((v) => [v.path, v.signedUrl]));
  const dlMap = new Map((dl ?? []).map((v) => [v.path, v.signedUrl]));
  const groups = new Map<string, AssetGroup>();
  for (const r of rows) {
    const url = viewMap.get(r.storage_path as string);
    if (!url) continue;
    const g: AssetGroup = groups.get(r.group_slug) ?? { slug: r.group_slug, title: r.group_title, files: [] };
    g.files.push({
      id: r.id,
      title: r.title,
      kind: r.kind,
      url,
      downloadUrl: dlMap.get(r.storage_path as string) ?? url,
      sizeBytes: r.file_size_bytes,
    });
    groups.set(r.group_slug, g);
  }
  return [...groups.values()];
}
