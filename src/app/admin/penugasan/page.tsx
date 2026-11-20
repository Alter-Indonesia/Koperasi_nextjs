"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, avatarTone } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { Checkbox, Progress, Select } from "@/components/ui/Form";
import { cx } from "@/components/ui/cx";
import { api, ApiError, useApi } from "@/lib/api";
import { rupiah, tanggalPanjang, tanggalPendek } from "@/lib/format";

type Due = { id: number; member_name: string; member_address: string; region_name: string; region_id: number; total_amount: number; due_date: string; loan_number: string };
type Collector = { id: number; name: string; region_name: string; region_id: number; load: number; max_load: number; tasks: { installment_id: number; member_name: string; total_amount: number }[] };
type Data = { date: string; unassigned: Due[]; collectors: Collector[] };

export default function PenugasanPage() {
  const { data, error, loading, reload } = useApi<Data>("/api/v1/penugasan");
  const [pilih, setPilih] = useState<number[]>([]);
  const [ke, setKe] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);

  const tandai = (id: number, on: boolean) => setPilih((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  const total = data?.unassigned.filter((b) => pilih.includes(b.id)).reduce((s, b) => s + b.total_amount, 0) ?? 0;

  async function tugaskan(petugasId: number) {
    if (!data || !pilih.length) return setToast({ m: "Pilih tagihan di daftar kiri dulu", t: "warn" });
    setBusy(true);
    try {
      const r = await api.post<{ assigned: number }>("/api/v1/penugasan", { date: data.date, collector_id: petugasId, installment_ids: pilih });
      setPilih([]);
      setToast({ m: `${r.data.assigned} tagihan ditugaskan ke ${data.collectors.find((p) => p.id === petugasId)?.name}`, t: "ok" });
      reload();
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal menugaskan", t: "warn" });
    } finally {
      setBusy(false);
    }
  }
  async function otomatis() {
    if (!data) return;
    setBusy(true);
    try {
      const r = await api.post<{ assigned: number }>("/api/v1/penugasan/otomatis", { date: data.date });
      setPilih([]);
      setToast({ m: `${r.data.assigned} tagihan dibagi otomatis sesuai wilayah`, t: "ok" });
      reload();
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal membagi", t: "warn" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Penugasan Petugas"
        subtitle={data ? `Bagi tagihan lapangan untuk ${tanggalPanjang(data.date)}` : "Memuat…"}
        actions={<Button variant="accent" size="lg" disabled={busy || !data?.unassigned.length} onClick={otomatis}>Bagi Otomatis per Wilayah</Button>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-[800px]" />}
      {data && (
        <div className="grid grid-cols-[556px_1fr] gap-6">
          <section className="flex flex-col rounded-card bg-card">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="flex items-center gap-2 text-title font-bold">Belum Ditugaskan <Badge tone="telat">{data.unassigned.length}</Badge></h2>
              <button className="cursor-pointer text-body-sm font-bold text-warn-text" onClick={() => setPilih(pilih.length === data.unassigned.length ? [] : data.unassigned.map((b) => b.id))}>
                {pilih.length === data.unassigned.length && pilih.length ? "Batal pilih" : "Pilih semua"}
              </button>
            </div>
            <ul className="flex max-h-[660px] flex-col gap-1 overflow-y-auto px-3">
              {data.unassigned.length === 0 && <li className="px-2 py-16 text-center text-body-sm text-fg-subtle">Semua tagihan sudah ditugaskan</li>}
              {data.unassigned.map((b) => {
                const on = pilih.includes(b.id);
                return (
                  <li key={b.id} className={cx("flex items-center gap-4 rounded-ctl px-4 py-3.5", on && "bg-canvas")}>
                    <Checkbox checked={on} onChange={(v) => tandai(b.id, v)} label={`Pilih ${b.member_name}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-bold">{b.member_name}</div>
                      <div className="truncate text-small text-fg-subtle">{b.member_address}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-body-sm font-bold">{rupiah(b.total_amount)}</div>
                      <div className="text-small text-fg-muted">Wil. {b.region_name} · {tanggalPendek(b.due_date)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-subtle px-5 py-4">
              <span className="text-body-sm font-bold">{pilih.length} tagihan dipilih  ·  {rupiah(total)}</span>
              <div className="flex items-center gap-2">
                <div className="w-[170px]"><Select ukuran="compact" value={ke} onChange={(e) => setKe(e.target.value)}>
                  <option value="">Pilih petugas…</option>
                  {data.collectors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select></div>
                <Button size="lg" disabled={busy || !ke || !pilih.length} onClick={() => tugaskan(Number(ke))}>Tugaskan</Button>
              </div>
            </div>
          </section>
          <div className="grid grid-cols-2 gap-6">
            {data.collectors.map((p, i) => {
              const berat = p.load / p.max_load > 0.85;
              return (
                <section key={p.id} className="flex flex-col rounded-card bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} tone={avatarTone(i)} />
                    <div>
                      <div className="text-body font-bold">{p.name}</div>
                      <div className="text-small text-fg-subtle">Wil. {p.region_name}</div>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-between text-small">
                    <span className="text-fg-muted">Beban {tanggalPendek(data.date)}</span>
                    <b className={berat ? "text-warn-text" : ""}>{p.load} / {p.max_load}</b>
                  </div>
                  <Progress value={p.load / p.max_load} tone={berat ? "warn" : "accent"} className="mt-2" />
                  <ul className="mt-3 flex-1">
                    {p.tasks.slice(0, 4).map((t) => (
                      <li key={t.installment_id} className="flex justify-between border-b border-line-subtle py-2.5 text-body-sm">
                        <span className="font-medium">{t.member_name}</span>
                        <span className="text-small text-fg-muted">{rupiah(t.total_amount)}</span>
                      </li>
                    ))}
                    {p.tasks.length === 0 && <li className="py-3 text-small text-fg-subtle">Belum ada tugas</li>}
                  </ul>
                  {p.tasks.length > 4 && <div className="mt-2 text-small font-medium text-fg-subtle">+ {p.tasks.length - 4} anggota lainnya</div>}
                  <Button variant="outline" className="mt-4 w-full" disabled={busy || !pilih.length} onClick={() => tugaskan(p.id)}>Tugaskan di sini</Button>
                </section>
              );
            })}
          </div>
        </div>
      )}
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}
