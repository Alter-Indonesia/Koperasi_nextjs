import type { Metadata } from "next";
import { AreaGuard } from "@/components/layout/AreaGuard";

// Semua halaman area ini membaca sesi (cookie) dan tidak bisa menjadi cangkang statis: lewati validasi "instant navigation" di dev.
export const instant = false;

export const metadata: Metadata = { title: { default: "Petugas · KoperasiKu", template: "%s · Petugas KoperasiKu" } };

export default function PetugasLayout({ children }: { children: React.ReactNode }) {
  return <AreaGuard area="petugas">{children}</AreaGuard>;
}
