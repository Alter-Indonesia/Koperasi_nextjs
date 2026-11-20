"use client";
import { Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { Badge } from "@/components/ui/Badge";
import { Card, StatCard } from "@/components/ui/Card";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { cx } from "@/components/ui/cx";
import { useApi } from "@/lib/api";
import { rupiah, rupiahRingkas, tanggalPanjang } from "@/lib/format";

type Task = { id: number; sequence: number; due_date: string; total_amount: number; status: string; member_name: string; member_address: string | null; member_phone: string | null; region_name: string; loan_number: string; tenor_duration: number; days_overdue: number };
type Meta = { date: string; total: number; done: number; amount_total: number; amount_done: number };

function TugasPage() {
  const { data, meta, error, loading, reload } = useApi<Task[], Meta>("/api/v1/petugas/tugas");
  return (
    <>
      <PageHeader title="Tugas Hari Ini" subtitle={meta ? tanggalPanjang(meta.date) : "Daftar tagihan lapangan yang ditugaskan kepada Anda"} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="mb-6 grid grid-cols-3 gap-6">
        <StatCard inverse label="Kunjungan hari ini" value={meta ? meta.total : "…"} note={meta ? `${meta.done} selesai · ${meta.total - meta.done} tersisa` : undefined} />
        <StatCard label="Target tagihan" value={meta ? rupiahRingkas(meta.amount_total) : "…"} note="Total angsuran yang ditugaskan" />
        <StatCard label="Sudah tertagih" value={meta ? rupiahRingkas(meta.amount_done) : "…"} note="Menunggu verifikasi admin atau lunas" />
      </div>
      <Card title="Urutan Kunjungan" subtitle="Tagihan telat tampil lebih dulu">
        {loading && !data ? (
          <Skeleton className="h-40" />
        ) : !data?.length ? (
          <p className="py-8 text-center text-body-sm text-fg-muted">Belum ada tagihan yang ditugaskan untuk hari ini</p>
        ) : (
          <ul>
            {data.map((t, i) => {
              const selesai = t.status !== "belum";
              return (
                <li key={t.id} className="flex items-center gap-4 border-b border-line-subtle py-4 last:border-b-0">
                  <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-pill text-body-sm font-bold", selesai ? "bg-canvas text-fg-subtle" : "bg-inverse text-accent")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cx("text-body font-bold", selesai ? "text-fg-subtle" : "text-fg")}>{t.member_name}</p>
                    <p className="truncate text-body-sm text-fg-muted">{t.member_address ?? t.region_name} · {t.loan_number} · angsuran ke-{t.sequence}/{t.tenor_duration}</p>
                  </div>
                  <span className={cx("text-body font-bold", selesai ? "text-fg-subtle" : "text-fg")}>{rupiah(t.total_amount)}</span>
                  {selesai ? <Badge tone="sudah-bayar">Selesai</Badge> : t.days_overdue > 0 ? <Badge tone="telat">Telat {t.days_overdue} hari</Badge> : <Badge tone="belum-bayar">Hari ini</Badge>}
                  {t.member_phone && !selesai ? (
                    <a href={`tel:${t.member_phone}`} aria-label={`Telepon ${t.member_name}`} className="flex size-10 shrink-0 items-center justify-center rounded-ctl border border-line text-fg hover:bg-canvas">
                      <Phone size={16} strokeWidth={1.5} />
                    </a>
                  ) : <span className="size-10 shrink-0" />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

export default withFreshState(TugasPage, { module: "my_tasks" });
