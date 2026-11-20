"use client";
import { IdCard, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { api, ApiError } from "@/lib/api";
import { KOLOM_BIODATA } from "@/lib/ktp";

export type Region = { id: number; name: string };
type BioKey = (typeof KOLOM_BIODATA)[number];
type Bio = Record<BioKey, string>;

export type Mode = "baru" | "lihat" | "edit";
export type Initial = {
  name: string; national_id: string | null; phone: string | null; address: string | null; region_id: number; status: "aktif" | "nonaktif";
  biodata: Partial<Record<BioKey, string>>; has_id_card: boolean;
};
export type Payload = {
  name: string; national_id: string; phone: string; address: string; region_id: number; status?: "aktif" | "nonaktif";
  biodata: Partial<Record<BioKey, string>>; biodata_source: "manual" | "ocr";
};

const BIODATA_LABEL: Record<BioKey, string> = {
  name: "Nama (di KTP)", place_of_birth: "Tempat lahir", date_of_birth: "Tanggal lahir", gender: "Jenis kelamin", blood_type: "Gol. darah",
  address: "Alamat (di KTP)", rt_rw: "RT/RW", village: "Kel/Desa", district: "Kecamatan", religion: "Agama", marital_status: "Status perkawinan",
  occupation: "Pekerjaan", nationality: "Kewarganegaraan", valid_until: "Berlaku hingga",
};
const EMPTY_BIO = Object.fromEntries(KOLOM_BIODATA.map((k) => [k, ""])) as Bio;

type FormState = { name: string; national_id: string; phone: string; address: string; region_id: string; status: "aktif" | "nonaktif" };
type Field_ = keyof FormState;
const EMPTY_FORM: FormState = { name: "", national_id: "", phone: "", address: "", region_id: "", status: "aktif" };

/** Hasil baca KTP -> kolom utama form (alamat disusun dari alamat + RT/RW + kel + kec). */
export function ktpToForm(b: Partial<Record<BioKey, string>>, nik: string | null): Partial<FormState> {
  const address = [b.address, b.rt_rw && `RT/RW ${b.rt_rw}`, b.village && `KEL. ${b.village}`, b.district && `KEC. ${b.district}`].filter(Boolean).join(", ");
  return { ...(nik ? { national_id: nik } : {}), ...(b.name ? { name: b.name } : {}), ...(address ? { address } : {}) };
}
export function ktpInfo(b: Partial<Record<BioKey, string>>, nik: string | null): string {
  const n = Object.keys(b).length + (nik ? 1 : 0);
  return !n ? "Teks KTP tidak terbaca (foto kurang jelas?). Isi data secara manual atau pilih foto lain."
    : `${n} kolom terisi dari KTP. Periksa semuanya${nik ? ", terutama NIK" : ""}.${nik ? "" : " NIK tidak terbaca, isi manual."}`;
}
/** Data awal form "baru" dari langkah unggah KTP. */
export type Prefill = { photo: File; preview: string; national_id: string | null; biodata: Partial<Record<BioKey, string>>; info: string };

const fromInitial = (a?: Initial): FormState =>
  a ? { name: a.name, national_id: a.national_id ?? "", phone: a.phone ?? "", address: a.address ?? "", region_id: String(a.region_id), status: a.status } : EMPTY_FORM;

/** Aturan sama dengan server (zod); pesan ditampilkan di bawah kolomnya. */
function validate(f: FormState): Partial<Record<Field_, string>> {
  const e: Partial<Record<Field_, string>> = {};
  if (f.name.trim().length < 2) e.name = "Nama lengkap wajib diisi";
  if (!/^\d{16}$/.test(f.national_id)) e.national_id = f.national_id ? `NIK harus 16 digit (baru ${f.national_id.length})` : "NIK wajib diisi (16 digit)";
  if (!/^[0-9+\- ]{8,20}$/.test(f.phone.trim())) e.phone = f.phone.trim() ? "Nomor HP tidak valid" : "No. HP wajib diisi";
  if (!f.region_id) e.region_id = "Pilih wilayah";
  if (f.address.trim().length < 5) e.address = f.address.trim() ? "Alamat terlalu pendek (min. 5 karakter)" : "Alamat wajib diisi";
  return e;
}

/**
 * Form anggota untuk tiga mode: `baru` (kosong), `lihat` (hanya baca), `edit` (bisa diubah, tombol Simpan di bawah).
 * Unggah foto KTP -> dibaca otomatis (Tesseract di server) -> mengisi kolom; kolom yang tidak terbaca dilewati.
 * `children` tampil di kolom kanan di bawah kartu foto (mis. riwayat & pinjaman di halaman detail).
 */
export function FormAnggota({
  mode, regions, initial, memberId, prefill, onSubmit, onCancel, children,
}: {
  mode: Mode; regions: Region[]; initial?: Initial; memberId?: number; prefill?: Prefill;
  onSubmit?: (p: Payload, photo: File | null) => Promise<void>; onCancel?: () => void; children?: React.ReactNode;
}) {
  const readOnly = mode === "lihat";
  const [f, setF] = useState<FormState>(() => ({ ...fromInitial(initial), ...(prefill ? ktpToForm(prefill.biodata, prefill.national_id) : {}) }));
  const [bio, setBio] = useState<Bio>(() => ({ ...EMPTY_BIO, ...(initial?.biodata ?? prefill?.biodata ?? {}) }));
  const [photo, setPhoto] = useState<File | null>(prefill?.photo ?? null);
  const [preview, setPreview] = useState<string | null>(prefill?.preview ?? null);
  const [reading, setReading] = useState(false);
  const [source, setSource] = useState<"manual" | "ocr">(prefill ? "ocr" : "manual");
  const [info, setInfo] = useState<string | null>(prefill?.info ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field_, string>>>({});
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview && preview !== prefill?.preview) URL.revokeObjectURL(preview); }, [preview, prefill?.preview]);

  const change = (k: Field_, v: string) => { setF((x) => ({ ...x, [k]: v })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const set = (k: Field_) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(k, e.target.value);
  const setBioField = (k: BioKey) => (e: React.ChangeEvent<HTMLInputElement>) => setBio((x) => ({ ...x, [k]: e.target.value }));
  const required = !readOnly;

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setInfo(null);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setReading(true);
    try {
      const r = await api.upload<{ national_id: string | null; biodata: Partial<Record<BioKey, string>> }>("/api/v1/anggota/baca-ktp", "foto", file);
      const b = r.data.biodata;
      setBio({ ...EMPTY_BIO, ...b });
      setF((x) => ({ ...x, ...ktpToForm(b, r.data.national_id) }));
      setErrors({});
      setSource("ocr");
      setInfo(ktpInfo(b, r.data.national_id));
    } catch (e) {
      setInfo(e instanceof ApiError ? e.message : "Gagal membaca KTP, isi data secara manual.");
    } finally {
      setReading(false);
    }
  }

  async function save() {
    setErr(null);
    const e = validate(f);
    setErrors(e);
    if (Object.keys(e).length || !onSubmit) return;
    setSaving(true);
    try {
      const biodata = Object.fromEntries(Object.entries(bio).filter(([, v]) => v.trim())) as Payload["biodata"];
      await onSubmit(
        { name: f.name.trim(), national_id: f.national_id, phone: f.phone.trim(), address: f.address.trim(), region_id: Number(f.region_id), ...(mode === "edit" ? { status: f.status } : {}), biodata, biodata_source: source },
        photo,
      );
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) {
        // 400 dari server: tandai kolom yang ditolak
        const m: Partial<Record<Field_, string>> = {};
        for (const i of e.details as { path?: string[]; message?: string }[]) { const k = String(i.path?.[0]) as Field_; if (k in EMPTY_FORM) m[k] = i.message; }
        setErrors(m);
        setErr("Periksa kembali isian yang ditandai.");
      } else setErr(e instanceof ApiError ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  const image = preview ?? (initial?.has_id_card && memberId ? `/api/v1/anggota/${memberId}/ktp` : null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6">
      <div className="flex flex-col gap-6">
        <Card title="Data Anggota">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="NIK" wajib={required} error={errors.national_id}>
                <Input value={f.national_id} disabled={readOnly} onChange={(e) => change("national_id", e.target.value.replace(/\D/g, "").slice(0, 16))} inputMode="numeric" maxLength={16} placeholder="16 digit sesuai KTP" />
              </Field>
              <Field label="Nama lengkap" wajib={required} error={errors.name}>
                <Input value={f.name} disabled={readOnly} onChange={set("name")} placeholder="Siti Aminah" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="No. HP" wajib={required} error={errors.phone}>
                <Input value={f.phone} disabled={readOnly} onChange={set("phone")} placeholder="0812-xxxx-xxxx" />
              </Field>
              <Field label="Wilayah" wajib={required} error={errors.region_id}>
                <Select value={f.region_id} disabled={readOnly} onChange={set("region_id")}>
                  <option value="">Pilih…</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Alamat" wajib={required} error={errors.address}>
              <Textarea value={f.address} disabled={readOnly} onChange={set("address")} placeholder="Jl. Cikutra No. 12, RT 03/05" />
            </Field>
            {mode !== "baru" && (
              <Field label="Status">
                <Select value={f.status} disabled={readOnly} onChange={set("status")}>
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </Select>
              </Field>
            )}
          </div>
        </Card>

        <Card title="Biodata KTP" subtitle={readOnly ? undefined : "Terisi otomatis dari foto KTP; boleh diisi atau diperbaiki manual."}>
          <div className="grid grid-cols-3 gap-4">
            {KOLOM_BIODATA.map((k) => (
              <Field key={k} label={BIODATA_LABEL[k]}>
                <Input ukuran="compact" value={bio[k]} disabled={readOnly} onChange={setBioField(k)} placeholder={readOnly ? "—" : k === "date_of_birth" ? "YYYY-MM-DD" : undefined} />
              </Field>
            ))}
          </div>
        </Card>

        {!readOnly && (
          <div className="flex items-start justify-between gap-4">
            <span className="text-small text-fg-subtle"><span className="text-warn-text">*</span> wajib diisi</span>
            <div className="flex flex-col items-end gap-2">
              {err && <span className="text-small font-medium text-warn-text">{err}</span>}
              <div className="flex items-center gap-3">
                <Button variant="outline" size="lg" onClick={onCancel} disabled={saving}>Batal</Button>
                <Button size="lg" onClick={save} disabled={saving || reading}>{saving ? "Menyimpan…" : mode === "baru" ? "Simpan Anggota" : "Simpan Perubahan"}</Button>

              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Card title="Foto KTP">
          <div className="flex flex-col gap-3">
            <div
              className="flex aspect-[1.586] w-full items-center justify-center rounded-ctl bg-canvas bg-cover bg-center text-fg-subtle"
              style={image ? { backgroundImage: `url(${image})` } : undefined}
            >
              {!image && (
                <span className="flex flex-col items-center gap-1 text-small">
                  <IdCard size={28} strokeWidth={1.5} />
                  Belum ada foto KTP
                </span>
              )}
            </div>
            {!readOnly && (
              <>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickPhoto} />
                <Button variant="outline" size="md" onClick={() => fileInput.current?.click()} disabled={reading}>
                  <Upload size={16} strokeWidth={1.5} /> {image ? "Ganti foto KTP" : "Unggah foto KTP"}
                </Button>
                <span className="text-small text-fg-subtle">{reading ? "Membaca KTP… (bisa 10–30 detik)" : photo ? photo.name : "JPG/PNG/WebP, maks. 5 MB. Data KTP terisi otomatis."}</span>
                {info && <p className="text-small text-fg-muted">{info}</p>}
              </>
            )}
          </div>
        </Card>
        {children}
      </div>
    </div>
  );
}
