import { redirect } from "next/navigation";

/**
 * /join/expert — legacy deep link. The expert application lives on the
 * marketing page's inline WaitlistSection form (the original, unmodified
 * form). This route just forwards there so any shared links keep working.
 */
export default function JoinExpertRedirect() {
  redirect("/experts#apply");
}
