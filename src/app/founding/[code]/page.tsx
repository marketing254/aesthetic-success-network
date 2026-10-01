import { Box, Container, Typography } from "@mui/material";
import SitePage from "@/components/site/SitePage";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import FoundingAccept from "@/components/founding/FoundingAcceptV4";
import { COLORS } from "@/theme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /founding/[code] — the private, unguessable invite page. No login.
 * Renders the invitee's personalized agreement + a pay card. Loading the
 * invite is server-side via the admin client after the code check.
 */
export default async function FoundingInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const sb = getSupabaseAdmin();
  const { data: invite } = await sb
    .from("founding_invites")
    .select(
      "code, role, pricing_plan, full_name, email, company_name, member_offer, signer_name, status, expires_at, agreement_version, agreement_pdf_path",
    )
    .eq("code", code)
    .maybeSingle();

  const expired = invite ? new Date(invite.expires_at).getTime() < Date.now() : false;
  const invalid =
    !invite ||
    invite.status === "revoked" ||
    invite.status === "draft" || // not sent yet — link isn't active
    (invite.status !== "accepted" && expired);

  if (invite?.status === "sent" && !invalid) {
    await sb
      .from("founding_invites")
      .update({ status: "viewed", viewed_at: new Date().toISOString() } as never)
      .eq("code", code);
  }

  // Signed URL for the personalized agreement PDF (15 min).
  let agreementUrl: string | null = null;
  if (invite?.agreement_pdf_path) {
    const { data: signed } = await sb.storage
      .from("agreements")
      .createSignedUrl(invite.agreement_pdf_path, 60 * 15);
    agreementUrl = signed?.signedUrl ?? null;
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.surface }}>
      <SitePage><SiteNav /></SitePage>
      {invalid ? (
        <Message
          title="This invite link isn't valid"
          body="It may have expired or been revoked. If you think this is a mistake, reply to your invitation email or contact founding@aestheticsuccessnetwork.com."
        />
      ) : invite!.status === "accepted" ? (
        <Message
          title="You've already accepted"
          body="This invitation has been completed. Sign in to your portal with the email it was sent to."
        />
      ) : (
        <FoundingAccept
          code={invite!.code}
          fullName={invite!.full_name}
          signerName={invite!.signer_name}
          role={invite!.role}
          pricing={invite!.pricing_plan}
          companyName={invite!.company_name}
          memberOffer={invite!.member_offer}
          agreementUrl={agreementUrl}
          agreementVersion={invite!.agreement_version}
        />
      )}
    </Box>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 8, md: 12 }, textAlign: "center" }}>
      <Typography
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: { xs: "1.7rem", md: "2rem" },
          fontWeight: 500,
          color: COLORS.ink,
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      <Typography sx={{ color: COLORS.muted, fontSize: "1rem", lineHeight: 1.6, maxWidth: 460, mx: "auto" }}>
        {body}
      </Typography>
    </Container>
  );
}
