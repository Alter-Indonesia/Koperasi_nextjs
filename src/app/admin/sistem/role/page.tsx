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
import { AREA_LABEL, type Area } from "@/lib/permissions";
import { withFreshState } from "@/components/layout/FreshState";
import { useSession } from "@/lib/session";

type Role = { id: number; code: string; name: string; description: string | null; area: Area; is_system: boolean; user_count: number; module_count: number };

function RolePage() {
  const { can } = useSession();
  const { data, error, loading, reload } = useApi<Role[]>("/api/v1/role");
  const hash = useHash();
  const [closed, setClosed] = useState(false);
  return (
    <>
      <PageHeader
        title="Role"
        subtitle="Role menentukan area menu dan hak akses tiap pengguna"
        actions={can("roles", "create") && <Link href="/admin/sistem/role/baru" className={buttonClass("primary", "lg")}>+ Role Baru</Link>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <Skeleton className="h-[260px]" />
        ) : (
          <Table
            rows={data ?? []}
            rowKey={(r) => r.id}
            empty="Belum ada role"
            columns={[
              { key: "d", header: "Detail", className: "w-[64px]", render: (r) => <DetailLink href={`/admin/sistem/role/${r.id}`} label={r.name} /> },
              { key: "n", header: "Role", render: (r) => <div><b>{r.name}</b><div className="text-small text-fg-subtle">{r.description ?? r.code}</div></div> },
              { key: "c", header: "Kode", render: (r) => r.code },
              { key: "a", header: "Area menu", render: (r) => AREA_LABEL[r.area] },
              { key: "m", header: "Modul berhak", render: (r) => r.module_count },
              { key: "u", header: "Pengguna", render: (r) => r.user_count },
              { key: "t", header: "Jenis", render: (r) => (r.is_system ? <Badge tone="sudah-bayar">Bawaan</Badge> : <Badge tone="belum-bayar">Kustom</Badge>) },
            ]}
          />
        )}
      </Card>
      <Toast message={hash === "dihapus" && !closed ? "Role berhasil dihapus" : null} onClose={() => setClosed(true)} />
    </>
  );
}

export default withFreshState(RolePage, { module: "roles" });
