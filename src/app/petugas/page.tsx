"use client";
import { MessageCircle, MoreVertical, Phone, QrCode, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { withFreshState } from "@/components/layout/FreshState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/Chip";
import { ErrorBox, Modal, Skeleton, Toast } from "@/components/ui/Feedback";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { cx } from "@/components/ui/cx";
import { api, ApiError, qs, useApi } from "@/lib/api";
import { rupiah, rupiahRingkas, tambahHari, tanggalPanjang, tanggalPendek } from "@/lib/format";
import { useSession } from "@/lib/session";

type Task = {
  id: number; sequence: number; due_date: string; total_amount: number; status: string; member_name: string; member_address: string | null; member_phone: string | null;
  region_name: string; loan_number: string; tenor_duration: number; days_overdue: number; promised_on: string | null; promise_reason: string | null; receipt_payment_id: number | null;
};
type Meta = {
  date: string; today: string; upcoming: { date: string; count: number }[]; total: number; done: number; postponed: number; amount_total: number; amount_done: number;
  methods: { tunai: boolean; transfer: boolean }; bank: { name: string; number: string; holder: string };
};
type Mode = "tunai" | "transfer" | "tunda";
const MAX_TUNDA_HARI = 30;

/** 0812-… → 62812… untuk tautan WhatsApp */
const waNumber = (hp: string) => {
  const d = hp.replace(/\D/g, "");
  return d.startsWith("0") ? `62${d.slice(1)}` : d;
};

function TugasPage() {
  const router = useRouter();
  const { can } = useSession();
  const [tgl, setTgl] = useState<string | null>(null); // null = hari ini; selain itu salah satu tanggal dari meta.upcoming
  const { data, meta, error, loading, reload } = useApi<Task[], Meta>(`/api/v1/petugas/tugas${qs({ date: tgl })}`);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [bayar, setBayar] = useState<Task | null>(null);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const hariIni = !tgl || (!!meta && meta.date === meta.today); // penugasan hari ke depan hanya untuk dilihat; bayar/tunda hanya hari ini
  const bisaBayar = can("my_tasks", "create") && hariIni;

  return (
    <>
      <PageHeader title={hariIni ? "Tugas Hari Ini" : "Tugas Mendatang"} subtitle={meta ? tanggalPanjang(meta.date) : "Daftar tagihan lapangan yang ditugaskan kepada Anda"} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {(meta?.upcoming.length ?? 0) > 0 && (
        <div className="mb-6 overflow-x-auto">
          <ChipGroup<string | null>
            value={tgl}
            onChange={(v) => { setTgl(v); setMenuId(null); }}
            options={[{ value: null, label: "Hari Ini" }, ...meta!.upcoming.map((u) => ({ value: u.date as string | null, label: `${tanggalPendek(u.date)} · ${u.count}` }))]}
          />
        </div>
      )}
      <div className="mb-6 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 sm:grid-cols-[repeat(3,minmax(0,1fr))] lg:gap-6">
        <div className="col-span-2 min-w-0 sm:col-span-1 [&>*]:h-full">
          <StatCard inverse label={hariIni ? "Kunjungan hari ini" : "Kunjungan"} value={meta ? meta.total : "…"} note={meta ? `${meta.done} selesai · ${meta.total - meta.done - meta.postponed} tersisa${meta.postponed ? ` · ${meta.postponed} ditunda` : ""}` : undefined} />
        </div>
        <StatCard label="Target tagihan" value={meta ? rupiahRingkas(meta.amount_total) : "…"} note="Total angsuran" />
        <StatCard label="Sudah tertagih" value={meta ? rupiahRingkas(meta.amount_done) : "…"} note="Menunggu verifikasi / lunas" />
      </div>
      <Card title="Urutan Kunjungan" subtitle="Tagihan telat tampil lebih dulu">
        {loading && !data ? (
          <Skeleton className="h-40" />
        ) : !data?.length ? (
          <p className="py-8 text-center text-body-sm text-fg-muted">{hariIni ? "Belum ada tagihan yang ditugaskan untuk hari ini" : "Belum ada tagihan yang ditugaskan untuk tanggal ini"}</p>
        ) : (
          <ul>
            {data.map((t, i) => {
              const selesai = t.status !== "belum";
              const ditunda = !selesai && !!t.promised_on;
              return (
                <li key={t.id} className="flex items-center gap-3 border-b border-line-subtle py-4 last:border-b-0 sm:gap-4">
                  <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-pill text-body-sm font-bold", selesai ? "bg-canvas text-fg-subtle" : "bg-inverse text-accent")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cx("truncate text-body font-bold", selesai ? "text-fg-subtle" : "text-fg")}>{t.member_name}</p>
                    <p className="truncate text-body-sm text-fg-muted">{t.member_address ?? t.region_name}</p>
                    <p className="truncate text-small text-fg-subtle">{t.loan_number} · angsuran ke-{t.sequence}/{t.tenor_duration} · {rupiah(t.total_amount)}</p>
                    {ditunda && t.promise_reason && <p className="truncate text-small text-warn-text">Alasan: {t.promise_reason}</p>}
                  </div>
                  {selesai && t.receipt_payment_id && (
                    <Button variant="outline" size="sm" aria-label={`Bukti pembayaran ${t.member_name}`} onClick={() => router.push(`/petugas/pembayaran/${t.receipt_payment_id}`)}><QrCode size={16} strokeWidth={1.5} />Bukti</Button>
                  )}
                  {selesai ? <Badge tone="sudah-bayar">Selesai</Badge>
                    : ditunda ? <Badge tone="warn-outline">Janji {tanggalPendek(t.promised_on!)}</Badge>
                    : t.days_overdue > 0 ? <Badge tone="telat">Telat {t.days_overdue} hari</Badge>
                    : <Badge tone="belum-bayar">{hariIni ? "Hari ini" : "Terjadwal"}</Badge>}
                  {!selesai && (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-label={`Aksi untuk ${t.member_name}`}
                        aria-haspopup="menu"
                        aria-expanded={menuId === t.id}
                        onClick={() => setMenuId(menuId === t.id ? null : t.id)}
                        className="flex size-10 cursor-pointer items-center justify-center rounded-ctl border border-line text-fg hover:bg-canvas"
                      >
                        <MoreVertical size={16} strokeWidth={1.5} />
                      </button>
                      {menuId === t.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} />
                          <div role="menu" className="absolute top-full right-0 z-50 mt-1 flex w-44 flex-col gap-0.5 rounded-card border border-line bg-card p-1.5 shadow-lg">
                            {t.member_phone && (
                              <a role="menuitem" href={`tel:${t.member_phone}`} onClick={() => setMenuId(null)} className="flex h-10 items-center gap-3 rounded-ctl px-3 text-body-sm font-medium text-fg hover:bg-canvas">
                                <Phone size={16} strokeWidth={1.5} />Telepon
                              </a>
                            )}
                            {t.member_phone && (
                              <a role="menuitem" href={`https://wa.me/${waNumber(t.member_phone)}`} target="_blank" rel="noopener noreferrer" onClick={() => setMenuId(null)} className="flex h-10 items-center gap-3 rounded-ctl px-3 text-body-sm font-medium text-fg hover:bg-canvas">
                                <MessageCircle size={16} strokeWidth={1.5} />WhatsApp
                              </a>
                            )}
                            {bisaBayar && (
                              <button role="menuitem" type="button" onClick={() => { setMenuId(null); setBayar(t); }} className="flex h-10 cursor-pointer items-center gap-3 rounded-ctl px-3 text-left text-body-sm font-bold text-fg hover:bg-canvas">
                                <Wallet size={16} strokeWidth={1.5} />Bayar
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {bayar && meta && (
        <BayarModal
          key={bayar.id}
          task={bayar}
          meta={meta}
          onClose={() => setBayar(null)}
          onDone={(m) => { setBayar(null); setToast({ m, t: "ok" }); reload(); }}
        />
      )}
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}

/** Modal "Bayar": catat pembayaran tunai / transfer, atau tunda tagihan ke tanggal janji + alasan. Dipasang hanya saat terbuka sehingga isiannya selalu bersih. */
function BayarModal({ task, meta, onClose, onDone }: { task: Task; meta: Meta; onClose: () => void; onDone: (message: string) => void }) {
  const router = useRouter();
  const metode = (["tunai", "transfer"] as const).filter((m) => meta.methods[m]);
  const [mode, setMode] = useState<Mode>(metode[0] ?? "tunda");
  const [note, setNote] = useState("");
  const [ref, setRef] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [alasan, setAlasan] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const minTgl = tambahHari(meta.date, 1);
  const maxTgl = tambahHari(meta.date, MAX_TUNDA_HARI);

  const pilih = (m: Mode) => { setMode(m); setErrors({}); setErr(null); };

  async function submit() {
    const e: Record<string, string> = {};
    if (mode === "transfer" && !ref.trim()) e.ref = "Isi bank atau nomor referensi transfer";
    if (mode === "tunda") {
      if (!tanggal) e.tanggal = "Pilih tanggal janji bayar";
      else if (tanggal < minTgl || tanggal > maxTgl) e.tanggal = `Tanggal harus antara ${tanggalPendek(minTgl)} dan ${tanggalPendek(maxTgl)}`;
      if (alasan.trim().length < 3) e.alasan = "Alasan wajib diisi (min. 3 karakter)";
    }
    setErrors(e);
    setErr(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (mode === "tunda") {
        await api.post(`/api/v1/petugas/tugas/${task.id}/tunda`, { promised_on: tanggal, reason: alasan.trim() });
        onDone(`Tagihan ${task.member_name} ditunda ke ${tanggalPendek(tanggal)}`);
      } else {
        const r = await api.post<{ id: number; receipt_code: string | null }>(`/api/v1/petugas/tugas/${task.id}/bayar`, { method: mode, method_note: mode === "transfer" ? ref.trim() : undefined, notes: note.trim() || undefined });
        // tunai: langsung ke kwitansi ber-QR (cetak / unduh / kirim WA)
        if (r.data.receipt_code) return router.push(`/petugas/pembayaran/${r.data.id}`);
        onDone(`Pembayaran ${rupiah(task.total_amount)} dari ${task.member_name} tercatat · menunggu verifikasi admin`);
      }
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Bayar"
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Batal</Button><Button variant="accent" disabled={busy} onClick={submit}>{mode === "tunda" ? "Tunda Tagihan" : "Catat Pembayaran"}</Button></>}
    >
      <div className="rounded-ctl bg-canvas px-4 py-3">
        <p className="text-body font-bold text-fg">{task.member_name}</p>
        <p className="text-body-sm text-fg-muted">{task.loan_number} · angsuran ke-{task.sequence}/{task.tenor_duration}</p>
        <p className="mt-1 text-appbar font-bold text-fg">{rupiah(task.total_amount)}</p>
      </div>
      <ChipGroup<Mode>
        value={mode}
        onChange={pilih}
        options={[
          ...(meta.methods.tunai ? [{ value: "tunai" as const, label: "Tunai" }] : []),
          ...(meta.methods.transfer ? [{ value: "transfer" as const, label: "Transfer" }] : []),
          { value: "tunda" as const, label: "Tunda" },
        ]}
      />
      {mode === "tunai" && <p className="text-body-sm text-fg-muted">Terima uang tunai {rupiah(task.total_amount)} dari anggota. Uang ini masuk ke kas yang Anda pegang dan harus disetor ke kasir.</p>}
      {mode === "transfer" && (
        <>
          {meta.bank.number && (
            <div className="rounded-ctl border border-line px-4 py-3 text-body-sm">
              <p className="text-fg-muted">Rekening tujuan</p>
              <p className="font-bold text-fg">{meta.bank.name} {meta.bank.number}</p>
              <p className="text-fg-muted">a.n. {meta.bank.holder}</p>
            </div>
          )}
          <Field label="Bank / no. referensi transfer" wajib error={errors.ref}>
            <Input value={ref} maxLength={100} onChange={(e) => { setRef(e.target.value); setErrors((x) => ({ ...x, ref: "" })); }} placeholder="mis. BRI · REF 8821734" />
          </Field>
        </>
      )}
      {mode === "tunda" ? (
        <>
          <Field label="Tanggal janji bayar" wajib error={errors.tanggal}>
            <Input type="date" value={tanggal} min={minTgl} max={maxTgl} onChange={(e) => { setTanggal(e.target.value); setErrors((x) => ({ ...x, tanggal: "" })); }} />
          </Field>
          <Field label="Alasan penundaan" wajib error={errors.alasan}>
            <Textarea value={alasan} maxLength={300} onChange={(e) => { setAlasan(e.target.value); setErrors((x) => ({ ...x, alasan: "" })); }} placeholder="mis. Anggota belum gajian, berjanji bayar tanggal tersebut" />
          </Field>
          <p className="text-small text-fg-subtle">Tagihan ikut ditugaskan kembali kepada Anda pada tanggal janji (maks. {MAX_TUNDA_HARI} hari ke depan).</p>
        </>
      ) : (
        <Field label="Catatan (opsional)">
          <Textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Catatan untuk admin" />
        </Field>
      )}
      {err && <p className="text-small font-medium text-warn-text">{err}</p>}
    </Modal>
  );
}

export default withFreshState(TugasPage, { module: "my_tasks" });
