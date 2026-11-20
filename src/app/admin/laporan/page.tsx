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

type Row = { id: number; name: string; region_name: string; billed: number; paid: number; collected: number; arrears: number };
type Data = {
  kpi: { billed_count: number; billed_amount: number; paid_count: number; collected_amount: number; arrears_count: number; arrears_amount: number };
  per_collector: Row[];
  methods: { method: string; count: number; amount: number }[];
  daily: { date: string; amount: number }[];
  aging: { bucket: string; members: number; amount: number }[];
  follow_up: { phone_call: number; letter_1: number; letter_2: number; escalation: number };
};
type Meta = { from: string; to: string };
const METODE: Record<string, [string, string]> = { tunai: ["Tunai", "bg-inverse"], transfer: ["Transfer", "bg-accent"], qris: ["QRIS", "bg-warn"] };
const AGING = ["bg-accent", "bg-kol-kurang-lancar", "bg-kol-diragukan", "bg-kol-macet"];

export default function LaporanPage() {
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [wil, setWil] = useState("");
  const { data: regions } = useApi<{ id: number; name: string }[]>("/api/v1/wilayah");
  const url = `/api/v1/laporan/penagihan${qs({ from: dari, to: sampai, region_id: wil })}`;
  const { data: d, meta, error, loading, reload } = useApi<Data, Meta>(url);
  const rate = d && d.kpi.billed_count ? d.kpi.paid_count / d.kpi.billed_count : 0;
  const totalMetode = d?.methods.reduce((s, m) => s + m.amount, 0) ?? 0;
  const maxHari = Math.max(1, ...(d?.daily.map((h) => h.amount) ?? [1]));
  const maxAging = Math.max(1, ...(d?.aging.map((a) => a.amount) ?? [1]));

  function unduhCsv() {
    if (!d) return;
    const head = ["Petugas", "Wilayah", "Tagihan", "Terbayar", "Terkumpul", "Tunggakan", "Rate"];
    const rows = d.per_collector.map((r) => [r.name, r.region_name, r.billed, r.paid, r.collected, r.arrears, r.billed ? (r.paid / r.billed).toFixed(3) : ""]);
    const csv = [head, ...rows].map((r) => r.join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `laporan-penagihan-${meta?.from}-${meta?.to}.csv`;
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
        <div className="w-[170px]"><Input ukuran="compact" type="date" value={dari || meta?.from || ""} onChange={(e) => setDari(e.target.value)} /></div>
        <span className="text-fg-muted">s.d.</span>
        <div className="w-[170px]"><Input ukuran="compact" type="date" value={sampai || meta?.to || ""} onChange={(e) => setSampai(e.target.value)} /></div>
        <div className="w-[200px]"><Select ukuran="compact" value={wil} onChange={(e) => setWil(e.target.value)}>
          <option value="">Wilayah: Semua</option>
          {regions?.map((w) => <option key={w.id} value={w.id}>Wilayah: {w.name}</option>)}
        </Select></div>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d && <Skeleton className="h-[760px]" />}
      {d && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-4 gap-6">
            <StatCard label="Total Ditagih" value={rupiahRingkas(d.kpi.billed_amount)} note={`${angka(d.kpi.billed_count)} angsuran jatuh tempo`} />
            <StatCard label="Terkumpul" value={rupiahRingkas(d.kpi.collected_amount)} note={`${angka(d.kpi.paid_count)} angsuran terbayar`} />
            <StatCard label="Tunggakan Baru" value={rupiahRingkas(d.kpi.arrears_amount)} note={`${angka(d.kpi.arrears_count)} angsuran belum bayar`} />
            <StatCard inverse label="Collection Rate" value={persen(rate)} note="target 95%" />
          </div>
          <div className="grid grid-cols-[1fr_368px] gap-6">
            <Card title="Rekap per Petugas">
              <Table
                rows={d.per_collector}
                rowKey={(r) => r.id}
                rowHeight="h-[50px]"
                columns={[
                  { key: "n", header: "Petugas", render: (r) => <b>{r.name}</b> },
                  { key: "w", header: "Wilayah", render: (r) => r.region_name },
                  { key: "t", header: "Tagihan", render: (r) => angka(r.billed) },
                  { key: "b", header: "Terbayar", render: (r) => angka(r.paid) },
                  { key: "k", header: "Terkumpul", render: (r) => rupiahRingkas(r.collected) },
                  { key: "u", header: "Tunggakan", render: (r) => rupiahRingkas(r.arrears) },
                  { key: "r", header: "Rate", render: (r) => { const v = r.billed ? r.paid / r.billed : 0; return <b className={v < 0.9 ? "text-warn-text" : ""}>{r.billed ? persen(v) : "—"}</b>; } },
                ]}
              />
              <h3 className="mt-6 text-body font-bold">Pembayaran per Metode</h3>
              <div className="mt-3 flex h-3.5 overflow-hidden rounded-pill bg-canvas">
                {d.methods.map((m) => <div key={m.method} className={METODE[m.method]?.[1]} style={{ width: `${(m.amount / (totalMetode || 1)) * 100}%` }} />)}
              </div>
              <div className="mt-3 flex gap-10">
                {d.methods.map((m) => (
                  <div key={m.method} className="flex items-start gap-2">
                    <span className={cx("mt-1 size-3 rounded-[3px]", METODE[m.method]?.[1])} />
                    <div>
                      <div className="text-small font-bold">{METODE[m.method]?.[0]} {persen(m.amount / (totalMetode || 1), 0)}</div>
                      <div className="text-small text-fg-muted">{rupiahRingkas(m.amount)}</div>
                    </div>
                  </div>
                ))}
                {d.methods.length === 0 && <span className="text-small text-fg-subtle">Belum ada pembayaran pada periode ini</span>}
              </div>
              <h3 className="mt-6 text-body font-bold">Pembayaran Harian</h3>
              <div className="mt-3 flex h-[120px] items-end gap-2 border-b border-line">
                {d.daily.map((h, i) => (
                  <div key={h.date} className="flex flex-1 flex-col items-center gap-1" title={`${h.date}: ${rupiahRingkas(h.amount)}`}>
                    <div className={cx("w-full max-w-[30px] rounded-t-[4px]", i === d.daily.length - 1 ? "bg-warn" : "bg-accent")} style={{ height: `${Math.max(2, (h.amount / maxHari) * 110)}px` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-2">
                {d.daily.map((h) => <span key={h.date} className="flex-1 text-center text-caption text-fg-muted">{Number(h.date.slice(8))}</span>)}
              </div>
            </Card>
            <Card title="Umur Tunggakan">
              <ul className="flex flex-col gap-5">
                {d.aging.map((a, i) => (
                  <li key={a.bucket}>
                    <div className="flex justify-between">
                      <div>
                        <div className="text-body-sm font-bold">{a.bucket}</div>
                        <div className="text-caption text-fg-subtle">{a.members} anggota</div>
                      </div>
                      <b className="text-body">{rupiahRingkas(a.amount)}</b>
                    </div>
                    <div className="mt-2 h-2 rounded-pill bg-canvas">
                      <div className={cx("h-full rounded-pill", AGING[i])} style={{ width: `${(a.amount / maxAging) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="my-6 border-t border-line-subtle" />
              <h3 className="text-body font-bold">Penagihan Lanjutan (6B)</h3>
              <ul className="mt-3 flex flex-col gap-2.5">
                {[["Telepon petugas (H+3)", d.follow_up.phone_call], ["Surat tagihan I (H+7)", d.follow_up.letter_1], ["Surat tagihan II (H+30)", d.follow_up.letter_2], ["Eskalasi ke Owner (> 90 hari)", d.follow_up.escalation]].map(([l, v]) => (
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
