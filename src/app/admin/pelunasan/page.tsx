"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Modal, Skeleton, Toast } from "@/components/ui/Feedback";
import { Field, SearchInput, Textarea } from "@/components/ui/Form";
import { CellStack, Pager, Table } from "@/components/ui/Table";
import { api, ApiError, qs, useApi, useDebounced } from "@/lib/api";
import { angka, rupiah, rupiahRingkas, tanggal } from "@/lib/format";
import { useSession } from "@/lib/session";

type Status = "menunggu" | "disetujui" | "menunggu_verifikasi" | "terverifikasi" | "ditolak" | "dibatalkan";
type Deposit = "belum_disetor" | "setoran_menunggu" | "setoran_ditolak" | "setoran_diterima" | null;
type Row = {
  id: number; loan_number: string; member_name: string; member_number: string; amount: number; installments_count: number; method: "transfer" | "tunai"; source: "anggota" | "petugas";
  status: Status; requested_at: string; notes: string | null; receipt_code: string | null; has_proof: boolean; collector_name: string | null; deposit_state: Deposit;
};
type Meta = { page: number; limit: number; total: number; summary: { to_approve: number; to_verify: number; to_verify_amount: number; verified_today: number } };
type Aksi = { row: Row; mode: "approve" | "reject" | "verify" };

const LABEL: Record<Status, string> = { menunggu: "Menunggu Persetujuan", disetujui: "Disetujui", menunggu_verifikasi: "Menunggu Verifikasi", terverifikasi: "Terverifikasi", ditolak: "Ditolak", dibatalkan: "Dibatalkan" };
const TONE: Record<Status, BadgeTone> = { menunggu: "warn-outline", disetujui: "belum-bayar", menunggu_verifikasi: "warn-outline", terverifikasi: "sudah-bayar", ditolak: "telat", dibatalkan: "belum-bayar" };
const SETORAN: Record<Exclude<Deposit, null>, string> = { belum_disetor: "Uang tunai belum disetor petugas", setoran_menunggu: "Setoran menunggu diterima", setoran_ditolak: "Setoran ditolak", setoran_diterima: "Setoran diterima" };

/** Alasan verifikasi belum bisa dilakukan (sama dengan aturan server). */
function blokVerifikasi(r: Row): string | null {
  if (r.method === "transfer") return r.has_proof ? null : "Bukti transfer belum diunggah";
  if (r.deposit_state === "belum_disetor") return SETORAN.belum_disetor;
  if (r.deposit_state === "setoran_menunggu") return "Setoran petugas belum diterima";
  if (r.deposit_state === "setoran_ditolak") return SETORAN.setoran_ditolak;
  return null;
}

function PelunasanPage() {
  const { can } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [cari, setCari] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(cari);
  const { data, meta, error, loading, reload } = useApi<Row[], Meta>(`/api/v1/pelunasan${qs({ status, q, page, limit: 10 })}`);
  const [aksi, setAksi] = useState<Aksi | null>(null);
  const [alasan, setAlasan] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const s = meta?.summary;
  const bisaUbah = can("payments", "update");

  async function putuskan() {
    if (!aksi) return;
    if (aksi.mode === "reject" && !alasan.trim()) return setToast({ m: "Alasan penolakan wajib diisi", t: "warn" });
    setBusy(true);
    try {
      await api.post(`/api/v1/pelunasan/${aksi.row.id}`, { action: aksi.mode, notes: alasan.trim() || undefined });
      setToast({ m: aksi.mode === "approve" ? "Pengajuan disetujui · anggota bisa membayar" : aksi.mode === "verify" ? "Pelunasan terverifikasi · pinjaman lunas" : "Pengajuan pelunasan ditolak", t: "ok" });
      setAksi(null);
      setAlasan("");
      reload();
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal memproses pelunasan", t: "warn" });
    } finally {
      setBusy(false);
    }
  }
  const buka = (row: Row, mode: Aksi["mode"]) => { setAlasan(""); setAksi({ row, mode }); };

  return (
    <>
      <PageHeader title="Pelunasan Dipercepat" subtitle="Setujui pengajuan anggota dan verifikasi pembayaran pelunasan (transfer / tunai)" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 xl:gap-6">
        <StatCard tone="accent" label="Menunggu Persetujuan" value={s ? angka(s.to_approve) : "…"} note="pengajuan anggota" />
        <StatCard inverse label="Menunggu Verifikasi" value={s ? angka(s.to_verify) : "…"} note={s ? `${rupiahRingkas(s.to_verify_amount)} pembayaran masuk` : undefined} />
        <StatCard label="Terverifikasi Hari Ini" value={s ? rupiahRingkas(s.verified_today) : "…"} />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <ChipGroup
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: null as Status | null, label: "Semua" }, ...(Object.keys(LABEL) as Status[]).map((k) => ({ value: k as Status | null, label: LABEL[k] }))]}
        />
        <SearchInput value={cari} onChange={(v) => { setCari(v); setPage(1); }} placeholder="Cari anggota / no. pinjaman / kode bukti" className="w-[320px]" />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <Skeleton className="h-[320px]" />
        ) : (
          <>
            <Table
              rows={data ?? []}
              rowKey={(r) => r.id}
              rowHeight="h-[72px]"
              empty="Tidak ada pengajuan pelunasan"
              columns={[
                { key: "t", header: "Diajukan", render: (r) => tanggal(r.requested_at) },
                { key: "m", header: "Anggota", render: (r) => <CellStack title={r.member_name} sub={`${r.member_number} · ${r.loan_number}`} /> },
                { key: "a", header: "Nominal", render: (r) => <CellStack title={rupiah(r.amount)} sub={`${r.installments_count} angsuran`} /> },
                {
                  key: "c", header: "Pembayaran",
                  render: (r) => (
                    <CellStack
                      title={r.method === "transfer" ? "Transfer" : "Tunai"}
                      sub={r.method === "tunai" ? [r.source === "petugas" ? "Langsung oleh petugas" : "Pengajuan anggota", r.collector_name, r.receipt_code].filter(Boolean).join(" · ") : r.has_proof ? "Bukti terkirim" : "Belum ada bukti"}
                    />
                  ),
                },
                {
                  key: "s", header: "Status",
                  render: (r) => (
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                      {r.status === "menunggu_verifikasi" && r.method === "tunai" && r.deposit_state && <span className="text-small text-fg-muted">{SETORAN[r.deposit_state]}</span>}
                      {r.notes && ["ditolak", "disetujui"].includes(r.status) && <span className="text-small text-fg-muted">{r.notes}</span>}
                    </div>
                  ),
                },
                {
                  key: "ak", header: "", align: "right",
                  render: (r) => {
                    if (!bisaUbah) return null;
                    if (r.status === "menunggu") return (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => buka(r, "reject")}>Tolak</Button>
                        <Button size="sm" variant="accent" onClick={() => buka(r, "approve")}>Setujui</Button>
                      </div>
                    );
                    if (r.status === "menunggu_verifikasi") return (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => buka(r, "reject")}>Tolak</Button>
                        <Button size="sm" variant="accent" onClick={() => buka(r, "verify")}>Verifikasi</Button>
                      </div>
                    );
                    if (r.status === "disetujui") return <Button size="sm" variant="outline" onClick={() => buka(r, "reject")}>Tolak</Button>;
                    return null;
                  },
                },
              ]}
            />
            {meta && <Pager page={page} total={meta.total} limit={meta.limit} onPage={setPage} label="pengajuan" />}
          </>
        )}
      </Card>
      <Modal
        open={!!aksi}
        wide={aksi?.mode === "verify" && aksi.row.method === "transfer"}
        title={aksi?.mode === "approve" ? "Setujui pelunasan?" : aksi?.mode === "verify" ? "Verifikasi pelunasan?" : "Tolak pengajuan pelunasan?"}
        onClose={() => setAksi(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setAksi(null)}>Batal</Button>
            <Button variant="accent" disabled={busy || (aksi?.mode === "verify" && !!blokVerifikasi(aksi.row))} onClick={putuskan}>
              {aksi?.mode === "approve" ? "Ya, setujui" : aksi?.mode === "verify" ? "Ya, verifikasi" : "Ya, tolak"}
            </Button>
          </>
        }
      >
        {aksi && (
          <>
            <p className="text-body text-fg-muted">
              {aksi.row.member_name} · {aksi.row.loan_number} · <b className="text-fg">{rupiah(aksi.row.amount)}</b> ({aksi.row.installments_count} angsuran) · {aksi.row.method === "transfer" ? "Transfer" : "Tunai"}.
            </p>
            {aksi.mode === "approve" && (
              <p className="text-body text-fg-muted">
                {aksi.row.method === "transfer"
                  ? "Anggota akan diminta transfer ke rekening koperasi dan mengunggah bukti transfer."
                  : "Anggota akan menyerahkan uang tunai ke petugas wilayahnya; petugas menerima, mencetak kwitansi, lalu menyetor ke kasir."}
              </p>
            )}
            {aksi.mode === "verify" && (
              <>
                {blokVerifikasi(aksi.row) && <p className="text-body font-bold text-warn-text">{blokVerifikasi(aksi.row)}.</p>}
                {aksi.row.method === "transfer" && aksi.row.has_proof && (
                  // eslint-disable-next-line @next/next/no-img-element -- bukti dari API berlogin, bukan aset statis
                  <img src={`/api/v1/pelunasan/${aksi.row.id}/bukti`} alt="Bukti transfer" className="max-h-[420px] w-full rounded-ctl border border-line object-contain" />
                )}
                <p className="text-body text-fg-muted">
                  {aksi.row.method === "transfer" ? "Pastikan uang sudah masuk ke rekening koperasi dan sesuai bukti." : `Uang tunai diterima petugas ${aksi.row.collector_name ?? ""} (kode ${aksi.row.receipt_code ?? "-"}) dan setorannya sudah diterima.`}{" "}
                  Semua angsuran tersisa akan ditandai lunas dan pinjaman berstatus lunas.
                </p>
              </>
            )}
            {aksi.mode === "reject" && <Field label="Alasan penolakan" wajib><Textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Mis. transfer belum diterima / bukti tidak sesuai" /></Field>}
          </>
        )}
      </Modal>
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}

export default withFreshState(PelunasanPage, { module: "payments" });
