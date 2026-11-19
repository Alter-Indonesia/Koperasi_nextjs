"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, avatarTone } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Modal, Skeleton, Toast } from "@/components/ui/Feedback";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/Form";
import { CellStack, Pager, Table } from "@/components/ui/Table";
import { api, ApiError, qs, useApi, useDebounced } from "@/lib/api";
import { angka, bulanTahun, rupiah, rupiahRingkas } from "@/lib/format";

type Anggota = { id: number; no_anggota: string; nama: string; no_hp: string; bergabung: string; wilayah: string; simpanan: number; pinjaman_aktif: number; sisa_pinjaman: number; status_label: "Aktif" | "Menunggak" | "Baru" | "Nonaktif" };
type Meta = { page: number; limit: number; total: number; statistik: { total: number; baru: number; meminjam: number; menunggak: number; simpanan: number } };
type Wilayah = { id: number; nama: string };
const STATUS_TONE: Record<Anggota["status_label"], BadgeTone> = { Aktif: "belum-bayar", Menunggak: "telat", Baru: "dpk", Nonaktif: "warn-outline" };

export default function AnggotaPage() {
  const [wil, setWil] = useState<number | null>(null);
  const [cari, setCari] = useState("");
  const [page, setPage] = useState(1);
  const [baru, setBaru] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const q = useDebounced(cari);
  const { data: wilayah } = useApi<Wilayah[]>("/api/v1/wilayah");
  const { data, meta, error, loading, reload } = useApi<Anggota[], Meta>(`/api/v1/anggota${qs({ wilayah_id: wil, q, page, limit: 9 })}`);
  const s = meta?.statistik;

  return (
    <>
      <PageHeader
        title="Data Anggota"
        subtitle={s ? `${angka(s.total)} anggota terdaftar  ·  ${wilayah?.length ?? 0} wilayah layanan` : "Memuat…"}
        actions={<Button size="lg" onClick={() => setBaru(true)}>+ Anggota Baru</Button>}
      />
      <div className="mb-6 grid grid-cols-4 gap-6">
        <StatCard label="Total Anggota" value={s ? angka(s.total) : "…"} note={s ? `▲ ${s.baru} anggota baru bulan ini` : undefined} />
        <StatCard label="Aktif Meminjam" value={s ? angka(s.meminjam) : "…"} note={s && s.total ? `${Math.round((s.meminjam / s.total) * 100)}% dari total anggota` : undefined} />
        <StatCard inverse label="Sedang Menunggak" value={s ? angka(s.menunggak) : "…"} note="perlu penagihan lanjutan" />
        <StatCard label="Total Simpanan" value={s ? rupiahRingkas(s.simpanan) : "…"} note="pokok + wajib + sukarela" />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <ChipGroup value={wil} onChange={(v) => { setWil(v); setPage(1); }} options={[{ value: null, label: "Semua" }, ...(wilayah ?? []).map((w) => ({ value: w.id as number | null, label: w.nama }))]} />
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
                { key: "a", header: "Anggota", render: (r, i) => <CellStack avatar={<Avatar name={r.nama} size={32} tone={avatarTone(i)} />} title={r.nama} sub={r.no_anggota} /> },
                { key: "h", header: "No. HP", render: (r) => r.no_hp },
                { key: "w", header: "Wilayah", render: (r) => r.wilayah },
                { key: "b", header: "Bergabung", render: (r) => bulanTahun(r.bergabung) },
                { key: "s", header: "Simpanan", render: (r) => rupiah(r.simpanan) },
                { key: "p", header: "Pinjaman Aktif", render: (r) => <b>{r.pinjaman_aktif ? rupiahRingkas(r.sisa_pinjaman) : "—"}</b> },
                { key: "st", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status_label]}>{r.status_label}</Badge> },
              ]}
            />
            {meta && <Pager page={page} total={meta.total} limit={meta.limit} onPage={setPage} label="anggota" />}
          </>
        )}
      </Card>
      <AnggotaBaru open={baru} wilayah={wilayah ?? []} onClose={() => setBaru(false)} onSaved={(m) => { setBaru(false); setToast(m); reload(); }} />
      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  );
}

function AnggotaBaru({ open, wilayah, onClose, onSaved }: { open: boolean; wilayah: Wilayah[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [f, setF] = useState({ nama: "", no_hp: "", alamat: "", wilayah_id: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function simpan() {
    setErr(null);
    setSaving(true);
    try {
      const r = await api.post<{ no_anggota: string; nama: string }>("/api/v1/anggota", { ...f, wilayah_id: Number(f.wilayah_id) });
      onSaved(`${r.data.nama} terdaftar sebagai ${r.data.no_anggota}`);
      setF({ nama: "", no_hp: "", alamat: "", wilayah_id: "" });
    } catch (e) {
      setErr(e instanceof ApiError ? (e.details ? "Periksa kembali isian: nama, no. HP, alamat, dan wilayah wajib diisi" : e.message) : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} title="Anggota Baru" onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={simpan} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Anggota"}</Button></>}>
      <Field label="Nama lengkap"><Input value={f.nama} onChange={set("nama")} placeholder="Siti Aminah" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="No. HP"><Input value={f.no_hp} onChange={set("no_hp")} placeholder="0812-xxxx-xxxx" /></Field>
        <Field label="Wilayah">
          <Select value={f.wilayah_id} onChange={set("wilayah_id")}>
            <option value="">Pilih…</option>
            {wilayah.map((w) => <option key={w.id} value={w.id}>{w.nama}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Alamat"><Textarea value={f.alamat} onChange={set("alamat")} placeholder="Jl. Cikutra No. 12, RT 03/05" /></Field>
      <p className="text-small text-fg-subtle">Simpanan pokok Rp 100.000 dicatat saat pendaftaran.</p>
      {err && <span className="text-small font-medium text-warn-text">{err}</span>}
    </Modal>
  );
}
