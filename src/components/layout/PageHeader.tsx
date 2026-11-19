/**
 * Pola header halaman: judul 26 Bold (Judul Halaman), subjudul 14 fg/muted, aksi di kanan (tombol tinggi 44).
 */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-page font-bold text-fg">{title}</h1>
        {subtitle && <p className="mt-1.5 text-body text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
