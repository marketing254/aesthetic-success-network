import { redirect } from "next/navigation";

/** Old URL. The public page lives at /companies now. */
export default function PartnersRedirect() {
  redirect("/companies");
}
