import { redirect } from "next/navigation";

/** Old profile URL. Profiles live under /companies/<id> now. */
export default async function PartnerProfileRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/companies/${encodeURIComponent(id)}`);
}
