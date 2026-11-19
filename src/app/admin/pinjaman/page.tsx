"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, KolBadge, type Kolektibilitas } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Modal, Skeleton, Toast } from "@/components/ui/Feedback";
import { Field, Input, SearchInput, Select } from "@/components/ui/Form";
import { CellStack, Pager, Table } from "@/components/ui/Table";
import { api, ApiError, qs, useApi, useDebounced, useHash } from "@/lib/api";
import { angka, isoHariIni, rupiah, rupiahRingkas, tanggal, tanggalPendek } from "@/lib/format";

type Pinjaman = {
  id: number; no_pinjaman: string; anggota_nama: string; wilayah: string; plafon: number; tenor: number; angsuran: number;
  jatuh_tempo_berikut: string | null; sisa: number; angsuran_lunas: number; hari_telat: number; kolektibilitas: Kolektibilitas;
};
type Meta = { page: number; limit: number; total: number; outstanding: number; semua: number; kolektibilitas: Record<Kolektibilitas, number> };
const KOL: Kolektibilitas[] = ["Lancar", "DPK", "Kurang Lancar", "Diragukan", "Macet"];

export default function PinjamanPage() {
  const [kol, setKol] = useState<Kolektibilitas | null>(null);
  const [cari, setCari] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<number | null>(null);
  const [baru, setBaru] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const q = useDebounced(cari);
  const { data, meta, error, loading, reload } = useApi<Pinjaman[], Meta>(`/api/v1/pinjaman${qs({ kolektibilitas: kol, q, page, limit: 10 })}`);
  // tautan dari dashboard: /admin/pinjaman#baru membuka form
  const hash = useHash();
  const [hashDitutup, setHashDitutup] = useState(false);
  const formTerbuka = baru || (hash === "baru" && !hashDitutup);
  const tutupForm = () => {
    setBaru(false);
    setHashDitutup(true);
  };

  return (
    <>
      <PageHeader
        title="Data Pinjaman"
        subtitle={meta ? `${angka(meta.semua)} pinjaman aktif  ·  outstanding ${rupiahRingkas(meta.outstanding)}` : "Memuat…"}
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => window.open(`/api/v1/pinjaman${qs({ kolektibilitas: kol, q, limit: 100 })}`, "_blank")}>Ekspor JSON</Button>
            <Button size="lg" onClick={() => setBaru(true)}>+ Pinjaman Baru</Button>
          </>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-4">
        <ChipGroup
          value={kol}
          onChange={(v) => { setKol(v); setPage(1); }}
          options={[{ value: null, label: `Semua  ${meta ? angka(meta.semua) : ""}` }, ...KOL.map((k) => ({ value: k as Kolektibilitas | null, label: `${k}  ${meta ? angka(meta.kolektibilitas[k]) : ""}` }))]}
        />
        <SearchInput value={cari} onChange={(v) => { setCari(v); setPage(1); }} placeholder="Cari no. pinjaman / anggota" className="w-[280px]" />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <Skeleton className="h-[600px]" />
        ) : (
          <>
            <Table
              rows={data ?? []}
              rowKey={(r) => r.id}
              rowHeight="h-[62px]"
              onRowClick={(r) => setDetail(r.id)}
              columns={[
                { key: "no", header: "No. Pinjaman", render: (r) => <span className="font-medium">{r.no_pinjaman}</span> },
                { key: "ag", header: "Anggota", render: (r) => <CellStack title={r.anggota_nama} sub={r.wilayah} /> },
                { key: "pl", header: "Plafon", render: (r) => rupiah(r.plafon) },
                { key: "tn", header: "Tenor", render: (r) => `${r.tenor} bln` },
                { key: "an", header: "Angsuran/bln", render: (r) => rupiah(r.angsuran) },
                { key: "jt", header: "Jatuh Tempo", render: (r) => (r.jatuh_tempo_berikut ? <span className={r.hari_telat > 0 ? "font-bold text-warn-text" : ""}>{tanggalPendek(r.jatuh_tempo_berikut)}</span> : "—") },
                { key: "si", header: "Sisa Pinjaman", render: (r) => <b>{rupiah(r.sisa)}</b> },
                { key: "kl", header: "Kolektibilitas", render: (r) => <KolBadge value={r.kolektibilitas} /> },
                { key: "ak", header: "", render: () => <span className="font-bold text-warn-text">Detail →</span> },
              ]}
            />
            {meta && <Pager page={page} total={meta.total} limit={meta.limit} onPage={setPage} label="pinjaman" />}
          </>
        )}
      </Card>
      <DetailPinjaman id={detail} onClose={() => setDetail(null)} />
      <PinjamanBaru
        open={formTerbuka}
        onClose={tutupForm}
        onSaved={(msg) => {
          tutupForm();
          setToast(msg);
          reload();
        }}
      />
      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  );
}

type Detail = Pinjaman & { tujuan: string | null; jaminan: string | null; tanggal_cair: string | null; no_anggota: string; tunggakan: number; jasa_persen: number;
  jadwal: { id: number; ke: number; jatuh_tempo: string; total: number; status: "belum" | "menunggu_verifikasi" | "lunas"; dibayar_pada: string | null }[] };

function DetailPinjaman({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: d, loading } = useApi<Detail>(id ? `/api/v1/pinjaman/${id}` : null);
  return (
    <Modal open={!!id} title={d ? `${d.no_pinjaman} · ${d.anggota_nama}` : "Detail pinjaman"} onClose={onClose}>
      {loading || !d ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 rounded-ctl bg-canvas p-4">
            {[["Plafon", rupiah(d.plafon)], ["Tenor", `${d.tenor} bulan`], ["Angsuran", rupiah(d.angsuran)], ["Jasa", `${d.jasa_persen}%/bln`], ["Sisa", rupiah(d.sisa)], ["Kolektibilitas", <KolBadge key="k" value={d.kolektibilitas} />]].map(([l, v]) => (
              <div key={String(l)}>
                <div className="text-small text-fg-muted">{l}</div>
                <div className="mt-1 text-body font-bold">{v}</div>
              </div>
            ))}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            <Table
              rows={d.jadwal}
              rowKey={(r) => r.id}
              rowHeight="h-11"
              columns={[
                { key: "k", header: "Ke-", render: (r) => r.ke },
                { key: "t", header: "Jatuh tempo", render: (r) => tanggal(r.jatuh_tempo) },
                { key: "n", header: "Nominal", render: (r) => rupiah(r.total) },
                { key: "s", header: "Status", render: (r) => r.status === "lunas" ? <Badge tone="sudah-bayar">Lunas</Badge> : r.status === "menunggu_verifikasi" ? <Badge tone="warn-outline">Menunggu verifikasi</Badge> : r.jatuh_tempo < isoHariIni() ? <Badge tone="telat">Telat</Badge> : <Badge tone="belum-bayar">Belum</Badge> },
              ]}
            />
          </div>
        </>
      )}
    </Modal>
  );
}

type AnggotaOpsi = { id: number; nama: string; no_anggota: string; wilayah: string };

function PinjamanBaru({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const { data: anggota } = useApi<AnggotaOpsi[]>(open ? "/api/v1/anggota?limit=100" : null);
  const [f, setF] = useState({ anggota_id: "", plafon: "10000000", tenor: "12", tujuan: "", jaminan: "", tanggal_cair: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const plafon = Number(f.plafon) || 0, tenor = Number(f.tenor) || 1;
  const angsuran = Math.round(plafon / tenor) + Math.round(plafon * 0.015);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function simpan() {
    setErr(null);
    if (!f.anggota_id) return setErr("Pilih anggota");
    setSaving(true);
    try {
      const r = await api.post<{ no_pinjaman: string; status: string }>("/api/v1/pinjaman", {
        anggota_id: Number(f.anggota_id), plafon, tenor, tujuan: f.tujuan, jaminan: f.jaminan || undefined, tanggal_cair: f.tanggal_cair || isoHariIni(),
      });
      onSaved(r.data.status === "pengajuan" ? `${r.data.no_pinjaman} diajukan ke Owner (di atas Rp 20 jt)` : `${r.data.no_pinjaman} dibuat · jadwal angsuran dibuat otomatis`);
      setF({ anggota_id: "", plafon: "10000000", tenor: "12", tujuan: "", jaminan: "", tanggal_cair: "" });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Pinjaman Baru"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={simpan} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Pinjaman"}</Button>
        </>
      }
    >
      <Field label="Anggota">
        <Select value={f.anggota_id} onChange={set("anggota_id")}>
          <option value="">Pilih anggota…</option>
          {anggota?.map((a) => <option key={a.id} value={a.id}>{a.nama} · {a.no_anggota} · {a.wilayah}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Plafon (Rp)"><Input type="number" min={500000} step={100000} value={f.plafon} onChange={set("plafon")} /></Field>
        <Field label="Tenor (bulan)">
          <Select value={f.tenor} onChange={set("tenor")}>{[6, 10, 12, 18, 24, 36].map((t) => <option key={t} value={t}>{t}</option>)}</Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tujuan"><Input value={f.tujuan} onChange={set("tujuan")} placeholder="Modal usaha" /></Field>
        <Field label="Tanggal cair (kosong = hari ini)"><Input type="date" value={f.tanggal_cair} onChange={set("tanggal_cair")} /></Field>
      </div>
      <Field label="Jaminan (opsional)"><Input value={f.jaminan} onChange={set("jaminan")} placeholder="BPKB motor" /></Field>
      <div className="rounded-ctl bg-inverse p-4">
        <div className="text-caption font-bold tracking-[1px] text-accent">SIMULASI ANGSURAN</div>
        <div className="mt-1 text-mobile font-bold text-fg-inverse">{rupiah(angsuran)} / bulan</div>
        <div className="mt-1 text-small text-fg-inverse-muted">Jasa 1,5%/bln flat · total kembali {rupiah(angsuran * tenor)}{plafon > 20_000_000 ? " · perlu persetujuan Owner" : ""}</div>
      </div>
      {err && <span className="text-small font-medium text-warn-text">{err}</span>}
    </Modal>
  );
}
