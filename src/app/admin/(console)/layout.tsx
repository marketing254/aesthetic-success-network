import AdminAppShell from "@/components/admin/AdminAppShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAppShell>{children}</AdminAppShell>;
}
