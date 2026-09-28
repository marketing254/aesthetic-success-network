import { redirect } from "next/navigation";

/**
 * /join/partner — legacy deep link. The partner application lives on the
 * marketing page's inline WaitlistSection form (the original, unmodified
 * form). This route just forwards there so any shared links keep working.
 */
export default function JoinPartnerRedirect() {
  redirect("/companies#apply");
}
