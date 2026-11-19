"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { Input, Select } from "@/components/ui/Form";
import { Table } from "@/components/ui/Table";
import { cx } from "@/components/ui/cx";
import { qs, useApi } from "@/lib/api";
import { angka, persen, rupiahRingkas } from "@/lib/format";

type Row = { id: number; nama: string; wilayah: string; tagihan: number; terbayar: number; terkumpul: number; tunggakan: number };
type Data = {
  kpi: { ditagih: number; ditagih_nominal: number; terbayar: number; terkumpul: number; tunggakan: number; tunggakan_nominal: number };
  perPetugas: Row[];
  metode: { metode: string; jumlah: number; nominal: number }[];
  harian: { tanggal: string; nominal: number }[];
  aging: { kelompok: string; anggota: number; nominal: number }[];
  lanjutan: { telepon: number; surat_1: number; surat_2: number; eskalasi: number };
};
type Meta = { dari: string; sampai: string };
const METODE: Record<string, [string, string]> = { tunai: ["Tunai", "bg-inverse"], transfer: ["Transfer", "bg-accent"], qris: ["QRIS", "bg-warn"] };
const AGING = ["bg-accent", "bg-kol-kurang-lancar", "bg-kol-diragukan", "bg-kol-macet"];

export default function LaporanPage() {
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [wil, setWil] = useState("");
  const { data: wilayah } = useApi<{ id: number; nama: string }[]>("/api/v1/wilayah");
  const url = `/api/v1/laporan/penagihan${qs({ dari, sampai, wilayah_id: wil })}`;
  const { data: d, meta, error, loading, reload } = useApi<Data, Meta>(url);
  const rate = d && d.kpi.ditagih ? d.kpi.terbayar / d.kpi.ditagih : 0;
  const totalMetode = d?.metode.reduce((s, m) => s + m.nominal, 0) ?? 0;
  const maxHari = Math.max(1, ...(d?.harian.map((h) => h.nominal) ?? [1]));
  const maxAging = Math.max(1, ...(d?.aging.map((a) => a.nominal) ?? [1]));

  function unduhCsv() {
    if (!d) return;
    const head = ["Petugas", "Wilayah", "Tagihan", "Terbayar", "Terkumpul", "Tunggakan", "Rate"];
    const rows = d.perPetugas.map((r) => [r.nama, r.wilayah, r.tagihan, r.terbayar, r.terkumpul, r.tunggakan, r.tagihan ? (r.terbayar / r.tagihan).toFixed(3) : ""]);
    const csv = [head, ...rows].map((r) => r.join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `laporan-penagihan-${meta?.dari}-${meta?.sampai}.csv`;
    a.click();
  }

  return (
    <>
      <PageHeader
        title="Laporan Penagihan"
        subtitle="Rekapitulasi pembayaran, tunggakan, dan kolektibilitas"
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => window.print()}>Cetak / PDF</Button>
            <Button size="lg" onClick={unduhCsv} disabled={!d}>Unduh Excel (CSV)</Button>
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-body-sm font-bold">Periode</span>
        <div className="w-[170px]"><Input ukuran="compact" type="date" value={dari || meta?.dari || ""} onChange={(e) => setDari(e.target.value)} /></div>
        <span className="text-fg-muted">s.d.</span>
        <div className="w-[170px]"><Input ukuran="compact" type="date" value={sampai || meta?.sampai || ""} onChange={(e) => setSampai(e.target.value)} /></div>
        <div className="w-[200px]"><Select ukuran="compact" value={wil} onChange={(e) => setWil(e.target.value)}>
          <option value="">Wilayah: Semua</option>
          {wilayah?.map((w) => <option key={w.id} value={w.id}>Wilayah: {w.nama}</option>)}
        </Select></div>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d && <Skeleton className="h-[760px]" />}
      {d && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-4 gap-6">
            <StatCard label="Total Ditagih" value={rupiahRingkas(d.kpi.ditagih_nominal)} note={`${angka(d.kpi.ditagih)} angsuran jatuh tempo`} />
            <StatCard label="Terkumpul" value={rupiahRingkas(d.kpi.terkumpul)} note={`${angka(d.kpi.terbayar)} angsuran terbayar`} />
            <StatCard label="Tunggakan Baru" value={rupiahRingkas(d.kpi.tunggakan_nominal)} note={`${angka(d.kpi.tunggakan)} angsuran belum bayar`} />
            <StatCard inverse label="Collection Rate" value={persen(rate)} note="target 95%" />
          </div>
          <div className="grid grid-cols-[1fr_368px] gap-6">
            <Card title="Rekap per Petugas">
              <Table
                rows={d.perPetugas}
                rowKey={(r) => r.id}
                rowHeight="h-[50px]"
                columns={[
                  { key: "n", header: "Petugas", render: (r) => <b>{r.nama}</b> },
                  { key: "w", header: "Wilayah", render: (r) => r.wilayah },
                  { key: "t", header: "Tagihan", render: (r) => angka(r.tagihan) },
                  { key: "b", header: "Terbayar", render: (r) => angka(r.terbayar) },
                  { key: "k", header: "Terkumpul", render: (r) => rupiahRingkas(r.terkumpul) },
                  { key: "u", header: "Tunggakan", render: (r) => rupiahRingkas(r.tunggakan) },
                  { key: "r", header: "Rate", render: (r) => { const v = r.tagihan ? r.terbayar / r.tagihan : 0; return <b className={v < 0.9 ? "text-warn-text" : ""}>{r.tagihan ? persen(v) : "—"}</b>; } },
                ]}
              />
              <h3 className="mt-6 text-body font-bold">Pembayaran per Metode</h3>
              <div className="mt-3 flex h-3.5 overflow-hidden rounded-pill bg-canvas">
                {d.metode.map((m) => <div key={m.metode} className={METODE[m.metode]?.[1]} style={{ width: `${(m.nominal / (totalMetode || 1)) * 100}%` }} />)}
              </div>
              <div className="mt-3 flex gap-10">
                {d.metode.map((m) => (
                  <div key={m.metode} className="flex items-start gap-2">
                    <span className={cx("mt-1 size-3 rounded-[3px]", METODE[m.metode]?.[1])} />
                    <div>
                      <div className="text-small font-bold">{METODE[m.metode]?.[0]} {persen(m.nominal / (totalMetode || 1), 0)}</div>
                      <div className="text-small text-fg-muted">{rupiahRingkas(m.nominal)}</div>
                    </div>
                  </div>
                ))}
                {d.metode.length === 0 && <span className="text-small text-fg-subtle">Belum ada pembayaran pada periode ini</span>}
              </div>
              <h3 className="mt-6 text-body font-bold">Pembayaran Harian</h3>
              <div className="mt-3 flex h-[120px] items-end gap-2 border-b border-line">
                {d.harian.map((h, i) => (
                  <div key={h.tanggal} className="flex flex-1 flex-col items-center gap-1" title={`${h.tanggal}: ${rupiahRingkas(h.nominal)}`}>
                    <div className={cx("w-full max-w-[30px] rounded-t-[4px]", i === d.harian.length - 1 ? "bg-warn" : "bg-accent")} style={{ height: `${Math.max(2, (h.nominal / maxHari) * 110)}px` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-2">
                {d.harian.map((h) => <span key={h.tanggal} className="flex-1 text-center text-caption text-fg-muted">{Number(h.tanggal.slice(8))}</span>)}
              </div>
            </Card>
            <Card title="Umur Tunggakan">
              <ul className="flex flex-col gap-5">
                {d.aging.map((a, i) => (
                  <li key={a.kelompok}>
                    <div className="flex justify-between">
                      <div>
                        <div className="text-body-sm font-bold">{a.kelompok}</div>
                        <div className="text-caption text-fg-subtle">{a.anggota} anggota</div>
                      </div>
                      <b className="text-body">{rupiahRingkas(a.nominal)}</b>
                    </div>
                    <div className="mt-2 h-2 rounded-pill bg-canvas">
                      <div className={cx("h-full rounded-pill", AGING[i])} style={{ width: `${(a.nominal / maxAging) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="my-6 border-t border-line-subtle" />
              <h3 className="text-body font-bold">Penagihan Lanjutan (6B)</h3>
              <ul className="mt-3 flex flex-col gap-2.5">
                {[["Telepon petugas (H+3)", d.lanjutan.telepon], ["Surat tagihan I (H+7)", d.lanjutan.surat_1], ["Surat tagihan II (H+30)", d.lanjutan.surat_2], ["Eskalasi ke Owner (> 90 hari)", d.lanjutan.eskalasi]].map(([l, v]) => (
                  <li key={l} className="flex items-center justify-between rounded-ctl bg-canvas px-4 py-3">
                    <span className="text-body-sm font-medium">{l}</span>
                    <b className="text-appbar">{v}</b>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
