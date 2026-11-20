"use client";
import { LogOut, MapPin } from "lucide-react";
import { withFreshState } from "@/components/layout/FreshState";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { Progress } from "@/components/ui/Form";
import { useApi } from "@/lib/api";
import { persen, rupiah, rupiahRingkas } from "@/lib/format";
import { useSession } from "@/lib/session";

type Profil = { id: number; code: string | null; name: string; email: string; region_name: string | null; member_count: number; month: string; collected: number; visits: number; target: number; collection_rate: number; remaining: number };

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
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:gap-6">
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
          <section className="rounded-card bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-body text-fg-muted">Target {bulan}</span>
              <span className="text-body font-bold text-fg">{persen(p.collection_rate, 0)}</span>
            </div>
            <p className="mt-1 text-appbar font-bold text-fg">{rupiahRingkas(p.target)}</p>
            <Progress value={p.collection_rate} className="mt-3" />
            <p className="mt-3 text-body-sm text-fg-muted">Sisa {rupiah(p.remaining)}</p>
          </section>
          <section className="flex flex-col rounded-card bg-card px-5">
            <div className="flex items-center gap-4 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-ctl bg-canvas text-fg"><MapPin size={16} strokeWidth={1.5} /></span>
              <div>
                <p className="text-body font-bold text-fg">Wilayah tugas</p>
                <p className="text-body-sm text-fg-muted">{p.region_name ?? "Belum ditetapkan"} · {p.member_count} anggota</p>
              </div>
            </div>
            <button type="button" onClick={logout} className="flex cursor-pointer items-center gap-4 border-t border-line-subtle py-4 text-left lg:hidden">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-ctl bg-warn text-on-warn"><LogOut size={16} strokeWidth={1.5} /></span>
              <span className="text-body font-bold text-warn-text">Keluar</span>
            </button>
          </section>
        </div>
      )}
    </>
  );
}

export default withFreshState(ProfilPage, { module: "my_tasks" });
