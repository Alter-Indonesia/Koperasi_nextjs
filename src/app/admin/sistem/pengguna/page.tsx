"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, avatarTone } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DetailLink } from "@/components/crud/EntityPages";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { SearchInput, Select } from "@/components/ui/Form";
import { CellStack, Pager, Table } from "@/components/ui/Table";
import { qs, useApi, useDebounced, useHash } from "@/lib/api";
import { jam, tanggal } from "@/lib/format";

type User = { id: number; code: string | null; name: string; email: string; role: string; role_name: string; region_name: string | null; status: "aktif" | "nonaktif"; last_login_at: string | null };
type Meta = { page: number; limit: number; total: number };

export default function PenggunaPage() {
  const [cari, setCari] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(cari);
  const { data: roles } = useApi<{ id: number; code: string; name: string }[]>("/api/v1/role");
  const { data, meta, error, loading, reload } = useApi<User[], Meta>(`/api/v1/pengguna${qs({ q, role, status, page, limit: 10 })}`);
  const hash = useHash();
  const [closed, setClosed] = useState(false);
  return (
    <>
      <PageHeader
        title="Pengguna"
        subtitle={meta ? `${meta.total} akun terdaftar` : "Memuat…"}
        actions={<Link href="/admin/sistem/pengguna/baru" className={buttonClass("primary", "lg")}>+ Pengguna Baru</Link>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-[200px]">
              <Select ukuran="compact" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
                <option value="">Semua role</option>
                {roles?.map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
              </Select>
            </div>
            <div className="w-[160px]">
              <Select ukuran="compact" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">Semua status</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </Select>
            </div>
          </div>
          <SearchInput value={cari} onChange={(v) => { setCari(v); setPage(1); }} placeholder="Cari nama / email / kode" className="w-[280px]" />
        </div>
        {loading && !data ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <>
            <Table
              rows={data ?? []}
              rowKey={(r) => r.id}
              empty="Tidak ada pengguna"
              columns={[
                { key: "d", header: "Detail", className: "w-[64px]", render: (r) => <DetailLink href={`/admin/sistem/pengguna/${r.id}`} label={r.name} /> },
                { key: "n", header: "Pengguna", render: (r, i) => <CellStack avatar={<Avatar name={r.name} size={32} tone={avatarTone(i)} />} title={r.name} sub={r.email} /> },
                { key: "c", header: "Kode", render: (r) => r.code ?? "—" },
                { key: "r", header: "Role", render: (r) => r.role_name },
                { key: "w", header: "Wilayah", render: (r) => r.region_name ?? "—" },
                { key: "l", header: "Login terakhir", render: (r) => (r.last_login_at ? `${tanggal(r.last_login_at)}, ${jam(r.last_login_at)}` : "—") },
                { key: "s", header: "Status", render: (r) => (r.status === "aktif" ? <Badge tone="belum-bayar">Aktif</Badge> : <Badge tone="warn-outline">Nonaktif</Badge>) },
              ]}
            />
            {meta && <Pager page={page} total={meta.total} limit={meta.limit} onPage={setPage} label="pengguna" />}
          </>
        )}
      </Card>
      <Toast message={hash === "dihapus" && !closed ? "Pengguna berhasil dihapus" : null} onClose={() => setClosed(true)} />
    </>
  );
}
