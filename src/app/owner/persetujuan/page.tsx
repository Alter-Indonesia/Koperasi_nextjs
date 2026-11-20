"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, avatarTone } from "@/components/ui/Avatar";
import { Card, StatCard } from "@/components/ui/Card";
import { DetailLink } from "@/components/crud/EntityPages";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { CellStack, Table } from "@/components/ui/Table";
import { useApi, useHash } from "@/lib/api";
import { angka, rupiah, rupiahRingkas, tanggal, tenorLabel, type TenorUnit } from "@/lib/format";
import { withFreshState } from "@/components/layout/FreshState";

type Row = { id: number; loan_number: string; member_name: string; member_number: string; region_name: string; principal_amount: number; tenor_duration: number; tenor_unit: TenorUnit; purpose: string | null; collateral: string | null; created_at: string; submitted_by_name: string | null };
type Meta = { summary: { pending: number; pending_amount: number; approved_today: number; rejected_today: number } };

function PersetujuanPage() {
  const { data, meta, error, loading, reload } = useApi<Row[], Meta>("/api/v1/persetujuan");
  const hash = useHash();
  const [closed, setClosed] = useState(false);
  const s = meta?.summary;
  return (
    <>
      <PageHeader title="Persetujuan Pinjaman" subtitle="Pengajuan di atas Rp 20 juta memerlukan keputusan Owner" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        <StatCard tone="accent" label="Menunggu Keputusan" value={s ? angka(s.pending) : "…"} note="pengajuan" />
        <StatCard inverse label="Nilai Pengajuan" value={s ? rupiahRingkas(s.pending_amount) : "…"} note="total plafon menunggu" />
        <StatCard label="Disetujui Hari Ini" value={s ? angka(s.approved_today) : "…"} />
        <StatCard label="Ditolak Hari Ini" value={s ? angka(s.rejected_today) : "…"} />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <Skeleton className="h-[320px]" />
        ) : (
          <Table
            rows={data ?? []}
            rowKey={(r) => r.id}
            empty="Tidak ada pengajuan yang menunggu keputusan"
            columns={[
              { key: "d", header: "Detail", className: "w-[64px]", render: (r) => <DetailLink href={`/owner/persetujuan/${r.id}`} label={r.loan_number} /> },
              { key: "a", header: "Anggota", render: (r, i) => <CellStack avatar={<Avatar name={r.member_name} size={32} tone={avatarTone(i)} />} title={r.member_name} sub={`${r.member_number} · ${r.region_name}`} /> },
              { key: "n", header: "No. Pinjaman", render: (r) => <span className="font-medium">{r.loan_number}</span> },
              { key: "p", header: "Plafon", render: (r) => <b>{rupiah(r.principal_amount)}</b> },
              { key: "t", header: "Tenor", render: (r) => tenorLabel(r.tenor_duration, r.tenor_unit, true) },
              { key: "u", header: "Tujuan", render: (r) => r.purpose ?? "—" },
              { key: "j", header: "Jaminan", render: (r) => r.collateral ?? "—" },
              { key: "g", header: "Diajukan", render: (r) => tanggal(r.created_at) },
            ]}
          />
        )}
      </Card>
      <Toast message={hash === "diputuskan" && !closed ? "Keputusan tersimpan" : null} onClose={() => setClosed(true)} />
    </>
  );
}

export default withFreshState(PersetujuanPage, { module: "loan_approvals" });
