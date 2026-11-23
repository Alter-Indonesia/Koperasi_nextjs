"use client";
import { Check, LogOut, X } from "lucide-react";
import { withFreshState } from "@/components/layout/FreshState";
import { Avatar } from "@/components/ui/Avatar";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { Card } from "@/components/ui/Card";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { Progress } from "@/components/ui/Form";
import { Table, type Column } from "@/components/ui/Table";
import { useApi } from "@/lib/api";
import { persen, rupiah, rupiahRingkas, tanggal } from "@/lib/format";
import { useSession } from "@/lib/session";

type Anggota = { id: number; member_number: string; name: string; phone: string | null; address: string | null; active_loans: number; arrears_amount: number };
type Profil = { id: number; code: string | null; name: string; email: string; phone: string | null; status: string; joined_at: string | null; last_login_at: string | null; region_name: string | null; member_count: number; members: Anggota[]; month: string; collected: number; visits: number; target: number; collection_rate: number; remaining: number };

const KOLOM_ANGGOTA: Column<Anggota>[] = [
  { key: "name", header: "Anggota", render: (m) => <div className="min-w-0"><p className="truncate font-bold text-fg">{m.name}</p><p className="text-small text-fg-muted">{m.member_number}</p></div> },
  { key: "phone", header: "No. HP", render: (m) => m.phone ?? "-" },
  { key: "address", header: "Alamat", className: "max-md:hidden", render: (m) => <span className="line-clamp-1">{m.address ?? "-"}</span> },
  { key: "loans", header: "Pinjaman aktif", align: "right", render: (m) => (m.active_loans > 0 ? <Check size={16} strokeWidth={2} className="ml-auto text-fg" aria-label="Punya pinjaman aktif" /> : <X size={16} strokeWidth={2} className="ml-auto text-warn-text" aria-label="Tidak ada pinjaman aktif" />) },
  { key: "arrears", header: "Tunggakan", align: "right", render: (m) => (m.arrears_amount > 0 ? <span className="font-bold text-warn-text">{rupiah(m.arrears_amount)}</span> : "-") },
];

function ProfilPage() {
  const { logout } = useSession();
  const { data: p, error, loading, reload } = useApi<Profil>("/api/v1/petugas/profil");
  const bulan = p ? new Date(`${p.month}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long" }) : "";
  return (
    <>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !p ? (
        <Skeleton className="h-64" />
      ) : p && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:gap-6">
          <div className="md:col-span-2">
            <section className="flex items-center gap-4 rounded-card bg-inverse p-5 pb-12">
              <Avatar name={p.name} size={56} tone="accent" />
              <div className="min-w-0">
                <h1 className="truncate text-mobile font-bold text-fg-inverse">{p.name}</h1>
                <p className="truncate text-body-sm text-fg-inverse-muted">Petugas Lapangan{p.code ? ` · ${p.code}` : ""}</p>
                {p.region_name && <span className="mt-2 inline-flex rounded-pill bg-accent px-3 py-1 text-caption font-bold text-on-accent">Wil. {p.region_name}</span>}
              </div>
            </section>
            <section className="relative -mt-8 rounded-card bg-card p-5">
              <p className="text-caption font-bold tracking-[1px] text-fg-muted">BULAN INI</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div><p className="text-title font-bold text-fg sm:text-appbar">{rupiahRingkas(p.collected)}</p><p className="text-body-sm text-fg-muted">Tertagih</p></div>
                <div><p className="text-title font-bold text-fg sm:text-appbar">{persen(p.collection_rate)}</p><p className="text-body-sm text-fg-muted">Collection rate</p></div>
                <div><p className="text-title font-bold text-fg sm:text-appbar">{p.visits}</p><p className="text-body-sm text-fg-muted">Kunjungan</p></div>
              </div>
            </section>
          </div>
          <div className="flex min-w-0 flex-col gap-6 md:h-full">
          <section className="rounded-card bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-body text-fg-muted">Target {bulan}</span>
              <span className="text-body font-bold text-fg">{persen(p.collection_rate, 0)}</span>
            </div>
            <p className="mt-1 text-appbar font-bold text-fg">{rupiahRingkas(p.target)}</p>
            <Progress value={p.collection_rate} className="mt-3" />
            <p className="mt-3 text-body-sm text-fg-muted">Sisa {rupiah(p.remaining)}</p>
          </section>
          <section className="flex-1 rounded-card bg-card p-5">
            <p className="text-body font-bold text-fg">Biodata</p>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-body-sm">
              {([
                ["Nama", p.name],
                ["Kode petugas", p.code ?? "-"],
                ["Email", p.email],
                ["No. HP", p.phone ?? "-"],
                ["Wilayah tugas", p.region_name ?? "Belum ditetapkan"],
                ["Status", p.status === "aktif" ? "Aktif" : "Nonaktif"],
                ["Bergabung", p.joined_at ? tanggal(p.joined_at) : "-"],
                ["Login terakhir", p.last_login_at ? tanggal(p.last_login_at) : "-"],
              ] as const).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-fg-muted">{k}</dt><dd className="min-w-0 truncate text-right font-bold text-fg sm:text-left">{v}</dd></div>
              ))}
            </dl>
          </section>
          </div>
          <div className="flex min-w-0 flex-col gap-6 md:h-full">
            <ChangePasswordForm url="/api/v1/petugas/profil/password" />
          </div>
          <div className="md:col-span-2">
            <Card title={`Anggota Saya · ${p.members.length}`}>
              <Table columns={KOLOM_ANGGOTA} rows={p.members} rowKey={(m) => m.id} empty="Belum ada anggota di wilayah ini" />
            </Card>
          </div>
          <button type="button" onClick={logout} className="flex cursor-pointer items-center gap-4 md:col-span-2 rounded-card bg-card p-5 text-left lg:hidden">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-ctl bg-warn text-on-warn"><LogOut size={16} strokeWidth={1.5} /></span>
            <span className="text-body font-bold text-warn-text">Keluar</span>
          </button>
        </div>
      )}
    </>
  );
}

export default withFreshState(ProfilPage, { module: "my_tasks" });
