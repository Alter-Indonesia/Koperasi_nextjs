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

type Tagihan = { id: number; anggota: string; alamat: string; wilayah: string; wilayah_id: number; total: number; jatuh_tempo: string; no_pinjaman: string };
type Petugas = { id: number; nama: string; wilayah: string; wilayah_id: number; beban: number; beban_maks: number; tugas: { angsuran_id: number; anggota: string; total: number }[] };
type Data = { tanggal: string; belum: Tagihan[]; petugas: Petugas[] };

export default function PenugasanPage() {
  const { data, error, loading, reload } = useApi<Data>("/api/v1/penugasan");
  const [pilih, setPilih] = useState<number[]>([]);
  const [ke, setKe] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);

  const tandai = (id: number, on: boolean) => setPilih((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  const total = data?.belum.filter((b) => pilih.includes(b.id)).reduce((s, b) => s + b.total, 0) ?? 0;

  async function tugaskan(petugasId: number) {
    if (!data || !pilih.length) return setToast({ m: "Pilih tagihan di daftar kiri dulu", t: "warn" });
    setBusy(true);
    try {
      const r = await api.post<{ ditugaskan: number }>("/api/v1/penugasan", { tanggal: data.tanggal, petugas_id: petugasId, angsuran_ids: pilih });
      setPilih([]);
      setToast({ m: `${r.data.ditugaskan} tagihan ditugaskan ke ${data.petugas.find((p) => p.id === petugasId)?.nama}`, t: "ok" });
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
      const r = await api.post<{ ditugaskan: number }>("/api/v1/penugasan/otomatis", { tanggal: data.tanggal });
      setPilih([]);
      setToast({ m: `${r.data.ditugaskan} tagihan dibagi otomatis sesuai wilayah`, t: "ok" });
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
        subtitle={data ? `Bagi tagihan lapangan untuk ${tanggalPanjang(data.tanggal)}` : "Memuat…"}
        actions={<Button variant="accent" size="lg" disabled={busy || !data?.belum.length} onClick={otomatis}>Bagi Otomatis per Wilayah</Button>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-[800px]" />}
      {data && (
        <div className="grid grid-cols-[556px_1fr] gap-6">
          <section className="flex flex-col rounded-card bg-card">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="flex items-center gap-2 text-title font-bold">Belum Ditugaskan <Badge tone="telat">{data.belum.length}</Badge></h2>
              <button className="cursor-pointer text-body-sm font-bold text-warn-text" onClick={() => setPilih(pilih.length === data.belum.length ? [] : data.belum.map((b) => b.id))}>
                {pilih.length === data.belum.length && pilih.length ? "Batal pilih" : "Pilih semua"}
              </button>
            </div>
            <ul className="flex max-h-[660px] flex-col gap-1 overflow-y-auto px-3">
              {data.belum.length === 0 && <li className="px-2 py-16 text-center text-body-sm text-fg-subtle">Semua tagihan sudah ditugaskan</li>}
              {data.belum.map((b) => {
                const on = pilih.includes(b.id);
                return (
                  <li key={b.id} className={cx("flex items-center gap-4 rounded-ctl px-4 py-3.5", on && "bg-canvas")}>
                    <Checkbox checked={on} onChange={(v) => tandai(b.id, v)} label={`Pilih ${b.anggota}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-bold">{b.anggota}</div>
                      <div className="truncate text-small text-fg-subtle">{b.alamat}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-body-sm font-bold">{rupiah(b.total)}</div>
                      <div className="text-small text-fg-muted">Wil. {b.wilayah} · {tanggalPendek(b.jatuh_tempo)}</div>
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
                  {data.petugas.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                </Select></div>
                <Button size="lg" disabled={busy || !ke || !pilih.length} onClick={() => tugaskan(Number(ke))}>Tugaskan</Button>
              </div>
            </div>
          </section>
          <div className="grid grid-cols-2 gap-6">
            {data.petugas.map((p, i) => {
              const berat = p.beban / p.beban_maks > 0.85;
              return (
                <section key={p.id} className="flex flex-col rounded-card bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.nama} tone={avatarTone(i)} />
                    <div>
                      <div className="text-body font-bold">{p.nama}</div>
                      <div className="text-small text-fg-subtle">Wil. {p.wilayah}</div>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-between text-small">
                    <span className="text-fg-muted">Beban {tanggalPendek(data.tanggal)}</span>
                    <b className={berat ? "text-warn-text" : ""}>{p.beban} / {p.beban_maks}</b>
                  </div>
                  <Progress value={p.beban / p.beban_maks} tone={berat ? "warn" : "accent"} className="mt-2" />
                  <ul className="mt-3 flex-1">
                    {p.tugas.slice(0, 4).map((t) => (
                      <li key={t.angsuran_id} className="flex justify-between border-b border-line-subtle py-2.5 text-body-sm">
                        <span className="font-medium">{t.anggota}</span>
                        <span className="text-small text-fg-muted">{rupiah(t.total)}</span>
                      </li>
                    ))}
                    {p.tugas.length === 0 && <li className="py-3 text-small text-fg-subtle">Belum ada tugas</li>}
                  </ul>
                  {p.tugas.length > 4 && <div className="mt-2 text-small font-medium text-fg-subtle">+ {p.tugas.length - 4} anggota lainnya</div>}
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
