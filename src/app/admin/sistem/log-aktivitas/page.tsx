"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DetailLink } from "@/components/crud/EntityPages";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { Input, SearchInput, Select } from "@/components/ui/Form";
import { Pager, Table } from "@/components/ui/Table";
import { qs, useApi, useDebounced } from "@/lib/api";
import { jam, tanggal } from "@/lib/format";
import { ACTIVITY_LABEL, MODULES } from "@/lib/permissions";
import { withFreshState } from "@/components/layout/FreshState";

type Log = { id: number; user_name: string | null; action: string; module: string | null; method: string | null; path: string | null; status_code: number | null; ip: string | null; created_at: string };
type Meta = { page: number; limit: number; total: number };

const moduleLabel = (m: string | null) => (m === "auth" ? "Autentikasi" : MODULES.find((x) => x.code === m)?.label ?? m ?? "—");
const tone = (a: string): BadgeTone => (a === "login_failed" || a === "delete" ? "telat" : a === "login" || a === "logout" ? "belum-bayar" : "sudah-bayar");

function LogAktivitasPage() {
  const [cari, setCari] = useState("");
  const [mod, setMod] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(cari);
  const { data, meta, error, loading, reload } = useApi<Log[], Meta>(`/api/v1/log-aktivitas${qs({ q, module: mod, action, from, to, page, limit: 15 })}`);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  return (
    <>
      <PageHeader title="Log Aktivitas" subtitle={meta ? `${meta.total} catatan · hanya baca` : "Jejak login dan perubahan data oleh pengguna"} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="w-[190px]"><Select ukuran="compact" value={mod} onChange={(e) => reset(setMod)(e.target.value)}>
            <option value="">Semua modul</option>
            <option value="auth">Autentikasi</option>
            {MODULES.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </Select></div>
          <div className="w-[170px]"><Select ukuran="compact" value={action} onChange={(e) => reset(setAction)(e.target.value)}>
            <option value="">Semua aksi</option>
            {Object.entries(ACTIVITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select></div>
          <div className="w-[150px]"><Input ukuran="compact" type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} aria-label="Dari tanggal" /></div>
          <span className="text-fg-muted">s.d.</span>
          <div className="w-[150px]"><Input ukuran="compact" type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} aria-label="Sampai tanggal" /></div>
          <SearchInput value={cari} onChange={reset(setCari)} placeholder="Cari pengguna / alamat API" className="ml-auto w-[260px]" />
        </div>
        {loading && !data ? (
          <Skeleton className="h-[480px]" />
        ) : (
          <>
            <Table
              rows={data ?? []}
              rowKey={(r) => r.id}
              empty="Tidak ada catatan"
              rowHeight="h-[52px]"
              columns={[
                { key: "d", header: "Detail", className: "w-[64px]", render: (r) => <DetailLink href={`/admin/sistem/log-aktivitas/${r.id}`} label={`catatan ${r.id}`} /> },
                { key: "w", header: "Waktu", render: (r) => `${tanggal(r.created_at)}, ${jam(r.created_at)}` },
                { key: "u", header: "Pengguna", render: (r) => r.user_name ?? "—" },
                { key: "a", header: "Aksi", render: (r) => <Badge tone={tone(r.action)}>{ACTIVITY_LABEL[r.action] ?? r.action}</Badge> },
                { key: "m", header: "Modul", render: (r) => moduleLabel(r.module) },
                { key: "p", header: "Rincian", render: (r) => <span className="text-fg-muted">{r.method} {r.path}</span> },
                { key: "s", header: "Status", render: (r) => <span className={r.status_code && r.status_code >= 400 ? "font-bold text-warn-text" : ""}>{r.status_code ?? "—"}</span> },
              ]}
            />
            {meta && <Pager page={page} total={meta.total} limit={meta.limit} onPage={setPage} label="catatan" />}
          </>
        )}
      </Card>
    </>
  );
}

export default withFreshState(LogAktivitasPage, { module: "activity_logs" });
