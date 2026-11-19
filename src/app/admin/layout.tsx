import type { Metadata } from "next";
import { AdminShell } from "./AdminNav";

export const metadata: Metadata = { title: { default: "Admin · KoperasiKu", template: "%s · Admin KoperasiKu" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
