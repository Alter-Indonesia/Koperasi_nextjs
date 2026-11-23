"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, avatarTone } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { Checkbox, Progress, SearchInput, Select } from "@/components/ui/Form";
import { cx } from "@/components/ui/cx";
import { api, ApiError, useApi } from "@/lib/api";
import { withFreshState } from "@/components/layout/FreshState";
import { useSession } from "@/lib/session";

type Member = { id: number; member_number: string; member_name: string; member_address: string | null; member_phone: string | null; region_id: number; region_name: string; active_loans: number };
type Collector = { id: number; name: string; region_name: string | null; region_id: number | null; load: number; max_load: number; members: Member[] };
type Data = { unassigned: Member[]; collectors: Collector[] };

function PenugasanPage() {
  const { can } = useSession();
  const bisaUbah = can("assignments", "create");
  const { data, error, loading, reload } = useApi<Data>("/api/v1/penugasan");
  const [pilih, setPilih] = useState<number[]>([]);
  const [cari, setCari] = useState("");
  const [ke, setKe] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);

  // pencarian daftar "Belum Punya Petugas": nama, no. anggota, alamat, atau wilayah (yang sudah dicentang tetap terpilih walau tersaring)
  const kata = cari.trim().toLowerCase();
  const tampil = data?.unassigned.filter((m) => !kata || [m.member_name, m.member_number, m.member_address, m.region_name].some((v) => v?.toLowerCase().includes(kata))) ?? [];
  const semuaTerpilih = tampil.length > 0 && tampil.every((m) => pilih.includes(m.id));
  const tandai = (id: number, on: boolean) => setPilih((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  async function jalankan(fn: () => Promise<{ data: { assigned: number } }>, pesan: (n: number) => string) {
    setBusy(true);
    try {
      const r = await fn();
      setPilih([]);
      setToast({ m: pesan(r.data.assigned), t: "ok" });
      reload();
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal memproses penugasan", t: "warn" });
    } finally {
      setBusy(false);
    }
  }
  const tugaskan = (petugasId: number) => {
    if (!pilih.length) return setToast({ m: "Pilih anggota di daftar kiri dulu", t: "warn" });
    const nama = data?.collectors.find((p) => p.id === petugasId)?.name;
    jalankan(() => api.post("/api/v1/penugasan", { collector_id: petugasId, member_ids: pilih }), (n) => `${n} anggota ditugaskan ke ${nama}`);
  };
  const lepas = (m: Member) => jalankan(() => api.post("/api/v1/penugasan", { collector_id: null, member_ids: [m.id] }), () => `${m.member_name} dilepas dari petugasnya`);
  const otomatis = () => jalankan(() => api.post("/api/v1/penugasan/otomatis", {}), (n) => `${n} anggota dibagi otomatis sesuai wilayah`);

  return (
    <>
      <PageHeader
        title="Penugasan Petugas"
        subtitle="Tetapkan petugas pemegang anggota. Petugas hanya menagih dan menerima pelunasan dari anggota yang dipegangnya."
        actions={bisaUbah && <Button variant="accent" size="lg" disabled={busy || !data?.unassigned.length} onClick={otomatis}>Bagi Otomatis per Wilayah</Button>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-[800px]" />}
      {data && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[556px_minmax(0,1fr)]">
          <section className="flex h-[878px] flex-col rounded-card bg-card">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="flex items-center gap-2 text-title font-bold">Belum Punya Petugas <Badge tone="telat">{data.unassigned.length}</Badge></h2>
              <button
                className="cursor-pointer text-body-sm font-bold text-warn-text"
                onClick={() => setPilih(semuaTerpilih ? pilih.filter((id) => !tampil.some((m) => m.id === id)) : [...new Set([...pilih, ...tampil.map((m) => m.id)])])}
              >
                {semuaTerpilih ? "Batal pilih" : kata ? "Pilih hasil" : "Pilih semua"}
              </button>
            </div>
            <div className="px-5 pb-3">
              <SearchInput value={cari} onChange={setCari} placeholder="Cari anggota, alamat, atau wilayah" className="w-full" />
            </div>
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
              {data.unassigned.length === 0 && <li className="px-2 py-16 text-center text-body-sm text-fg-subtle">Semua anggota sudah punya petugas</li>}
              {data.unassigned.length > 0 && tampil.length === 0 && <li className="px-2 py-16 text-center text-body-sm text-fg-subtle">Tidak ada anggota yang cocok dengan pencarian</li>}
              {tampil.map((m) => {
                const on = pilih.includes(m.id);
                return (
                  <li key={m.id} className={cx("flex items-center gap-4 rounded-ctl px-4 py-3.5", on && "bg-canvas")}>
                    {bisaUbah && <Checkbox checked={on} onChange={(v) => tandai(m.id, v)} label={`Pilih ${m.member_name}`} />}
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-bold">{m.member_name}</div>
                      <div className="truncate text-small text-fg-subtle">{m.member_address}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-body-sm font-bold">Wil. {m.region_name}</div>
                      <div className="text-small text-fg-muted">{m.active_loans > 0 ? `${m.active_loans} pinjaman aktif` : "Tanpa pinjaman aktif"}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {bisaUbah && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line-subtle px-5 py-4">
                <span className="text-body-sm font-bold">{pilih.length} anggota dipilih</span>
                <div className="flex items-center gap-2">
                  <div className="w-[170px]"><Select ukuran="compact" value={ke} onChange={(e) => setKe(e.target.value)}>
                    <option value="">Pilih petugas…</option>
                    {data.collectors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select></div>
                  <Button size="lg" disabled={busy || !ke || !pilih.length} onClick={() => tugaskan(Number(ke))}>Tugaskan</Button>
                </div>
              </div>
            )}
          </section>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {data.collectors.map((p, i) => {
              const berat = p.load / p.max_load > 0.85;
              return (
                <section key={p.id} className="flex h-[427px] flex-col rounded-card bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} tone={avatarTone(i)} />
                    <div>
                      <div className="text-body font-bold">{p.name}</div>
                      <div className="text-small text-fg-subtle">Wil. {p.region_name ?? "-"}</div>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-between text-small">
                    <span className="text-fg-muted">Anggota dipegang</span>
                    <b className={berat ? "text-warn-text" : ""}>{p.load} / {p.max_load}</b>
                  </div>
                  <Progress value={Math.min(1, p.load / p.max_load)} tone={berat ? "warn" : "accent"} className="mt-2" />
                  <ul className="mt-3 min-h-0 flex-1 overflow-y-auto">
                    {p.members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 border-b border-line-subtle py-2.5 text-body-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{m.member_name}</div>
                          <div className="text-small text-fg-muted">Wil. {m.region_name}{m.active_loans > 0 ? ` · ${m.active_loans} pinjaman aktif` : ""}</div>
                        </div>
                        {bisaUbah && <button className="shrink-0 cursor-pointer text-small font-bold text-warn-text disabled:opacity-50" disabled={busy} onClick={() => lepas(m)}>Lepas</button>}
                      </li>
                    ))}
                    {p.members.length === 0 && <li className="py-3 text-small text-fg-subtle">Belum memegang anggota</li>}
                  </ul>
                  {bisaUbah && <Button variant="outline" className="mt-4 w-full shrink-0" disabled={busy || !pilih.length} onClick={() => tugaskan(p.id)}>Tugaskan di sini</Button>}
                </section>
              );
            })}
          </div>
        </div>
      )}
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}

export default withFreshState(PenugasanPage, { module: "assignments" });
