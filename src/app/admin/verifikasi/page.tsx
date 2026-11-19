"use client";
import { FileImage, MapPin } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, avatarTone } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { Textarea } from "@/components/ui/Form";
import { cx } from "@/components/ui/cx";
import { api, ApiError, umumkanPembayaranBerubah, useApi, useHash } from "@/lib/api";
import { jam, rupiah, tanggalPanjang } from "@/lib/format";

type Status = "menunggu" | "terverifikasi" | "ditolak";
type Item = { id: number; nominal: number; metode: string; keterangan_metode: string | null; dibayar_pada: string; anggota: string; no_pinjaman: string; ke: number; tenor: number; petugas: string | null; status: Status };
type Meta = { jumlah: Record<Status, number> };
type Detail = {
  id: number; nominal: number; denda: number; metode: string; keterangan_metode: string | null; dibayar_pada: string; foto_bukti: string | null; lokasi: string | null; lat: number | null; lng: number | null;
  catatan: string | null; status: Status; catatan_verifikasi: string | null; diverifikasi_pada: string | null; ke: number; tagihan: number; tenor: number; no_pinjaman: string; anggota: string; alamat: string; wilayah: string;
  petugas: string | null; verifikator: string | null; sisa_sebelum: number; sisa_sesudah: number;
};
const METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS" };

export default function VerifikasiPage() {
  const [status, setStatus] = useState<Status>("menunggu");
  const [pilih, setPilih] = useState<number | null>(null);
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const list = useApi<Item[], Meta>(`/api/v1/pembayaran?status=${status}`);
  const hash = Number(useHash()) || null;
  const aktif = pilih ?? (hash && list.data?.some((x) => x.id === hash) ? hash : list.data?.[0]?.id ?? null);
  const detail = useApi<Detail>(aktif ? `/api/v1/pembayaran/${aktif}` : null);
  const pilihItem = (id: number | null) => {
    setPilih(id);
    setCatatan("");
  };

  async function proses(aksi: "verifikasi" | "tolak") {
    if (!aktif) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/pembayaran/${aktif}/verifikasi`, { aksi, catatan: catatan || undefined });
      setToast({ m: aksi === "verifikasi" ? "Pembayaran terverifikasi · saldo pinjaman diperbarui" : "Pembayaran ditolak · angsuran masuk penagihan ulang", t: aksi === "verifikasi" ? "ok" : "warn" });
      pilihItem(null);
      if (hash) history.replaceState(null, "", window.location.pathname);
      list.reload();
      umumkanPembayaranBerubah();
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal memproses", t: "warn" });
    } finally {
      setBusy(false);
    }
  }

  const j = list.meta?.jumlah;
  const d = detail.data;
  return (
    <>
      <PageHeader
        title="Verifikasi Pembayaran"
        subtitle="Periksa bukti, lalu perbarui saldo atau tagih ulang"
        actions={
          <ChipGroup
            value={status}
            onChange={(s) => { setStatus(s); pilihItem(null); }}
            options={[{ value: "menunggu", label: `Menunggu  ${j?.menunggu ?? ""}` }, { value: "terverifikasi", label: `Terverifikasi hari ini  ${j?.terverifikasi ?? ""}` }, { value: "ditolak", label: `Ditolak hari ini  ${j?.ditolak ?? ""}` }]}
          />
        }
      />
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      <div className="grid grid-cols-[420px_1fr] gap-6">
        <section className="rounded-card bg-card p-3">
          <div className="flex items-center justify-between px-2 pt-2 pb-3">
            <h2 className="text-title font-bold">Antrean ({list.data?.length ?? 0})</h2>
            <span className="text-small font-bold text-fg-muted">Terlama dulu</span>
          </div>
          {list.loading && !list.data && <Skeleton className="h-96" />}
          {list.data?.length === 0 && <p className="px-2 py-10 text-center text-body-sm text-fg-subtle">Tidak ada pembayaran di daftar ini</p>}
          <ul className="flex flex-col gap-1">
            {list.data?.map((it, i) => (
              <li key={it.id}>
                <button
                  onClick={() => pilihItem(it.id)}
                  className={cx("flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 py-3 text-left", it.id === aktif ? "border-2 border-accent" : "border-2 border-transparent hover:bg-canvas")}
                >
                  <Avatar name={it.anggota} size={36} tone={avatarTone(i)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-bold">{it.anggota}</div>
                    <div className="truncate text-small text-fg-subtle">
                      {METODE[it.metode]}{it.petugas ? ` · via ${it.petugas.split(" ")[0]}` : it.keterangan_metode ? ` · ${it.keterangan_metode.replace("Transfer ", "")}` : ""} · {jam(it.dibayar_pada)}
                    </div>
                  </div>
                  <b className="text-body-sm">{rupiah(it.nominal)}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-card bg-card p-6">
          {!aktif && !list.loading && <p className="py-20 text-center text-body text-fg-subtle">Pilih pembayaran di antrean</p>}
          {aktif && !d && <Skeleton className="h-[600px]" />}
          {d && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-mobile font-bold">{d.anggota}</h2>
                  <p className="mt-1 text-body-sm text-fg-muted">{d.no_pinjaman}  ·  Angsuran ke-{d.ke} dari {d.tenor}  ·  Wil. {d.wilayah}</p>
                </div>
                {d.status === "menunggu" ? <Badge tone="warn-outline" className="px-3 py-1.5 text-small">Menunggu verifikasi</Badge> : d.status === "terverifikasi" ? <Badge tone="sudah-bayar">Terverifikasi</Badge> : <Badge tone="telat">Ditolak</Badge>}
              </div>
              <div className="mt-6 grid grid-cols-[300px_1fr] gap-6">
                <div>
                  <div className="flex h-[360px] flex-col items-center justify-center gap-3 rounded-[12px] bg-line-subtle text-fg-muted">
                    <FileImage size={40} strokeWidth={1.5} />
                    <span className="text-body-sm font-bold">{d.foto_bukti ?? "Tidak ada foto"}</span>
                    <span className="text-small">Pratinjau foto bukti</span>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-caption text-fg-subtle">
                    <MapPin size={12} strokeWidth={1.5} />
                    {tanggalPanjang(d.dibayar_pada)}, {jam(d.dibayar_pada)}{d.lat ? ` · GPS ${d.lat}, ${d.lng}` : ""}
                  </p>
                </div>
                <dl className="flex flex-col gap-4">
                  {[
                    ["Nominal diterima", rupiah(d.nominal + d.denda)],
                    ["Rincian", `Angsuran ${rupiah(d.tagihan)}${d.denda ? ` + denda ${rupiah(d.denda)}` : ""}`],
                    ["Metode", d.metode === "tunai" ? "Tunai (diterima petugas)" : d.keterangan_metode ?? METODE[d.metode]],
                    ["Petugas", d.petugas ?? "—"],
                    ["Lokasi", d.lokasi ? `${d.lokasi} ✓` : "—"],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <dt className="text-small text-fg-muted">{l}</dt>
                      <dd className="mt-0.5 text-body font-bold">{v}</dd>
                    </div>
                  ))}
                  <div className="rounded-[12px] bg-canvas p-4">
                    <div className="text-body-sm font-bold">{d.status === "menunggu" ? "Setelah diverifikasi" : "Status"}</div>
                    <div className="mt-2 text-small text-fg-muted">Sisa pinjaman</div>
                    <div className="text-body font-bold">{d.status === "menunggu" ? `${rupiah(d.sisa_sebelum)}  →  ${rupiah(d.sisa_sesudah)}` : rupiah(d.sisa_sesudah)}</div>
                    <div className="mt-1 text-caption text-fg-muted">
                      {d.status === "menunggu" ? "Kartu pinjaman & riwayat diperbarui otomatis" : `Diproses ${d.verifikator ?? ""}${d.catatan_verifikasi ? ` · ${d.catatan_verifikasi}` : ""}`}
                    </div>
                  </div>
                </dl>
              </div>
              {d.status === "menunggu" && (
                <>
                  <label className="mt-6 block">
                    <span className="text-body-sm font-bold">Catatan verifikasi</span>
                    <Textarea className="mt-2" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Wajib diisi bila menolak — misalnya nominal tidak sesuai" />
                  </label>
                  <div className="mt-6 flex items-center justify-between border-t border-line-subtle pt-6">
                    <Button variant="danger" size="xl" disabled={busy || !catatan.trim()} title={!catatan.trim() ? "Isi alasan penolakan dulu" : undefined} onClick={() => proses("tolak")}>Tolak & Tagih Ulang</Button>
                    <Button size="xl" disabled={busy} onClick={() => proses("verifikasi")}>Verifikasi & Update Saldo</Button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}
