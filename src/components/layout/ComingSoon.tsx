import { Smartphone } from "lucide-react";
import { PageHeader } from "./PageHeader";

/** Halaman kerangka untuk role yang aplikasinya belum dibuat (Petugas & Anggota: aplikasi mobile). */
export function ComingSoon({ title, subtitle, items }: { title: string; subtitle: string; items?: string[] }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <section className="flex max-w-[640px] flex-col items-start gap-4 rounded-card bg-card p-8">
        <span className="flex size-12 items-center justify-center rounded-ctl bg-accent text-on-accent">
          <Smartphone size={20} strokeWidth={1.5} />
        </span>
        <h2 className="text-title font-bold text-fg">Halaman ini sedang disiapkan</h2>
        <p className="text-body-sm text-fg-muted">Menu dan hak akses untuk role ini sudah aktif. Isi halaman menyusul bersama aplikasi mobile-nya.</p>
        {items && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-fg-muted">
            {items.map((i) => <li key={i}>{i}</li>)}
          </ul>
        )}
      </section>
    </>
  );
}
