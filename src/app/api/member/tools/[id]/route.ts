import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireMemberOrAdminPreview } from "@/lib/auth/guards";
import { toolById } from "@/lib/toolsData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/member/tools/[id]
 *
 * Serves a member tool's self-contained HTML to signed-in members only.
 * The files live in `tools-html/` (outside /public) because the dev spec
 * forbids exposing the full versions publicly — this route is the ONLY
 * way they're reachable, and it sits behind the member session (the
 * /dashboard/tools iframe sends the auth cookies automatically).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireMemberOrAdminPreview();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const tool = toolById(id);
  // Manifest lookup doubles as path-traversal protection: only known
  // filenames from toolsData can ever be read.
  if (!tool) return NextResponse.json({ error: "Tool not found." }, { status: 404 });

  try {
    const abs = path.join(process.cwd(), "tools-html", tool.file);
    const html = await fs.readFile(abs, "utf8");
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=300",
        // Only our own portal may frame the tool.
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch {
    return NextResponse.json({ error: "Tool file unavailable." }, { status: 500 });
  }
}
