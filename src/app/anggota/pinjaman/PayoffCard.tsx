"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, Toast } from "@/components/ui/Feedback";
import { cx } from "@/components/ui/cx";
import { api, ApiError } from "@/lib/api";
import { rupiah } from "@/lib/format";

export type Payoff = {
  amount: number; installments_count: number; blocked_reason: string | null;
  methods: { tunai: boolean; transfer: boolean }; collector_name: string | null;
  last_rejected: { notes: string | null; decided_at: string | null } | null;
  bank: { name: string; number: string; holder: string };
  request: { id: number; amount: number; method: "transfer" | "tunai"; status: "menunggu" | "disetujui" | "menunggu_verifikasi"; receipt_code: string | null; has_proof: boolean; collector_name: string | null } | null;
};
type Method = "transfer" | "tunai";
const METODE: Record<Method, { label: string; ket: string }> = {
  transfer: { label: "Transfer", ket: "Transfer ke rekening koperasi, lalu kirim bukti transfer." },
  tunai: { label: "Tunai lewat petugas", ket: "Serahkan uang tunai kepada petugas wilayah Anda." },
};

/** Kartu Pelunasan Dipercepat di Pinjaman Saya: ajukan (transfer / tunai) → disetujui Admin → bayar (+ bukti) → verifikasi Admin. */
export function PayoffCard({ loanId, payoff, onChanged }: { loanId: number; payoff: Payoff; onChanged: () => void }) {
  const [pilih, setPilih] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = `/api/v1/anggota/saya/pinjaman/${loanId}/pelunasan`;
  const r = payoff.request;
  const rek = `${payoff.bank.name || "rekening koperasi"} ${payoff.bank.number} a.n. ${payoff.bank.holder}`;

  async function jalankan(fn: () => Promise<unknown>, sukses: string) {
    setBusy(true);
    try {
      await fn();
      setToast({ m: sukses, t: "ok" });
      setPilih(false);
      setMethod(null);
      onChanged();
    } catch (e) {
      setToast({ m: e instanceof ApiError ? e.message : "Gagal memproses pelunasan", t: "warn" });
    } finally {
      setBusy(false);
    }
  }
  const ajukan = () => method && jalankan(() => api.post(url, { method }), "Pengajuan terkirim · menunggu persetujuan Admin");
  const batalkan = () => jalankan(() => api.delete(url), "Pengajuan pelunasan dibatalkan");
  const unggah = (f: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (f) jalankan(() => api.upload(`${url}/bukti`, "foto", f), "Bukti transfer terkirim · menunggu verifikasi Admin");
  };

  return (
    <section className="flex flex-col gap-3 rounded-card bg-card p-5">
      <p className="text-body font-bold text-fg">Pelunasan Dipercepat</p>
      <p className="text-body-sm text-fg-muted">Lunasi seluruh sisa {payoff.installments_count} angsuran sekaligus.</p>
      <p className="text-appbar font-bold text-fg">{rupiah(payoff.amount)}</p>

      {!r && payoff.last_rejected && (
        <p className="text-body-sm font-bold text-warn-text">Pengajuan sebelumnya ditolak{payoff.last_rejected.notes ? `: ${payoff.last_rejected.notes}` : ""}.</p>
      )}
      {!r && (payoff.blocked_reason ? (
        <p className="text-body-sm text-fg-muted">{payoff.blocked_reason}.</p>
      ) : (
        <Button variant="outline" size="lg" onClick={() => setPilih(true)}>Ajukan Pelunasan Dipercepat</Button>
      ))}

      {r?.status === "menunggu" && (
        <>
          <p className="text-body-sm font-bold text-warn-text">Menunggu persetujuan Admin · {METODE[r.method].label}</p>
          <Button variant="outline" size="lg" disabled={busy} onClick={batalkan}>Batalkan Pengajuan</Button>
        </>
      )}
      {r?.status === "disetujui" && r.method === "transfer" && (
        <>
          <p className="text-body-sm font-bold text-warn-text">Disetujui · silakan transfer {rupiah(r.amount)}</p>
          <p className="text-body-sm text-fg-muted">Transfer ke {rek}, lalu unggah bukti transfer.</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => unggah(e.target.files?.[0])} />
          <Button variant="accent" size="lg" disabled={busy} onClick={() => fileRef.current?.click()}>Unggah Bukti Transfer</Button>
          <Button variant="outline" size="lg" disabled={busy} onClick={batalkan}>Batalkan Pengajuan</Button>
        </>
      )}
      {r?.status === "disetujui" && r.method === "tunai" && (
        <>
          <p className="text-body-sm font-bold text-warn-text">Disetujui · serahkan uang tunai {rupiah(r.amount)} kepada petugas</p>
          <p className="text-body-sm text-fg-muted">Petugas wilayah Anda akan menerima uang dan memberikan kwitansi ber-QR sebagai bukti.</p>
          <Button variant="outline" size="lg" disabled={busy} onClick={batalkan}>Batalkan Pengajuan</Button>
        </>
      )}
      {r?.status === "menunggu_verifikasi" && r.method === "transfer" && (
        <>
          <p className="text-body-sm font-bold text-warn-text">Bukti transfer terkirim · menunggu verifikasi Admin</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => unggah(e.target.files?.[0])} />
          <Button variant="outline" size="lg" disabled={busy} onClick={() => fileRef.current?.click()}>Ganti Bukti Transfer</Button>
        </>
      )}
      {r?.status === "menunggu_verifikasi" && r.method === "tunai" && (
        <>
          <p className="text-body-sm font-bold text-warn-text">Uang tunai diterima petugas{r.collector_name ? ` ${r.collector_name}` : ""}</p>
          {r.receipt_code && <p className="text-body-sm text-fg-muted">Kode bukti: <b className="text-fg">{r.receipt_code}</b></p>}
        </>
      )}

      <Modal
        open={pilih}
        title="Ajukan pelunasan dipercepat"
        onClose={() => setPilih(false)}
        footer={<><Button variant="outline" onClick={() => setPilih(false)}>Batal</Button><Button variant="accent" disabled={busy || !method} onClick={ajukan}>Ajukan</Button></>}
      >
        <p className="text-body text-fg-muted">Nominal pelunasan <b className="text-fg">{rupiah(payoff.amount)}</b> (seluruh sisa {payoff.installments_count} angsuran, jasa dibayar penuh). Pilih cara pembayaran:</p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Cara pembayaran">
          {(Object.keys(METODE) as Method[]).map((m) => {
            const aktif = payoff.methods[m];
            return (
              <button key={m} type="button" role="radio" aria-checked={method === m} disabled={!aktif} onClick={() => setMethod(m)}
                className={cx("flex cursor-pointer flex-col items-start rounded-ctl border-[1.5px] px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50", method === m ? "border-fg bg-canvas" : "border-line")}>
                <span className="text-body font-bold text-fg">{METODE[m].label}{aktif ? "" : m === "tunai" && !payoff.collector_name ? " (belum ada petugas)" : " (dinonaktifkan)"}</span>
                <span className="text-body-sm text-fg-muted">{m === "tunai" && payoff.collector_name ? `Serahkan uang tunai kepada petugas Anda, ${payoff.collector_name}.` : METODE[m].ket}</span>
              </button>
            );
          })}
        </div>
        <p className="text-body-sm text-fg-muted">Pengajuan perlu disetujui Admin lebih dulu sebelum Anda membayar.</p>
      </Modal>
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </section>
  );
}
