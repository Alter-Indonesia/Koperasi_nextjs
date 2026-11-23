"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, StatCard } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { SearchInput } from "@/components/ui/Form";
import { CellStack, Pager, Table } from "@/components/ui/Table";
import { qs, useApi, useDebounced, useHash } from "@/lib/api";
import { DEPOSIT_LABEL, DEPOSIT_TONE, type DepositStatus } from "@/lib/deposit";
import { angka, rupiah, rupiahRingkas, tanggalPendek } from "@/lib/format";
import { withFreshState } from "@/components/layout/FreshState";

type Row = {
  id: number; deposited_on: string; amount: number; payment_count: number; status: DepositStatus; received_amount: number | null; returned_amount: number;
  notes: string | null; collector_name: string; received_by_name: string | null;
};
type Meta = { page: number; limit: number; total: number; summary: { pending: number; pending_amount: number; received_today: number; returned_today: number } };

function SetoranPage() {
  const router = useRouter();
  const [status, setStatus] = useState<DepositStatus | null>("menunggu");
  const [cari, setCari] = useState("");
  const [page, setPage] = useState(1);
  const [closed, setClosed] = useState(false);
  const hash = useHash();
  const q = useDebounced(cari);
  const { data, meta, error, loading, reload } = useApi<Row[], Meta>(`/api/v1/setoran${qs({ status, q, page, limit: 10 })}`);
  const s = meta?.summary;
  return (
    <>
      <PageHeader title="Setoran Petugas" subtitle="Terima atau tolak setoran uang tunai dari petugas lapangan" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        <StatCard tone="accent" label="Menunggu Diterima" value={s ? angka(s.pending) : "…"} note="setoran" />
        <StatCard inverse label="Nilai Menunggu" value={s ? rupiahRingkas(s.pending_amount) : "…"} note="uang tunai belum diterima" />
        <StatCard label="Diterima Hari Ini" value={s ? rupiahRingkas(s.received_today) : "…"} />
        <StatCard label="Dikembalikan Hari Ini" value={s ? rupiahRingkas(s.returned_today) : "…"} note="ke petugas" />
      </div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <ChipGroup
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: null as DepositStatus | null, label: "Semua" }, ...(Object.keys(DEPOSIT_LABEL) as DepositStatus[]).map((k) => ({ value: k as DepositStatus | null, label: DEPOSIT_LABEL[k] }))]}
        />
        <SearchInput value={cari} onChange={(v) => { setCari(v); setPage(1); }} placeholder="Cari nama petugas" className="w-[280px]" />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <>
            <Table
              rows={data ?? []}
              rowKey={(r) => r.id}
              rowHeight="h-[62px]"
              empty="Tidak ada setoran"
              onRowClick={(r) => router.push(`/admin/setoran/${r.id}`)}
              columns={[
                { key: "t", header: "Tanggal", render: (r) => tanggalPendek(r.deposited_on) },
                { key: "p", header: "Petugas", render: (r) => <CellStack title={r.collector_name} sub={`${r.payment_count} pembayaran`} /> },
                { key: "a", header: "Disetor", render: (r) => <b>{rupiah(r.amount)}</b> },
                { key: "d", header: "Diterima", render: (r) => (r.received_amount === null ? "—" : rupiah(r.received_amount)) },
                { key: "k", header: "Dikembalikan", render: (r) => (r.returned_amount > 0 ? <span className="font-bold text-warn-text">{rupiah(r.returned_amount)}</span> : "—") },
                { key: "s", header: "Status", render: (r) => <Badge tone={DEPOSIT_TONE[r.status]}>{DEPOSIT_LABEL[r.status]}</Badge> },
                { key: "ak", header: "", render: (r) => <span className="font-bold text-warn-text">{r.status === "menunggu" ? "Proses →" : "Detail →"}</span> },
              ]}
            />
            {meta && <Pager page={page} total={meta.total} limit={meta.limit} onPage={setPage} label="setoran" />}
          </>
        )}
      </Card>
      <Toast message={hash === "diputuskan" && !closed ? "Keputusan setoran tersimpan" : null} onClose={() => setClosed(true)} />
    </>
  );
}

export default withFreshState(SetoranPage, { module: "deposit_receipts" });
