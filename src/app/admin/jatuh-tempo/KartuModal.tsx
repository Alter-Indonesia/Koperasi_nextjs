"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, KolBadge, type Kolektibilitas } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorBox, Modal, Skeleton } from "@/components/ui/Feedback";
import { Checkbox } from "@/components/ui/Form";
import { CellStack, Table, type Column } from "@/components/ui/Table";
import { qs, useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import { rupiah, selisihHari, tanggal, tanggalPendek, tenorLabel, type TenorUnit } from "@/lib/format";

export type Row = {
  id: number; loan_id: number; sequence: number; due_date: string; total_amount: number; status: string; tenor_duration: number; tenor_unit: TenorUnit; loan_number: string;
  member_name: string; region_name: string; collector_name: string | null; days_overdue: number; reminder_channel: string | null; reminder_status: string | null;
};
export type Kartu = { bucket: "overdue" | "today" | "tomorrow" | "h3"; label: string; count: number; amount: number };

type Loan = {
  id: number; principal_amount: number; tenor_duration: number; tenor_unit: TenorUnit; installment_amount: number; interest_rate_percent: number; remaining_balance: number; arrears_amount: number;
  collectibility: Kolektibilitas; purpose: string | null; collateral: string | null; disbursed_on: string | null; paid_installments: number; status: string;
  installments: { id: number; sequence: number; due_date: string; total_amount: number; status: string }[];
};

/** Rincian di bawah baris: ringkasan pinjaman + angsuran yang telat bayar (relatif terhadap tanggal acuan halaman). */
function Rincian({ row, date }: { row: Row; date: string }) {
  const { data: d, error, reload } = useApi<Loan>(`/api/v1/pinjaman/${row.loan_id}`);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!d) return <Skeleton className="h-[120px]" />;
  const telat = d.installments.filter((x) => x.status === "belum" && x.due_date < date);
  const per = d.tenor_unit === "hari" ? "hari" : "bln";
  const info: [string, React.ReactNode][] = [
    ["Plafon", rupiah(d.principal_amount)], ["Tenor", tenorLabel(d.tenor_duration, d.tenor_unit)], [`Angsuran / ${d.tenor_unit}`, rupiah(d.installment_amount)], ["Jasa", `${d.interest_rate_percent}% / ${per} flat`],
    ["Sisa pinjaman", rupiah(d.remaining_balance)], ["Tunggakan", rupiah(d.arrears_amount)], ["Kolektibilitas", <KolBadge key="k" value={d.collectibility} />], ["Terbayar", `${d.paid_installments} / ${d.tenor_duration} angsuran`],
    ["Tanggal cair", d.disbursed_on ? tanggal(d.disbursed_on) : "—"], ["Tujuan", d.purpose ?? "—"], ["Jaminan", d.collateral ?? "—"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-x-6 gap-y-3">
        {info.map(([l, v]) => (
          <div key={l}>
            <div className="text-caption text-fg-muted">{l}</div>
            <div className="mt-0.5 text-body-sm font-bold text-fg">{v}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-2 text-body-sm font-bold text-fg">{telat.length ? `Angsuran telat bayar (${telat.length})` : "Angsuran telat bayar"}</div>
        {telat.length === 0 ? (
          <p className="text-small text-fg-muted">Tidak ada angsuran yang telat.</p>
        ) : (
          <div className="overflow-hidden rounded-ctl border border-line bg-card">
            <table className="w-full text-small">
              <thead>
                <tr className="text-left text-caption font-bold uppercase tracking-[0.5px] text-fg-muted">
                  <th className="px-3 py-2">Ke-</th><th className="px-3 py-2">Jatuh tempo</th><th className="px-3 py-2">Nominal</th><th className="px-3 py-2">Telat</th>
                </tr>
              </thead>
              <tbody>
                {telat.map((x) => (
                  <tr key={x.id} className="border-t border-line-subtle">
                    <td className="px-3 py-2">{x.sequence}/{d.tenor_duration}</td>
                    <td className="px-3 py-2">{tanggalPendek(x.due_date)}</td>
                    <td className="px-3 py-2 font-bold">{rupiah(x.total_amount)}</td>
                    <td className="px-3 py-2"><Badge tone="telat">{selisihHari(x.due_date, date)} hari</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modal daftar angsuran di balik satu kartu ringkasan: ceklis (kiri) untuk kirim pengingat, klik baris untuk membuka rincian
 * pinjaman + angsuran telat di bawahnya, dan tautan ke halaman detail pinjaman. Dipasang hanya saat kartu dipilih (state selalu bersih).
 */
export function KartuModal({ kartu, date, onClose, onRemind, busy }: { kartu: Kartu; date: string | null; onClose: () => void; onRemind: (ids: number[]) => Promise<boolean>; busy: boolean }) {
  const { can } = useSession();
  const canSend = can("reminders", "create"); // tanpa hak kirim pengingat: tanpa kolom ceklis & tombol kirim
  const { data, error, reload } = useApi<Row[]>(`/api/v1/jatuh-tempo${qs({ date, bucket: kartu.bucket })}`);
  const [picked, setPicked] = useState<number[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const rows = data ?? [];
  const selectable = canSend ? rows.filter((x) => x.status === "belum") : []; // hanya angsuran belum dibayar yang bisa diingatkan
  const all = selectable.length > 0 && selectable.every((x) => picked.includes(x.id));
  const toggle = (id: number, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  async function send() {
    if (await onRemind(picked)) { setPicked([]); reload(); }
  }

  return (
    <Modal
      wide
      open
      title={`${kartu.label} · ${kartu.count} angsuran · ${rupiah(kartu.amount)}`}
      onClose={onClose}
      footer={
        <>
          {canSend && <span className="mr-auto self-center text-small text-fg-muted">{picked.length ? `${picked.length} angsuran dipilih` : "Ceklis angsuran untuk mengirim pengingat"}</span>}
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          {canSend && <Button variant="accent" disabled={busy || picked.length === 0} onClick={send}>{busy ? "Mengirim…" : `Kirim Pengingat${picked.length ? ` (${picked.length})` : ""}`}</Button>}
        </>
      }
    >
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error ? (
        <Skeleton className="h-[260px]" />
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <Table
            rows={rows}
            rowKey={(x) => x.id}
            empty="Tidak ada angsuran"
            onRowClick={(x) => setOpen((o) => (o === x.id ? null : x.id))}
            selectedKey={open}
            expandedKey={open}
            renderExpanded={(x) => <Rincian row={x} date={date ?? x.due_date} />}
            columns={[
              ...(!canSend ? [] : [{
                key: "c", className: "w-[48px]",
                header: <Checkbox checked={all} label="Pilih semua" onChange={(v) => setPicked(v ? selectable.map((x) => x.id) : [])} />,
                render: (x) => x.status === "belum"
                  ? <span onClick={(e) => e.stopPropagation()}><Checkbox checked={picked.includes(x.id)} label={`Pilih ${x.member_name}`} onChange={(v) => toggle(x.id, v)} /></span>
                  : <span className="text-fg-subtle">—</span>,
              }] as Column<Row>[]),
              { key: "a", header: "Anggota", render: (x) => <CellStack title={x.member_name} sub={x.region_name} /> },
              { key: "n", header: "No. Pinjaman", render: (x) => x.loan_number },
              { key: "t", header: "Jatuh tempo", render: (x) => tanggalPendek(x.due_date) },
              { key: "k", header: "Ke-", render: (x) => `${x.sequence}/${x.tenor_duration}` },
              { key: "r", header: "Nominal", render: (x) => <b>{rupiah(x.total_amount)}</b> },
              { key: "p", header: "Petugas", render: (x) => x.collector_name?.split(" ")[0] ?? "—" },
              { key: "s", header: "Status", render: (x) => x.status !== "belum" ? <Badge tone="sudah-bayar">Sudah bayar</Badge> : x.days_overdue > 0 ? <Badge tone="telat">Telat {x.days_overdue} hari</Badge> : <Badge tone="belum-bayar">Belum bayar</Badge> },
              {
                key: "d", header: "", className: "w-[90px]",
                render: (x) => <Link href={`/admin/pinjaman/${x.loan_id}`} onClick={(e) => e.stopPropagation()} className="font-bold whitespace-nowrap text-warn-text hover:underline">Detail →</Link>,
              },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}
