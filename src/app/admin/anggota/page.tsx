"use client";
import { Eye } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, avatarTone } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { SearchInput } from "@/components/ui/Form";
import { CellStack, Pager, Table } from "@/components/ui/Table";
import { qs, useApi, useDebounced, useHash } from "@/lib/api";
import { angka, bulanTahun, rupiahRingkas } from "@/lib/format";

type Member = { id: number; member_number: string; name: string; phone: string; joined_on: string; region_name: string; total_savings: number; active_loans: number; remaining_balance: number; status_label: "Aktif" | "Menunggak" | "Baru" | "Nonaktif" };
type Meta = { page: number; limit: number; total: number; stats: { total: number; new_this_month: number; borrowing: number; in_arrears: number; total_savings: number } };
type Region = { id: number; name: string };
const STATUS_TONE: Record<Member["status_label"], BadgeTone> = { Aktif: "belum-bayar", Menunggak: "telat", Baru: "dpk", Nonaktif: "warn-outline" };

export default function AnggotaPage() {
  const [wil, setWil] = useState<number | null>(null);
  const [cari, setCari] = useState("");
  const [page, setPage] = useState(1);
  // setelah menghapus anggota di halaman detail, daftar dibuka dengan #dihapus
  const hash = useHash();
  const [toastTutup, setToastTutup] = useState(false);
  const q = useDebounced(cari);
  const { data: regions } = useApi<Region[]>("/api/v1/wilayah");
  const { data, meta, error, loading, reload } = useApi<Member[], Meta>(`/api/v1/anggota${qs({ region_id: wil, q, page, limit: 9 })}`);
  const s = meta?.stats;

  return (
    <>
      <PageHeader
        title="Data Anggota"
        subtitle={s ? `${angka(s.total)} anggota terdaftar  ·  ${regions?.length ?? 0} wilayah layanan` : "Memuat…"}
        actions={<Link href="/admin/anggota/baru" className={buttonClass("primary", "lg")}>+ Anggota Baru</Link>}
      />
      <div className="mb-6 grid grid-cols-3 gap-6">
        <StatCard tone="accent" label="Total Anggota" value={s ? angka(s.total) : "…"} note={s ? `▲ ${s.new_this_month} anggota baru bulan ini` : undefined} />
        <StatCard inverse label="Aktif Meminjam" value={s ? angka(s.borrowing) : "…"} note={s && s.total ? `${Math.round((s.borrowing / s.total) * 100)}% dari total anggota` : undefined} />
        <StatCard tone="warn" label="Sedang Menunggak" value={s ? angka(s.in_arrears) : "…"} note="perlu penagihan lanjutan" />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <ChipGroup value={wil} onChange={(v) => { setWil(v); setPage(1); }} options={[{ value: null, label: "Semua" }, ...(regions ?? []).map((w) => ({ value: w.id as number | null, label: w.name }))]} />
          <SearchInput value={cari} onChange={(v) => { setCari(v); setPage(1); }} placeholder="Cari nama / no. anggota / HP" className="w-[280px]" />
        </div>
        {loading && !data ? (
          <Skeleton className="h-[540px]" />
        ) : (
          <>
            <Table
              rows={data ?? []}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "d",
                  header: "Detail",
                  className: "w-[64px]",
                  render: (r) => (
                    <Link href={`/admin/anggota/${r.id}`} aria-label={`Lihat detail ${r.name}`} title="Lihat detail" className="inline-flex size-8 items-center justify-center rounded-chip border border-line text-fg-muted hover:border-fg hover:text-fg">
                      <Eye size={16} strokeWidth={1.5} />
                    </Link>
                  ),
                },
                { key: "a", header: "Anggota", render: (r, i) => <CellStack avatar={<Avatar name={r.name} size={32} tone={avatarTone(i)} />} title={r.name} sub={r.member_number} /> },
                { key: "h", header: "No. HP", render: (r) => r.phone },
                { key: "w", header: "Wilayah", render: (r) => r.region_name },
                { key: "b", header: "Bergabung", render: (r) => bulanTahun(r.joined_on) },
                { key: "p", header: "Pinjaman Aktif", render: (r) => <b>{r.active_loans ? rupiahRingkas(r.remaining_balance) : "—"}</b> },
                { key: "st", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status_label]}>{r.status_label}</Badge> },
              ]}
            />
            {meta && <Pager page={page} total={meta.total} limit={meta.limit} onPage={setPage} label="anggota" />}
          </>
        )}
      </Card>
      <Toast message={hash === "dihapus" && !toastTutup ? "Anggota berhasil dihapus" : null} onClose={() => setToastTutup(true)} />
    </>
  );
}
