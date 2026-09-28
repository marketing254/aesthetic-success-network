import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { MEMBER_TOOLS, TOOL_CATEGORIES, isPublicTool, toolById, toolPreviewSrc } from "@/lib/toolsData";
import { createServerSupabase } from "@/lib/supabase/server-ssr";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isMemberPaid } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /tools/[id]: PUBLIC preview of one member tool, in the ASN design, with
 * DMN's behaviour kept exactly:
 *   - "glimpse then lock": a placeholder frame blurred behind a lock card.
 *     The tool HTML is NOT here and is never publicly reachable; members get
 *     it via /api/member/tools/[id] inside the portal.
 *   - a tool listed in PUBLIC_TOOL_IDS runs live via /api/tools/public/[id]
 *     (results masked, PDF gated); the list is empty at launch.
 *   - a signed-in active member is sent straight to the working tool.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const tool = toolById(id);
  if (!tool) return { title: "Tool not found" };
  const title = `${tool.title} for aesthetic practices`;
  const description = `${tool.blurb} ${tool.expert ? `Built with ${tool.expert}.` : "Built by Aesthetic Success Network."} Free preview; members run it with their own numbers.`;
  return {
    title,
    description,
    alternates: { canonical: `/tools/${tool.id}` },
    openGraph: { type: "website", title, description, images: [{ url: toolPreviewSrc(tool.id) ?? "/og-image.png" }] },
  };
}

/**
 * True only for a signed-in member whose subscription is active or
 * trialing. Anyone else gets the public page (never a bounce into the
 * portal's upgrade wall from a public URL).
 */
async function signedInPaidMember(): Promise<boolean> {
  try {
    const sb = await createServerSupabase();
    const { data } = await sb.auth.getUser();
    const email = data?.user?.email?.toLowerCase();
    if (!email) return false;
    const { data: row } = await getSupabaseAdmin()
      .from("members")
      .select("status, subscription_status")
      .eq("email", email)
      .maybeSingle();
    return !!row && row.status === "active" && isMemberPaid(row.subscription_status);
  } catch {
    return false;
  }
}

export default async function PublicToolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tool = toolById(id);
  if (!tool) notFound();

  if (await signedInPaidMember()) redirect(`/dashboard/tools/${tool.id}`);

  const color = TOOL_CATEGORIES.find((c) => c.name === tool.category)?.color ?? "#0a1320";
  const live = isPublicTool(tool.id);
  const preview = toolPreviewSrc(tool.id);
  const sameCat = MEMBER_TOOLS.filter((t) => t.category === tool.category && t.id !== tool.id);
  const more = (sameCat.length ? sameCat : MEMBER_TOOLS.filter((t) => t.id !== tool.id)).slice(0, 3);
  const signInHref = `/member/login?redirect=${encodeURIComponent(`/dashboard/tools/${tool.id}`)}`;

  return (
    <SitePage>
      <SiteNav active="/tools" />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 0 }}>
        <div className="wrap" style={{ display: "block" }}>
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/tools">&larr; Tools</Link>
            <span>/</span>
            <span>{tool.category}</span>
            <span>/</span>
            <b>{tool.title}</b>
          </nav>
          <span className="eyebrow">{tool.category}</span>
          <h1>{tool.title}</h1>
          <p className="sub">{tool.blurb}</p>
          <div className="micro">
            <span>{tool.expert ? `Built with ${tool.expert}` : "Built by ASN"}</span>
            {tool.kit ? <span>From the kit {tool.kit}</span> : null}
            <span>For {tool.audience === "team" ? "the whole team" : "practice owners"}</span>
          </div>

          <div className="preview-shell">
            <div className="bar">
              <i></i>
              <i></i>
              <i></i>
              <span className="addr">www.aestheticsuccessnetwork.com/tools/{tool.id}</span>
              <span className="tag">{live ? "Live · free to use" : "Preview · inputs locked"}</span>
            </div>

            {live ? (
              /* The real calculator, served by the public allow-list route
                 with its PDF button turned into a membership gate. */
              <iframe
                src={`/api/tools/public/${tool.id}`}
                title={tool.title}
                style={{ display: "block", width: "100%", border: 0, height: 960, background: "#f2f5f8" }}
              />
            ) : (
              <div className="glimpse">
                {preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={preview}
                    alt={`Preview of the ${tool.title}`}
                    style={{ width: "100%", display: "block", pointerEvents: "none", userSelect: "none" }}
                  />
                ) : (
                  /* No screenshot previews ship with ASN: a CSS placeholder in
                     the category colour stands in for the screenshot. */
                  <div className="tt-art" aria-hidden style={{ ["--tt" as string]: color } as React.CSSProperties}>
                    <span className="tt-title">{tool.title}</span>
                  </div>
                )}
                <div className="fade" aria-hidden />
                <div className="lock-card">
                  <div className="lock" aria-hidden>
                    &#128274;
                  </div>
                  <h2>This calculator is for members</h2>
                  <p>
                    Join to run it with your own numbers, plus the other {MEMBER_TOOLS.length - 1} tools,
                    the full resource library and the Expert Hotline.
                  </p>
                  <div className="cta-row">
                    <Link className="btn bronze" href="/join/member">
                      Become a member
                    </Link>
                    <Link className="btn ghost" href={signInHref}>
                      Sign in
                    </Link>
                  </div>
                  <div className="small">Already a member? Sign in and this page opens the tool.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="feature-grid--cards" style={{ marginTop: 0 }}>
            <div className="feat" style={{ gridColumn: "span 2" }}>
              <h3>What this tool does</h3>
              <p>
                {tool.blurb} Enter your own figures and the calculator updates as you type, with the
                result explained in plain language so you can act on it the same day.
              </p>
              <ul style={{ margin: "12px 0 0 18px", fontSize: 14, color: "#3d4653", lineHeight: 1.7 }}>
                <li>Runs entirely in your browser. Nothing you type is saved or sent anywhere.</li>
                {live ? (
                  <li>Enter your numbers free right here. Members see the results and download them as a PDF.</li>
                ) : null}
                {tool.kit ? <li>Built to pair with the expert kit, so the numbers feed straight into it.</li> : null}
                <li>Works on a phone in the treatment room as well as on a desktop.</li>
              </ul>
            </div>
            <div className="feat">
              <div className="facts" style={{ marginTop: 0, gridTemplateColumns: "1fr" }}>
                <div>
                  <div className="fact" style={{ border: 0, padding: "0 0 12px" }}>
                    <div className="l">Category</div>
                    <div className="v">{tool.category}</div>
                  </div>
                  <div className="fact" style={{ border: 0, padding: "0 0 12px" }}>
                    <div className="l">Expert</div>
                    <div className="v">{tool.expert ?? "ASN original"}</div>
                  </div>
                  <div className="fact" style={{ border: 0, padding: "0 0 12px" }}>
                    <div className="l">Companion kit</div>
                    <div className="v">{tool.kit ?? "None"}</div>
                  </div>
                  <div className="fact" style={{ border: 0, padding: 0 }}>
                    <div className="l">Access</div>
                    <div className="v">{live ? "Free to try · results for members" : "Members only · included"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="center" style={{ marginTop: 60 }}>
            <span className="kicker">{sameCat.length ? `More tools in ${tool.category}` : "More member tools"}</span>
            <h2 className="title">
              See all <em>{MEMBER_TOOLS.length}</em> tools.
            </h2>
          </div>
          <div className="tool-grid" style={{ marginTop: 34 }}>
            {more.map((t) => {
              const c = TOOL_CATEGORIES.find((x) => x.name === t.category)?.color ?? "#0a1320";
              return (
                <Link
                  key={t.id}
                  className="tool-tile"
                  href={`/tools/${t.id}`}
                  style={{ ["--tt" as string]: c } as React.CSSProperties}
                >
                  <div className="tt-art" aria-hidden>
                    <span className="tt-cat">{t.category}</span>
                    <span className="tt-title">{t.title}</span>
                    <span className="tt-lock">{isPublicTool(t.id) ? "Free to try" : "Members only"}</span>
                  </div>
                  <div className="tt-body">
                    <h3>{t.title}</h3>
                    <p>{t.blurb}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <SiteFooter />

      <PageFx revealSelector="section .feat, section .kicker, h2.title, .tool-tile" grids={[".tool-grid"]} />
    </SitePage>
  );
}
