import AdminAppShell from "@/components/admin/AdminAppShell";

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AdminAppShell>{children}</AdminAppShell>;
}
