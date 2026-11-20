"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { MemberPicker, type MemberOption } from "@/components/ui/MemberPicker";
import { api, ApiError, useApi } from "@/lib/api";
import { type AdminFeeMode, loanAmounts } from "@/lib/loan-calc";
import { angka, isoHariIni, rupiah, tenorLabel, type TenorUnit } from "@/lib/format";
import { withFreshState } from "@/components/layout/FreshState";

const AWAL = { anggota_id: "", plafon: "10000000", tenor_id: "", biaya_admin: "", tujuan: "", jaminan: "", tanggal_cair: "" };
type Kolom = "anggota_id" | "plafon" | "tenor_id" | "biaya_admin" | "tujuan";
type Tenor = { id: number; duration: number; unit: TenorUnit; interest_rate_percent: number; label: string | null };

function PinjamanBaruPage() {
  const router = useRouter();
  const { data: opsi } = useApi<{ admin_fee_mode: AdminFeeMode }>("/api/v1/pinjaman/pengaturan"); // perlakuan biaya admin (Sistem › Pengaturan)
  const mode: AdminFeeMode = opsi?.admin_fee_mode ?? "potong";
  const { data: tenors } = useApi<Tenor[]>("/api/v1/tenor?active=1");
  const [anggota, setAnggota] = useState<MemberOption | null>(null);
  const [f, setF] = useState(AWAL);
  const [salah, setSalah] = useState<Partial<Record<Kolom, string>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const plafon = Number(f.plafon) || 0, biayaAdmin = Number(f.biaya_admin) || 0;
  const tenor = (tenors ?? []).find((t) => String(t.id) === f.tenor_id) ?? null;
  const { financed, received } = loanAmounts(plafon, biayaAdmin, mode); // dasar angsuran & dana diterima mengikuti perlakuan biaya admin
  const angsuran = tenor ? Math.round(financed / tenor.duration) + Math.round((financed * tenor.interest_rate_percent) / 100) : 0;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF({ ...f, [k]: e.target.value });
    setSalah((x) => ({ ...x, [k]: undefined }));
  };

  async function simpan() {
    setErr(null);
    const e: Partial<Record<Kolom, string>> = {};
    if (!f.anggota_id) e.anggota_id = "Pilih anggota";
    if (plafon < 500_000 || plafon > 500_000_000) e.plafon = "Plafon antara Rp 500.000 dan Rp 500.000.000";
    if (!tenor) e.tenor_id = "Pilih tenor";
    if (biayaAdmin >= plafon) e.biaya_admin = "Biaya admin harus lebih kecil dari plafon";
    if (f.tujuan.trim().length < 3) e.tujuan = "Tujuan wajib diisi (min. 3 karakter)";
    setSalah(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const r = await api.post<{ id: number }>("/api/v1/pinjaman", {
        member_id: Number(f.anggota_id), principal_amount: plafon, tenor_id: tenor?.id, admin_fee: biayaAdmin, purpose: f.tujuan.trim(), collateral: f.jaminan.trim() || undefined, disbursed_on: f.tanggal_cair || isoHariIni(),
      });
      router.push(`/admin/pinjaman/${r.data.id}#dibuat`);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Gagal menyimpan");
      setSaving(false);
    }
  }

  return (
    <>
      <Link href="/admin/pinjaman" className="mb-3 inline-block text-body-sm font-medium text-fg-muted hover:text-fg">← Data Pinjaman</Link>
      <PageHeader title="Pinjaman Baru" subtitle="Jadwal angsuran dibuat otomatis. Pinjaman di atas Rp 20 jt menunggu persetujuan Owner." />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <Card title="Data Pinjaman">
            <div className="flex flex-col gap-4">
              <Field label="Anggota" wajib error={salah.anggota_id}>
                <MemberPicker
                  value={anggota}
                  invalid={!!salah.anggota_id}
                  onChange={(m) => { setAnggota(m); setF((x) => ({ ...x, anggota_id: String(m.id) })); setSalah((x) => ({ ...x, anggota_id: undefined })); }}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Plafon" wajib error={salah.plafon}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-body font-medium text-fg-muted">Rp</span>
                  <Input
                    className="pl-12"
                    inputMode="numeric"
                    value={f.plafon ? angka(plafon) : ""}
                    onChange={(e) => { setF({ ...f, plafon: e.target.value.replace(/D/g, "").slice(0, 10) }); setSalah((x) => ({ ...x, plafon: undefined })); }}
                    placeholder="10.000.000"
                  />
                </div>
              </Field>
                <Field label="Tenor" wajib error={salah.tenor_id}>
                  <Select value={f.tenor_id} onChange={set("tenor_id")}>
                    <option value="">Pilih tenor…</option>
                    {(tenors ?? []).map((t) => <option key={t.id} value={t.id}>{t.label ?? tenorLabel(t.duration, t.unit)} · jasa {t.interest_rate_percent}%/{t.unit === "hari" ? "hari" : "bln"}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tujuan" wajib error={salah.tujuan}><Input value={f.tujuan} onChange={set("tujuan")} placeholder="Modal usaha" /></Field>
                <Field label="Tanggal cair (kosong = hari ini)"><Input type="date" value={f.tanggal_cair} onChange={set("tanggal_cair")} /></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Biaya admin (opsional)" error={salah.biaya_admin}>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-body font-medium text-fg-muted">Rp</span>
                    <Input
                      className="pl-12"
                      inputMode="numeric"
                      value={f.biaya_admin ? angka(biayaAdmin) : ""}
                      onChange={(e) => { setF({ ...f, biaya_admin: e.target.value.replace(/\D/g, "").slice(0, 10) }); setSalah((x) => ({ ...x, biaya_admin: undefined })); }}
                      placeholder="0"
                    />
                  </div>
                </Field>
                <Field label="Jaminan (opsional)"><Input value={f.jaminan} onChange={set("jaminan")} placeholder="BPKB motor" /></Field>
              </div>
            </div>
          </Card>
          <div className="flex items-start justify-between gap-4">
            <span className="text-small text-fg-subtle"><span className="text-warn-text">*</span> wajib diisi</span>
            <div className="flex flex-col items-end gap-2">
              {err && <span className="text-small font-medium text-warn-text">{err}</span>}
              <div className="flex items-center gap-3">
                <Button variant="outline" size="lg" onClick={() => router.push("/admin/pinjaman")} disabled={saving}>Batal</Button>
                <Button size="lg" onClick={simpan} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Pinjaman"}</Button>

              </div>
            </div>
          </div>
        </div>
        <div className="rounded-card bg-inverse p-5">
          <div className="text-caption font-bold tracking-[1px] text-accent">SIMULASI ANGSURAN</div>
          {tenor ? (
            <>
              <div className="mt-1 text-mobile font-bold text-fg-inverse">{rupiah(angsuran)} / {tenor.unit}</div>
              <div className="mt-1 text-small text-fg-inverse-muted">Jasa {tenor.interest_rate_percent}%/{tenor.unit === "hari" ? "hari" : "bln"} flat · {tenorLabel(tenor.duration, tenor.unit)} · total kembali {rupiah(angsuran * tenor.duration)}{plafon > 20_000_000 ? " · perlu persetujuan Owner" : ""}</div>
              <div className="mt-3 border-t border-fg-inverse-muted/30 pt-3 text-small text-fg-inverse-muted">{mode === "tambah" ? `Biaya admin ${rupiah(biayaAdmin)} ditambahkan ke pokok · pokok yang dibayar ${rupiah(financed)}` : `Biaya admin ${rupiah(biayaAdmin)} mengurangi dana cair`} · dana diterima <b className="text-fg-inverse">{rupiah(Math.max(0, received))}</b></div>
            </>
          ) : (
            <div className="mt-1 text-small text-fg-inverse-muted">Pilih tenor untuk melihat simulasi.</div>
          )}
        </div>
      </div>
    </>
  );
}

export default withFreshState(PinjamanBaruPage, { module: "loans", action: "create" });
