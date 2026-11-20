import type { Metadata } from "next";
import { AreaGuard } from "@/components/layout/AreaGuard";

// Semua halaman area ini membaca sesi (cookie) dan tidak bisa menjadi cangkang statis: lewati validasi "instant navigation" di dev.
export const instant = false;

export const metadata: Metadata = { title: { default: "Owner · KoperasiKu", template: "%s · Owner KoperasiKu" } };

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <AreaGuard area="owner">{children}</AreaGuard>;
}
