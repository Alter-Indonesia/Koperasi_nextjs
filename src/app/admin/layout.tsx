import type { Metadata } from "next";
import { AreaGuard } from "@/components/layout/AreaGuard";

// Semua halaman area ini membaca sesi (cookie) dan tidak bisa menjadi cangkang statis: lewati validasi "instant navigation" di dev.
export const instant = false;

export const metadata: Metadata = { title: { default: "Admin · KoperasiKu", template: "%s · Admin KoperasiKu" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AreaGuard area="admin">{children}</AreaGuard>;
}
