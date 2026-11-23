"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KolBadge, type Kolektibilitas } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { SearchInput } from "@/components/ui/Form";
import { CellStack, Pager, Table } from "@/components/ui/Table";
import { qs, useApi, useDebounced } from "@/lib/api";
import { angka, rupiah, rupiahRingkas, tanggalPendek, tenorLabel, type TenorUnit } from "@/lib/format";
import { withFreshState } from "@/components/layout/FreshState";
import { useSession } from "@/lib/session";

type Loan = {
  id: number; loan_number: string; member_name: string; region_name: string; loan_amount: number; tenor_duration: number; tenor_unit: TenorUnit; installment_amount: number;
  next_due_date: string | null; remaining_balance: number; paid_installments: number; days_overdue: number; collectibility: Kolektibilitas;
};
type Meta = { page: number; limit: number; total: number; outstanding: number; total_active: number; collectibility: Record<Kolektibilitas, number> };
const KOL: Kolektibilitas[] = ["Lancar", "DPK", "Kurang Lancar", "Diragukan", "Macet"];

function PinjamanPage() {
  const { can } = useSession();
  const [kol, setKol] = useState<Kolektibilitas | null>(null);
  const [cari, setCari] = useState("");
  const [page, setPage] = useState(1);
  const router = useRouter();
  const q = useDebounced(cari);
  const { data, meta, error, loading, reload } = useApi<Loan[], Meta>(`/api/v1/pinjaman${qs({ collectibility: kol, q, page, limit: 10 })}`);
  return (
    <>
      <PageHeader
        title="Data Pinjaman"
        subtitle={meta ? `${angka(meta.total_active)} pinjaman aktif  ·  outstanding ${rupiahRingkas(meta.outstanding)}` : "Memuat…"}
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => window.open(`/api/v1/pinjaman${qs({ collectibility: kol, q, limit: 100 })}`, "_blank")}>Ekspor JSON</Button>
            {can("loans", "create") && <Link href="/admin/pinjaman/baru" className={buttonClass("primary", "lg")}>+ Pinjaman Baru</Link>}
          </>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-4">
        <ChipGroup
          value={kol}
          onChange={(v) => { setKol(v); setPage(1); }}
          options={[{ value: null, label: `Semua  ${meta ? angka(meta.total_active) : ""}` }, ...KOL.map((k) => ({ value: k as Kolektibilitas | null, label: `${k}  ${meta ? angka(meta.collectibility[k]) : ""}` }))]}
        />
        <SearchInput value={cari} onChange={(v) => { setCari(v); setPage(1); }} placeholder="Cari no. pinjaman / anggota" className="w-[280px]" />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <Skeleton className="h-[600px]" />
        ) : (
          <>
            <Table
              rows={data ?? []}
              rowKey={(r) => r.id}
              rowHeight="h-[62px]"
              onRowClick={(r) => router.push(`/admin/pinjaman/${r.id}`)}
              columns={[
                { key: "no", header: "No. Pinjaman", render: (r) => <span className="font-medium">{r.loan_number}</span> },
                { key: "ag", header: "Anggota", render: (r) => <CellStack title={r.member_name} sub={r.region_name} /> },
                { key: "pl", header: "Pinjaman", render: (r) => rupiah(r.loan_amount) },
                { key: "tn", header: "Tenor", render: (r) => tenorLabel(r.tenor_duration, r.tenor_unit, true) },
                { key: "an", header: "Angsuran/bln", render: (r) => rupiah(r.installment_amount) },
                { key: "jt", header: "Jatuh Tempo", render: (r) => (r.next_due_date ? <span className={r.days_overdue > 0 ? "font-bold text-warn-text" : ""}>{tanggalPendek(r.next_due_date)}</span> : "—") },
                { key: "si", header: "Sisa Pinjaman", render: (r) => <b>{rupiah(r.remaining_balance)}</b> },
                { key: "kl", header: "Kolektibilitas", render: (r) => <KolBadge value={r.collectibility} /> },
                { key: "ak", header: "", render: () => <span className="font-bold text-warn-text">Detail →</span> },
              ]}
            />
            {meta && <Pager page={page} total={meta.total} limit={meta.limit} onPage={setPage} label="pinjaman" />}
          </>
        )}
      </Card>
    </>
  );
}

export default withFreshState(PinjamanPage, { module: "loans" });
