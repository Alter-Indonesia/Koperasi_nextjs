"use client";
import Link from "next/link";
import { use, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, KolBadge, type Kolektibilitas } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { Table } from "@/components/ui/Table";
import { useApi, useHash } from "@/lib/api";
import { type AdminFeeMode, loanAmounts } from "@/lib/loan-calc";
import { isoHariIni, rupiah, tanggal, tenorLabel, type TenorUnit } from "@/lib/format";
import { withFreshState } from "@/components/layout/FreshState";

type Detail = {
  id: number; loan_number: string; member_id: number; member_name: string; member_number: string; region_name: string; principal_amount: number; tenor_duration: number; tenor_unit: TenorUnit; admin_fee: number; admin_fee_mode: AdminFeeMode; installment_amount: number;
  interest_rate_percent: number; remaining_balance: number; arrears_amount: number; status: "pengajuan" | "aktif" | "lunas" | "ditolak"; collectibility: Kolektibilitas;
  purpose: string | null; collateral: string | null; disbursed_on: string | null;
  installments: { id: number; sequence: number; due_date: string; total_amount: number; status: "belum" | "menunggu_verifikasi" | "lunas"; paid_at: string | null }[];
};

function DetailPinjamanPage({ params }: PageProps<"/admin/pinjaman/[id]">) {
  const { id } = use(params);
  const { data: d, error, loading, reload } = useApi<Detail>(`/api/v1/pinjaman/${id}`);
  const hash = useHash();
  const [tutup, setTutup] = useState(false);

  return (
    <>
      <Link href="/admin/pinjaman" className="mb-3 inline-block text-body-sm font-medium text-fg-muted hover:text-fg">← Data Pinjaman</Link>
      <PageHeader
        title={d ? d.loan_number : "Detail Pinjaman"}
        subtitle={d ? <>{d.member_name}  ·  {d.member_number}  ·  {d.region_name}</> : "Memuat…"}
        actions={d && <KolBadge value={d.collectibility} />}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !d && <Skeleton className="h-[480px]" />}
      {d && (
        <div className="flex flex-col gap-6">
          {d.status === "pengajuan" && (
            <div className="rounded-card border border-warn bg-card px-5 py-4 text-body-sm text-warn-text">Pinjaman ini berstatus pengajuan (di atas Rp 20 jt) dan menunggu persetujuan Owner. Jadwal angsuran dibuat setelah disetujui.</div>
          )}
          <Card title="Ringkasan">
            <div className="grid grid-cols-4 gap-6">
              {([
                ["Plafon", rupiah(d.principal_amount)], ["Tenor", tenorLabel(d.tenor_duration, d.tenor_unit)], [`Angsuran / ${d.tenor_unit}`, rupiah(d.installment_amount)], ["Jasa", `${d.interest_rate_percent}% / ${d.tenor_unit === "hari" ? "hari" : "bln"} flat`],
                ["Biaya admin", `${rupiah(d.admin_fee)} (${d.admin_fee_mode === "tambah" ? "penambah" : "pengurang"})`], ["Pokok ditagih", rupiah(loanAmounts(d.principal_amount, d.admin_fee, d.admin_fee_mode).financed)], ["Dana diterima", rupiah(loanAmounts(d.principal_amount, d.admin_fee, d.admin_fee_mode).received)],
                ["Sisa pinjaman", rupiah(d.remaining_balance)], ["Tunggakan", rupiah(d.arrears_amount)], ["Tanggal cair", d.disbursed_on ? tanggal(d.disbursed_on) : "—"], ["Status", d.status],
                ["Tujuan", d.purpose ?? "—"], ["Jaminan", d.collateral ?? "—"],
              ] as const).map(([l, v]) => (
                <div key={l}>
                  <div className="text-small text-fg-muted">{l}</div>
                  <div className="mt-1 text-body font-bold capitalize">{v}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Jadwal Angsuran">
            <Table
              rows={d.installments}
              rowKey={(r) => r.id}
              rowHeight="h-11"
              empty="Belum ada jadwal angsuran"
              columns={[
                { key: "k", header: "Ke-", render: (r) => r.sequence },
                { key: "t", header: "Jatuh tempo", render: (r) => tanggal(r.due_date) },
                { key: "n", header: "Nominal", render: (r) => rupiah(r.total_amount) },
                { key: "s", header: "Status", render: (r) => r.status === "lunas" ? <Badge tone="sudah-bayar">Lunas</Badge> : r.status === "menunggu_verifikasi" ? <Badge tone="warn-outline">Menunggu verifikasi</Badge> : r.due_date < isoHariIni() ? <Badge tone="telat">Telat</Badge> : <Badge tone="belum-bayar">Belum</Badge> },
              ]}
            />
          </Card>
        </div>
      )}
      <Toast message={hash === "dibuat" && !tutup ? "Pinjaman berhasil disimpan" : null} onClose={() => setTutup(true)} />
    </>
  );
}

export default withFreshState(DetailPinjamanPage, { module: "loans" });
