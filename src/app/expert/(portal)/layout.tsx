import ExpertAppShell from "@/components/expert/ExpertAppShell";

export default function ExpertPortalLayout({ children }: { children: React.ReactNode }) {
  return <ExpertAppShell>{children}</ExpertAppShell>;
}
