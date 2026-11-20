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
import { tenorLabel, type TenorUnit } from "@/lib/format";
import { withFreshState } from "@/components/layout/FreshState";
import { useSession } from "@/lib/session";

type Tenor = { id: number; duration: number; unit: TenorUnit; interest_rate_percent: number; label: string | null; is_active: boolean; sort_order: number };

function TenorPage() {
  const { can } = useSession();
  const { data, error, loading, reload } = useApi<Tenor[]>("/api/v1/tenor");
  const hash = useHash();
  const [closed, setClosed] = useState(false);
  return (
    <>
      <PageHeader
        title="Tenor"
        subtitle="Pilihan lama pinjaman (bulanan/harian) beserta jasanya, tersedia di form pinjaman"
        actions={can("tenors", "create") && <Link href="/admin/master/tenor/baru" className={buttonClass("primary", "lg")}>+ Tenor Baru</Link>}
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
              { key: "d", header: "Detail", className: "w-[64px]", render: (r) => <DetailLink href={`/admin/master/tenor/${r.id}`} label={tenorLabel(r.duration, r.unit)} /> },
              { key: "u", header: "Satuan", render: (r) => <span className="capitalize">{r.unit === "hari" ? "Harian" : "Bulanan"}</span> },
              { key: "m", header: "Lama", render: (r) => <b>{tenorLabel(r.duration, r.unit)}</b> },
              { key: "j", header: "Jasa", render: (r) => `${r.interest_rate_percent}% / ${r.unit === "hari" ? "hari" : "bln"}` },
              { key: "l", header: "Label", render: (r) => r.label ?? tenorLabel(r.duration, r.unit) },
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

export default withFreshState(TenorPage, { module: "tenors" });
