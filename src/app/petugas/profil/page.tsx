"use client";
import { MapPin, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { Avatar } from "@/components/ui/Avatar";
import { Card, StatCard } from "@/components/ui/Card";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { Progress } from "@/components/ui/Form";
import { useApi } from "@/lib/api";
import { persen, rupiah, rupiahRingkas } from "@/lib/format";

type Profil = { id: number; code: string | null; name: string; email: string; region_name: string | null; member_count: number; month: string; collected: number; visits: number; target: number; collection_rate: number; remaining: number };

function ProfilPage() {
  const { data: p, error, loading, reload } = useApi<Profil>("/api/v1/petugas/profil");
  const bulan = p ? new Date(`${p.month}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long" }) : "";
  return (
    <>
      <PageHeader title="Profil" subtitle="Data akun petugas lapangan dan capaian bulan ini" />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !p ? (
        <Skeleton className="h-64" />
      ) : p && (
        <div className="flex max-w-[760px] flex-col gap-6">
          <section className="flex items-center gap-5 rounded-card bg-inverse p-5">
            <Avatar name={p.name} size={56} tone="accent" />
            <div>
              <h2 className="text-title font-bold text-fg-inverse">{p.name}</h2>
              <p className="text-body-sm text-fg-inverse-muted">Petugas Lapangan{p.code ? ` · ${p.code}` : ""} · {p.email}</p>
            </div>
          </section>
          <div className="grid grid-cols-3 gap-6">
            <StatCard label="Tertagih bulan ini" value={rupiahRingkas(p.collected)} />
            <StatCard label="Collection rate" value={persen(p.collection_rate)} />
            <StatCard label="Kunjungan" value={p.visits} />
          </div>
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-body-sm text-fg-muted">Target {bulan}</span>
              <span className="text-body-sm font-bold text-fg">{persen(p.collection_rate, 0)}</span>
            </div>
            <p className="mt-1 text-title font-bold text-fg">{rupiah(p.target)}</p>
            <Progress value={p.collection_rate} className="mt-3" />
            <p className="mt-3 text-body-sm text-fg-muted">Sisa {rupiah(p.remaining)}</p>
          </Card>
          <Card title="Wilayah tugas">
            <div className="flex items-center gap-6 text-body-sm text-fg">
              <span className="flex items-center gap-2"><MapPin size={16} strokeWidth={1.5} />{p.region_name ?? "Belum ditetapkan"}</span>
              <span className="flex items-center gap-2"><Users size={16} strokeWidth={1.5} />{p.member_count} anggota</span>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export default withFreshState(ProfilPage, { module: "my_tasks" });
