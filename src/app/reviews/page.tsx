import type { Metadata } from "next";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import PageFx from "@/components/site/PageFx";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Member Reviews",
  description:
    "What aesthetic practice owners say about the Expert Hotline, the resource library and the partner deals inside the Aesthetic Success Network.",
};

type Review = {
  id: string;
  author_name: string;
  practice_name: string | null;
  role: string | null;
  quote: string;
  rating: number;
  featured: boolean;
};

async function getPublishedReviews(): Promise<Review[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("member_reviews")
    .select("id, author_name, practice_name, role, quote, rating, featured")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? "star on" : "star"}>
          &#9733;
        </span>
      ))}
    </div>
  );
}

export default async function ReviewsPage() {
  let reviews: Review[] = [];
  let loadFailed = false;
  try {
    reviews = await getPublishedReviews();
  } catch (err) {
    console.error("[reviews] failed to load:", err);
    loadFailed = true;
  }

  const avg =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  return (
    <>
      <SiteNav
        links={[
          { href: "/", label: "For Members" },
          { href: "/reviews", label: "Reviews", active: true },
          { href: "/pricing", label: "Pricing" },
        ]}
        cta={{ href: "/#join", label: "Join the waitlist" }}
      />

      <header className="hero hero--home" id="top" style={{ paddingBottom: 40 }}>
        <div className="wrap center" style={{ display: "block" }}>
          <span className="eyebrow">Member Reviews</span>
          <h1>
            What members say, <em>unedited</em>.
          </h1>
          <p className="sub" style={{ margin: "0 auto" }}>
            {avg
              ? `An average of ${avg} out of 5 across ${reviews.length} member reviews.`
              : "Real feedback from the practice owners inside the network."}
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          {loadFailed && (
            <p className="lead" style={{ margin: "0 0 24px" }}>
              We couldn&rsquo;t load reviews right now. Please check back shortly.
            </p>
          )}
          {!loadFailed && reviews.length === 0 && (
            <p className="lead" style={{ margin: "0 0 24px" }}>
              We&rsquo;re just getting started &mdash; member reviews will appear here as the
              founding cohort settles in.
            </p>
          )}
          <div className="feature-grid--cards review-grid">
            {reviews.map((r) => (
              <div key={r.id} className="feat review-card">
                <Stars rating={r.rating} />
                <p className="review-quote">&ldquo;{r.quote}&rdquo;</p>
                <div className="review-byline">
                  <span className="review-name">{r.author_name}</span>
                  <span className="review-role">
                    {[r.role, r.practice_name].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="final" id="join">
        <div className="wrap">
          <h2>
            Add your own <em>founding review</em>.
          </h2>
          <p className="lead2">
            Join now and tell us how it&rsquo;s going once you&rsquo;ve put the network to work.
          </p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <a className="btn bronze" href="/#join">
              Join the founding waitlist
            </a>
          </div>
        </div>
      </section>

      <SiteFooter
        links={[
          { href: "/pricing", label: "Pricing" },
          { href: "/blog", label: "Blog" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />

      <PageFx revealSelector="section .kicker, .feature-grid--cards .feat, .final h2, .final .lead2" grids={[".review-grid"]} />
    </>
  );
}
