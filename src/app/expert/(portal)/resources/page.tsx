import { redirect } from "next/navigation";

/** The old "Resources" tab is now "My Protocols". */
export default function ExpertResourcesRedirect() {
  redirect("/expert/protocols");
}
