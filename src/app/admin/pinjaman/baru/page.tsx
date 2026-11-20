"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { Field, Input, Select } from "@/components/ui/Form";
import { api, ApiError, useApi } from "@/lib/api";
import { isoHariIni, rupiah } from "@/lib/format";

type MemberOption = { id: number; name: string; member_number: string; region_name: string };
const AWAL = { anggota_id: "", plafon: "10000000", tenor: "12", tujuan: "", jaminan: "", tanggal_cair: "" };
type Kolom = "anggota_id" | "plafon" | "tujuan";

export default function PinjamanBaruPage() {
  const router = useRouter();
  const { data: anggota, error, reload } = useApi<MemberOption[]>("/api/v1/anggota?limit=100");
  const { data: tenors } = useApi<{ id: number; months: number; label: string | null }[]>("/api/v1/tenor?active=1");
  const [f, setF] = useState(AWAL);
  const [salah, setSalah] = useState<Partial<Record<Kolom, string>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const plafon = Number(f.plafon) || 0, tenor = Number(f.tenor) || 1;
  const angsuran = Math.round(plafon / tenor) + Math.round(plafon * 0.015);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF({ ...f, [k]: e.target.value });
    setSalah((x) => ({ ...x, [k]: undefined }));
  };

  async function simpan() {
    setErr(null);
    const e: Partial<Record<Kolom, string>> = {};
    if (!f.anggota_id) e.anggota_id = "Pilih anggota";
    if (plafon < 500_000 || plafon > 500_000_000) e.plafon = "Plafon antara Rp 500.000 dan Rp 500.000.000";
    if (f.tujuan.trim().length < 3) e.tujuan = "Tujuan wajib diisi (min. 3 karakter)";
    setSalah(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const r = await api.post<{ id: number }>("/api/v1/pinjaman", {
        member_id: Number(f.anggota_id), principal_amount: plafon, tenor_months: tenor, purpose: f.tujuan.trim(), collateral: f.jaminan.trim() || undefined, disbursed_on: f.tanggal_cair || isoHariIni(),
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
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!anggota && !error ? (
        <Skeleton className="h-[420px]" />
      ) : (
        anggota && (
          <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6">
            <div className="flex flex-col gap-6">
              <Card title="Data Pinjaman">
                <div className="flex flex-col gap-4">
                  <Field label="Anggota" wajib error={salah.anggota_id}>
                    <Select value={f.anggota_id} onChange={set("anggota_id")}>
                      <option value="">Pilih anggota…</option>
                      {anggota.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.member_number} · {a.region_name}</option>)}
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Plafon (Rp)" wajib error={salah.plafon}><Input type="number" min={500000} step={100000} value={f.plafon} onChange={set("plafon")} /></Field>
                    <Field label="Tenor (bulan)" wajib>
                      <Select value={f.tenor} onChange={set("tenor")}>{(tenors ?? []).map((t) => <option key={t.id} value={t.months}>{t.label ?? `${t.months} bulan`}</option>)}</Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Tujuan" wajib error={salah.tujuan}><Input value={f.tujuan} onChange={set("tujuan")} placeholder="Modal usaha" /></Field>
                    <Field label="Tanggal cair (kosong = hari ini)"><Input type="date" value={f.tanggal_cair} onChange={set("tanggal_cair")} /></Field>
                  </div>
                  <Field label="Jaminan (opsional)"><Input value={f.jaminan} onChange={set("jaminan")} placeholder="BPKB motor" /></Field>
                </div>
              </Card>
              <div className="flex flex-col items-end gap-2">
                {err && <span className="text-small font-medium text-warn-text">{err}</span>}
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="lg" onClick={() => router.push("/admin/pinjaman")} disabled={saving}>Batal</Button>
                  <Button size="lg" onClick={simpan} disabled={saving}>{saving ? "Menyimpan…" : "Simpan Pinjaman"}</Button>
                </div>
                <span className="text-small text-fg-subtle"><span className="text-warn-text">*</span> wajib diisi</span>
              </div>
            </div>
            <div className="rounded-card bg-inverse p-5">
              <div className="text-caption font-bold tracking-[1px] text-accent">SIMULASI ANGSURAN</div>
              <div className="mt-1 text-mobile font-bold text-fg-inverse">{rupiah(angsuran)} / bulan</div>
              <div className="mt-1 text-small text-fg-inverse-muted">Jasa 1,5%/bln flat · total kembali {rupiah(angsuran * tenor)}{plafon > 20_000_000 ? " · perlu persetujuan Owner" : ""}</div>
            </div>
          </div>
        )
      )}
    </>
  );
}
