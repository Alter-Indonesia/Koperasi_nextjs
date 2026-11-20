"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DetailLink } from "@/components/crud/EntityPages";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { Table } from "@/components/ui/Table";
import { useApi, useHash } from "@/lib/api";
import { angka } from "@/lib/format";

type Region = { id: number; name: string; member_count: number; user_count: number };

export default function WilayahPage() {
  const { data, error, loading, reload } = useApi<Region[]>("/api/v1/wilayah");
  const hash = useHash();
  const [closed, setClosed] = useState(false);
  return (
    <>
      <PageHeader
        title="Wilayah"
        subtitle={data ? `${data.length} wilayah layanan` : "Memuat…"}
        actions={<Link href="/admin/master/wilayah/baru" className={buttonClass("primary", "lg")}>+ Wilayah Baru</Link>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <Skeleton className="h-[260px]" />
        ) : (
          <Table
            rows={data ?? []}
            rowKey={(r) => r.id}
            empty="Belum ada wilayah"
            columns={[
              { key: "d", header: "Detail", className: "w-[64px]", render: (r) => <DetailLink href={`/admin/master/wilayah/${r.id}`} label={r.name} /> },
              { key: "n", header: "Nama wilayah", render: (r) => <b>{r.name}</b> },
              { key: "m", header: "Anggota", render: (r) => angka(r.member_count) },
              { key: "u", header: "Pengguna", render: (r) => angka(r.user_count) },
            ]}
          />
        )}
      </Card>
      <Toast message={hash === "dihapus" && !closed ? "Wilayah berhasil dihapus" : null} onClose={() => setClosed(true)} />
    </>
  );
}
