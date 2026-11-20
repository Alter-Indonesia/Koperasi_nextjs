"use client";
import { IdCard, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ErrorBox, Modal, Skeleton } from "@/components/ui/Feedback";
import { api, ApiError, useApi } from "@/lib/api";
import { FormAnggota, ktpInfo, type Payload, type Prefill, type Region } from "../FormAnggota";

type Hasil = { national_id: string | null; biodata: Prefill["biodata"] };

/** Langkah 1: unggah KTP. Langkah 2: form terisi dari KTP (NIK mengikuti KTP). */
function AnggotaBaru() {
  const router = useRouter();
  const { data: regions, error, reload } = useApi<Region[]>("/api/v1/wilayah");
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [skip, setSkip] = useState(false); // lewati KTP: langsung form kosong
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setReading(true);
    const preview = URL.createObjectURL(file);
    try {
      const r = await api.upload<Hasil>("/api/v1/anggota/baca-ktp", "foto", file);
      setPrefill({ photo: file, preview, national_id: r.data.national_id, biodata: r.data.biodata, info: ktpInfo(r.data.biodata, r.data.national_id) });
    } catch (err) {
      // tidak terbaca: lewati ke form dengan foto terlampir, isi manual
      const info = err instanceof ApiError ? err.message : "Gagal membaca KTP, isi data secara manual.";
      setPrefill({ photo: file, preview, national_id: null, biodata: {}, info });
    } finally {
      setReading(false);
    }
  }

  async function save(p: Payload, photo: File | null) {
    const r = await api.post<{ id: number }>("/api/v1/anggota", p);
    let hash = "dibuat";
    if (photo) {
      try {
        await api.upload(`/api/v1/anggota/${r.data.id}/ktp`, "foto", photo);
      } catch {
        hash = "dibuat-foto-gagal";
      }
    }
    router.push(`/admin/anggota/${r.data.id}#${hash}`);
  }

  const step2 = !!prefill || skip;
  return (
    <>
      <Link href="/admin/anggota" className="mb-3 inline-block text-body-sm font-medium text-fg-muted hover:text-fg">← Data Anggota</Link>
      <PageHeader
        title="Anggota Baru"
        subtitle={step2 ? "Periksa data hasil bacaan KTP, lengkapi yang kurang, lalu simpan." : "Data terisi otomatis dari foto KTP."}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!regions && !error && <Skeleton className="h-[480px]" />}
      {regions && step2 && <FormAnggota mode="baru" regions={regions} prefill={prefill ?? undefined} onSubmit={save} onCancel={() => router.push("/admin/anggota")} />}
      <Modal open={!!regions && !step2} title="Unggah foto KTP" onClose={() => !reading && router.push("/admin/anggota")}>
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

/**
 * Next 16 (Cache Components) menyimpan state halaman yang ditinggalkan. Agar "Anggota Baru" selalu mulai bersih,
 * setiap kali halaman disembunyikan/dilepas, key dinaikkan sehingga seluruh form dibuat ulang.
 */
export default function AnggotaBaruPage() {
  const [run, setRun] = useState(0);
  useEffect(() => () => setRun((n) => n + 1), []);
  return <AnggotaBaru key={run} />;
}
