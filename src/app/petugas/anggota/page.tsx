"use client";
import { Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { SearchInput } from "@/components/ui/Form";
import { Table, type Column } from "@/components/ui/Table";
import { qs, useApi, useDebounced, useHash } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { useSession } from "@/lib/session";
import { PelunasanPanel } from "./PelunasanPanel";

type Anggota = { id: number; member_number: string; name: string; phone: string | null; address: string | null; region_name: string; active_loans: number; paid_loans: number; arrears_amount: number };

const KOLOM: Column<Anggota>[] = [
  { key: "name", header: "Anggota", render: (m) => <div className="min-w-0"><p className="truncate font-bold text-fg">{m.name}</p><p className="text-small text-fg-muted">{m.member_number}</p></div> },
  { key: "phone", header: "No. HP", render: (m) => m.phone ?? "-" },
  { key: "address", header: "Alamat", className: "max-md:hidden", render: (m) => <span className="line-clamp-1">{m.address ?? "-"}</span> },
  { key: "loans", header: "Pinjaman aktif", align: "right", render: (m) => (m.active_loans > 0 ? <Check size={16} strokeWidth={2} className="ml-auto text-fg" aria-label="Punya pinjaman aktif" /> : <X size={16} strokeWidth={2} className="ml-auto text-warn-text" aria-label="Tidak ada pinjaman aktif" />) },
  { key: "arrears", header: "Tunggakan", align: "right", render: (m) => (m.arrears_amount > 0 ? <span className="font-bold text-warn-text">{rupiah(m.arrears_amount)}</span> : "-") },
];

function DataAnggotaPage() {
  const router = useRouter();
  const { can } = useSession();
  const [cari, setCari] = useState("");
  const q = useDebounced(cari);
  const hash = useHash();
  const [toastTutup, setToastTutup] = useState(false);
  const tab = hash === "pelunasan" ? "pelunasan" : hash === "lunas" ? "lunas" : "daftar"; // tab di hash agar tombol kembali dari kwitansi membuka tab Pelunasan
  const { data, meta, error, loading, reload } = useApi<Anggota[], { total: number }>(tab === "pelunasan" ? null : `/api/v1/petugas/anggota${qs({ q, limit: 100, status: tab === "lunas" ? "lunas" : "berjalan" })}`);
  return (
    <>
      <PageHeader
        title="Data Anggota"
        subtitle={tab === "pelunasan" ? "Terima pelunasan tunai dari anggota yang Anda pegang" : tab === "lunas" ? "Anggota yang semua pinjamannya sudah lunas" : "Anggota yang Anda pegang"}
        actions={tab === "daftar" && can("my_tasks", "create") && (
          <Button size="lg" aria-label="Tambah Anggota" onClick={() => router.push("/petugas/anggota/baru")}><Plus size={16} strokeWidth={1.5} /><span className="max-lg:hidden">Tambah Anggota</span></Button>
        )}
      />
      <Toast
        message={toastTutup ? null : hash === "dibuat" ? "Anggota berhasil ditambahkan" : hash === "dibuat-pengajuan" ? "Anggota ditambahkan; pinjaman menunggu persetujuan Owner" : null}
        onClose={() => setToastTutup(true)}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="mb-4 lg:mb-6">
        <ChipGroup<string>
          value={tab}
          onChange={(v) => { window.location.hash = v; }}
          options={[{ value: "daftar", label: "Daftar Anggota" }, { value: "lunas", label: "Lunas" }, { value: "pelunasan", label: "Pelunasan" }]}
        />
      </div>
      {tab === "pelunasan" ? <PelunasanPanel /> : (
      <div className="flex flex-col gap-4 lg:gap-6">
        <SearchInput value={cari} onChange={setCari} placeholder="Cari nama, no. anggota, NIK, atau no. HP" />
        {loading && !data ? (
          <Skeleton className="h-64" />
        ) : data && (
          <Card title={`${meta?.total ?? data.length} anggota`}>
            <Table columns={KOLOM} rows={data} rowKey={(m) => m.id} empty={cari ? "Anggota tidak ditemukan" : tab === "lunas" ? "Belum ada anggota yang pinjamannya lunas" : "Belum ada anggota dengan pinjaman berjalan"} />
          </Card>
        )}
      </div>
      )}
    </>
  );
}

export default withFreshState(DataAnggotaPage, { module: "my_tasks" });
