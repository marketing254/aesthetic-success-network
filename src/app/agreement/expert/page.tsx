import { redirect } from "next/navigation";

/**
 * ASN uses a single Provider Agreement for experts, companies and
 * expert+company accounts. This route is kept only so every existing link
 * (invite emails, PDFs, forms) keeps working; it forwards to the one page.
 */
export default function LegacyAgreementRedirect() {
  redirect("/agreement/provider");
}
