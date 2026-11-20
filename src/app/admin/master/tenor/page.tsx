"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DetailLink } from "@/components/crud/EntityPages";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { Table } from "@/components/ui/Table";
import { useApi, useHash } from "@/lib/api";

type Tenor = { id: number; months: number; label: string | null; is_active: boolean; sort_order: number };

export default function TenorPage() {
  const { data, error, loading, reload } = useApi<Tenor[]>("/api/v1/tenor");
  const hash = useHash();
  const [closed, setClosed] = useState(false);
  return (
    <>
      <PageHeader
        title="Tenor"
        subtitle="Pilihan lama pinjaman yang tersedia di form pinjaman"
        actions={<Link href="/admin/master/tenor/baru" className={buttonClass("primary", "lg")}>+ Tenor Baru</Link>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <Skeleton className="h-[260px]" />
        ) : (
          <Table
            rows={data ?? []}
            rowKey={(r) => r.id}
            empty="Belum ada tenor"
            columns={[
              { key: "d", header: "Detail", className: "w-[64px]", render: (r) => <DetailLink href={`/admin/master/tenor/${r.id}`} label={`${r.months} bulan`} /> },
              { key: "m", header: "Lama (bulan)", render: (r) => <b>{r.months}</b> },
              { key: "l", header: "Label", render: (r) => r.label ?? `${r.months} bulan` },
              { key: "o", header: "Urutan", render: (r) => r.sort_order },
              { key: "s", header: "Status", render: (r) => (r.is_active ? <Badge tone="belum-bayar">Aktif</Badge> : <Badge tone="warn-outline">Nonaktif</Badge>) },
            ]}
          />
        )}
      </Card>
      <Toast message={hash === "dihapus" && !closed ? "Tenor berhasil dihapus" : null} onClose={() => setClosed(true)} />
    </>
  );
}
