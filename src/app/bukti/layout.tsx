import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Bukti Pembayaran · KoperasiKu", robots: { index: false, follow: false } };

export default function BuktiLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-canvas px-4 py-8 print:bg-card print:p-0"><Suspense>{children}</Suspense></main>;
}
