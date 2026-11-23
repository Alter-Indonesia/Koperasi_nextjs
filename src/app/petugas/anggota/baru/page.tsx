"use client";
import { IdCard, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { FormAnggota, ktpInfo, type Payload, type Prefill } from "@/app/admin/anggota/FormAnggota";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBox, Modal, Skeleton } from "@/components/ui/Feedback";
import { Field, Input, Select } from "@/components/ui/Form";
import { api, ApiError, useApi } from "@/lib/api";
import { angka, isoHariIni, rupiah, tenorLabel, type TenorUnit } from "@/lib/format";
import { type AdminFeeMode, loanAmounts } from "@/lib/loan-calc";

type Tenor = { id: number; duration: number; unit: TenorUnit; interest_rate_percent: number; label: string | null };
type Opsi = { regions: { id: number; name: string }[]; tenors: Tenor[]; admin_fee_mode: AdminFeeMode; approval_limit: number; ceiling: number };
type Hasil = { national_id: string | null; biodata: Prefill["biodata"] };
type Kolom = "pinjaman" | "tenor_id" | "biaya_admin" | "tujuan";
const AWAL = { aktif: false, pinjaman: "", tenor_id: "", biaya_admin: "", tujuan: "", jaminan: "", tanggal_cair: "" };

/** Langkah 1: unggah KTP (atau isi manual). Langkah 2: form anggota + card pengajuan pinjaman (opsional). */
function AnggotaBaruPage() {
  const router = useRouter();
  const { data: opsi, error, reload } = useApi<Opsi>("/api/v1/petugas/anggota/opsi");
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [skip, setSkip] = useState(false);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [p, setP] = useState(AWAL);
  const [salah, setSalah] = useState<Partial<Record<Kolom, string>>>({});

  const pinjaman = Number(p.pinjaman) || 0, biayaAdmin = Number(p.biaya_admin) || 0;
  const tenor = (opsi?.tenors ?? []).find((t) => String(t.id) === p.tenor_id) ?? null;
  const mode: AdminFeeMode = opsi?.admin_fee_mode ?? "potong";
  const { financed, received } = loanAmounts(pinjaman, biayaAdmin, mode);
  const angsuran = tenor ? Math.round(financed / tenor.duration) + Math.round((financed * tenor.interest_rate_percent) / 100) : 0;
  const perluOwner = !!opsi && pinjaman > opsi.approval_limit;
  const ubah = (k: keyof typeof AWAL, v: string | boolean) => { setP((x) => ({ ...x, [k]: v })); setSalah((x) => ({ ...x, [k]: undefined })); };

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setReading(true);
    const preview = URL.createObjectURL(file);
    try {
      const r = await api.upload<Hasil>("/api/v1/petugas/anggota/baca-ktp", "foto", file);
      setPrefill({ photo: file, preview, national_id: r.data.national_id, biodata: r.data.biodata, info: ktpInfo(r.data.biodata, r.data.national_id) });
    } catch (err) {
      setPrefill({ photo: file, preview, national_id: null, biodata: {}, info: err instanceof ApiError ? err.message : "Gagal membaca KTP, isi data secara manual." });
    } finally {
      setReading(false);
    }
  }

  /** Validasi card pinjaman (hanya bila diaktifkan); sama dengan aturan server. */
  function cekPinjaman() {
    if (!p.aktif) return true;
    const e: Partial<Record<Kolom, string>> = {};
    if (pinjaman < 500_000 || pinjaman > 500_000_000) e.pinjaman = "Pinjaman antara Rp 500.000 dan Rp 500.000.000";
    if (!tenor) e.tenor_id = "Pilih tenor";
    if (biayaAdmin >= pinjaman) e.biaya_admin = "Biaya admin harus lebih kecil dari jumlah pinjaman";
    if (p.tujuan.trim().length < 3) e.tujuan = "Tujuan wajib diisi (min. 3 karakter)";
    setSalah(e);
    return !Object.keys(e).length;
  }

  async function save(d: Payload, photo: File | null) {
    const r = await api.post<{ id: number; loan: { status: string } | null }>("/api/v1/petugas/anggota", {
      ...d,
      ...(p.aktif && tenor ? { loan: { loan_amount: pinjaman, tenor_id: tenor.id, admin_fee: biayaAdmin, purpose: p.tujuan.trim(), collateral: p.jaminan.trim() || undefined, disbursed_on: p.tanggal_cair || isoHariIni() } } : {}),
    });
    if (photo) await api.upload(`/api/v1/petugas/anggota/${r.data.id}/ktp`, "foto", photo).catch(() => null); // foto gagal tidak membatalkan anggota
    router.push(`/petugas/anggota#${r.data.loan?.status === "pengajuan" ? "dibuat-pengajuan" : "dibuat"}`);
  }

  const step2 = !!prefill || skip;
  const rp = (v: string, k: keyof typeof AWAL, ph: string) => (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-body font-medium text-fg-muted">Rp</span>
      <Input className="pl-12" inputMode="numeric" value={v ? angka(Number(v)) : ""} placeholder={ph} onChange={(e) => ubah(k, e.target.value.replace(/\D/g, "").slice(0, 10))} />
    </div>
  );
  const kartuPinjaman = (
    <Card title="Pengajuan Pinjaman" subtitle={opsi ? `Pinjaman langsung aktif sampai ${rupiah(opsi.approval_limit)}; di atasnya menunggu persetujuan Owner.` : undefined}>
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-center gap-3 text-body font-medium text-fg">
          <input type="checkbox" className="size-4" checked={p.aktif} onChange={(e) => ubah("aktif", e.target.checked)} />
          Ajukan pinjaman untuk anggota ini
        </label>
        {p.aktif && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Pinjaman" wajib error={salah.pinjaman}>{rp(p.pinjaman, "pinjaman", "10.000.000")}</Field>
              <Field label="Tenor" wajib error={salah.tenor_id}>
                <Select value={p.tenor_id} onChange={(e) => ubah("tenor_id", e.target.value)}>
                  <option value="">Pilih tenor…</option>
                  {(opsi?.tenors ?? []).map((t) => <option key={t.id} value={t.id}>{t.label ?? tenorLabel(t.duration, t.unit)} · jasa {t.interest_rate_percent}%/{t.unit === "hari" ? "hari" : "bln"}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Biaya admin (opsional)" error={salah.biaya_admin}>{rp(p.biaya_admin, "biaya_admin", "0")}</Field>
              <Field label="Tanggal cair (kosong = hari ini)"><Input type="date" value={p.tanggal_cair} onChange={(e) => ubah("tanggal_cair", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tujuan" wajib error={salah.tujuan}><Input value={p.tujuan} onChange={(e) => ubah("tujuan", e.target.value)} placeholder="Modal usaha" /></Field>
              <Field label="Jaminan (opsional)"><Input value={p.jaminan} onChange={(e) => ubah("jaminan", e.target.value)} placeholder="BPKB motor" /></Field>
            </div>
            <div className="rounded-ctl bg-canvas p-4 text-body-sm text-fg-muted">
              {tenor
                ? <>Angsuran <b className="text-fg">{rupiah(angsuran)} / {tenor.unit}</b> · {tenorLabel(tenor.duration, tenor.unit)} · total kembali {rupiah(angsuran * tenor.duration)} · dana diterima <b className="text-fg">{rupiah(Math.max(0, received))}</b>{perluOwner && <b className="text-warn-text"> · perlu persetujuan Owner</b>}</>
                : "Pilih tenor untuk melihat simulasi angsuran."}
            </div>
          </>
        )}
      </div>
    </Card>
  );

  return (
    <>
      <Link href="/petugas/anggota" className="mb-3 inline-block text-body-sm font-medium text-fg-muted hover:text-fg">← Data Anggota</Link>
      <PageHeader title="Anggota Baru" subtitle={step2 ? "Periksa data hasil bacaan KTP, lengkapi yang kurang, lalu simpan." : "Data terisi otomatis dari foto KTP."} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!opsi && !error && <Skeleton className="h-[480px]" />}
      {opsi && step2 && (
        <FormAnggota
          mode="baru" regions={opsi.regions} prefill={prefill ?? undefined} onSubmit={save} onCancel={() => router.push("/petugas/anggota")}
          extra={kartuPinjaman} beforeSubmit={cekPinjaman} ktpReadUrl="/api/v1/petugas/anggota/baca-ktp" ktpFirstOnMobile
          saveLabel={p.aktif ? "Simpan Anggota & Pinjaman" : "Simpan Anggota"}
        />
      )}
      <Modal open={!!opsi && !step2} title="Unggah foto KTP" onClose={() => !reading && router.push("/petugas/anggota")}>
        <div className="flex flex-col items-center gap-4 text-center">
          <IdCard size={40} strokeWidth={1.5} className="text-fg-subtle" />
          <p className="text-body-sm text-fg-muted">Unggah foto KTP calon anggota. Sistem membaca NIK dan biodata, lalu membuka form yang sudah terisi.</p>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
          <Button size="lg" onClick={() => fileInput.current?.click()} disabled={reading}>
            <Upload size={16} strokeWidth={1.5} /> {reading ? "Membaca KTP…" : "Unggah foto KTP"}
          </Button>
          <span className="text-small text-fg-subtle">{reading ? `${fileName} — bisa 10–30 detik` : "JPG/PNG/WebP, maks. 5 MB."}</span>
          <Button variant="outline" size="md" onClick={() => setSkip(true)} disabled={reading}>Lewati, isi manual</Button>
        </div>
      </Modal>
    </>
  );
}

export default withFreshState(AnggotaBaruPage, { module: "my_tasks", action: "create" });
