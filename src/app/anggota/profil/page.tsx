"use client";
import { LogOut } from "lucide-react";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { withFreshState } from "@/components/layout/FreshState";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { useApi } from "@/lib/api";
import { bulanTahun, tanggal } from "@/lib/format";
import { useSession } from "@/lib/session";

type Saya = { name: string; member_number: string; phone: string | null; email: string | null; address: string | null; status: string; joined_on: string; region_name: string; collector_name: string | null };

function ProfilPage() {
  const { logout } = useSession();
  const { data: d, error, loading, reload } = useApi<Saya>("/api/v1/anggota/saya");
  return (
    <>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d ? (
        <Skeleton className="h-64" />
      ) : d && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:gap-6">
          <section className="flex flex-col gap-4 rounded-card bg-inverse p-5 md:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-caption font-bold tracking-[2px] text-accent">KARTU ANGGOTA</p>
              <span className="flex size-10 items-center justify-center rounded-chip bg-accent text-body font-bold text-on-accent">K</span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-mobile font-bold text-fg-inverse">{d.name}</h1>
              <p className="truncate text-body-sm text-fg-inverse-muted">{d.member_number} · sejak {bulanTahun(d.joined_on)}</p>
            </div>
            <span className="inline-flex w-fit rounded-pill bg-accent px-3 py-1 text-caption font-bold text-on-accent">{d.status === "aktif" ? "Anggota Aktif" : "Anggota Nonaktif"}</span>
          </section>
          <section className="rounded-card bg-card p-5">
            <p className="text-body font-bold text-fg">Biodata</p>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-body-sm">
              {([
                ["Nama", d.name],
                ["No. anggota", d.member_number],
                ["No. HP", d.phone ?? "-"],
                ["Email", d.email ?? "-"],
                ["Alamat", d.address ?? "-"],
                ["Wilayah", d.region_name],
                ["Petugas", d.collector_name ?? "Belum ada"],
                ["Bergabung", tanggal(d.joined_on)],
              ] as const).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-fg-muted">{k}</dt><dd className="min-w-0 break-words text-right font-bold text-fg sm:text-left">{v}</dd></div>
              ))}
            </dl>
          </section>
          <ChangePasswordForm url="/api/v1/anggota/saya/password" />
          <button type="button" onClick={logout} className="flex cursor-pointer items-center gap-4 rounded-card bg-card p-5 text-left md:col-span-2 lg:hidden">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-ctl bg-warn text-on-warn"><LogOut size={16} strokeWidth={1.5} /></span>
            <span className="text-body font-bold text-warn-text">Keluar</span>
          </button>
        </div>
      )}
    </>
  );
}

export default withFreshState(ProfilPage, { module: "my_loans" });
