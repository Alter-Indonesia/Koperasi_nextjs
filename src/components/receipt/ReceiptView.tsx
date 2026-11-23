"use client";
import QRCode from "qrcode";
import { ArrowLeft, Download, Menu, MessageCircle, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorBox, Skeleton, Toast } from "@/components/ui/Feedback";
import { normalizePhone } from "@/lib/phone";
import { receiptPng, type ReceiptDoc } from "./receipt-image";

/** Tautan publik bukti (isi QR): dibuka di mana saja tanpa login. Hanya dipanggil di klien (effect/handler). */
export const buktiUrl = (publicId: string) => `${window.location.origin}/bukti/${publicId}`;

/** Kartu kwitansi (dipakai halaman Petugas dan halaman publik /bukti/{uuid}). */
export function ReceiptCard({ doc, qr }: { doc: ReceiptDoc; qr: string | null }) {
  return (
    <article className="mx-auto flex w-full max-w-[420px] flex-col gap-4 rounded-card bg-card p-6 print:max-w-none print:rounded-none print:p-0">
      <header className="text-center">
        <p className="text-appbar font-bold text-fg">KoperasiKu</p>
        <p className="text-caption font-bold tracking-[2px] text-fg-muted">{doc.heading}</p>
      </header>
      <div className="flex flex-col items-center gap-2 border-y border-dashed border-line py-4">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL dibuat di klien
          <img src={qr} alt={`QR ${doc.code}`} width={192} height={192} />
        ) : (
          <div className="size-[192px]" />
        )}
        <p className="text-body font-bold tracking-[1px] text-fg">{doc.code}</p>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-body-sm">
        {doc.rows.map(([a, b]) => (
          <div key={a} className="contents"><dt className="text-fg-muted">{a}</dt><dd className="min-w-0 break-words text-right font-bold text-fg">{b}</dd></div>
        ))}
      </dl>
      <div className="flex items-center justify-between rounded-ctl bg-canvas px-4 py-3 print:border print:border-line">
        <span className="text-body font-bold text-fg">{doc.totalLabel}</span>
        <span className="text-appbar font-bold text-fg">{doc.total}</span>
      </div>
      <p className="text-center text-small text-fg-muted">{doc.footer}</p>
    </article>
  );
}

/**
 * Tampilan kwitansi ber-QR (Petugas): cetak, unduh PNG, dan kirim WhatsApp ke anggota. Di HP aksinya ada di balik ikon garis tiga.
 * QR berisi tautan publik `/bukti/{doc.publicId}` (tanpa login); kode bukti `doc.code` tetap tertulis & dicari Admin saat verifikasi. `doc` kosong = masih memuat.
 */
export function ReceiptView({ title, doc, phone, waMessage, backHref, loading, error, onRetry }: {
  title: string; doc: ReceiptDoc | null; phone: string | null; waMessage: string; backHref: string; loading: boolean; error: string | null; onRetry: () => void;
}) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "warn" } | null>(null);
  const noWa = normalizePhone(phone);
  const publicId = doc?.publicId;
  useEffect(() => {
    if (!publicId) return;
    let batal = false;
    QRCode.toDataURL(buktiUrl(publicId), { margin: 1, width: 192, errorCorrectionLevel: "M" }).then((u) => { if (!batal) setQr(u); });
    return () => { batal = true; };
  }, [publicId]);

  // menu HP (ikon garis tiga): tutup saat klik di luar atau tekan Esc
  useEffect(() => {
    if (!menu) return;
    const luar = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", luar);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", luar); window.removeEventListener("keydown", esc); };
  }, [menu]);

  async function unduh() {
    if (!doc || !qr) return;
    try {
      const url = URL.createObjectURL(await receiptPng(doc, qr));
      const a = document.createElement("a");
      a.href = url;
      a.download = `kwitansi-${doc.code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast({ m: "Gagal membuat gambar kwitansi", t: "warn" });
    }
  }
  // WhatsApp: tautan wa.me ke no. HP anggota berisi ringkasan + kode bukti (gambar tidak bisa dilampirkan lewat tautan; unduh lalu kirim manual bila perlu)
  function kirimWa() {
    if (!doc || !noWa) return;
    const nomor = noWa.startsWith("0") ? `62${noWa.slice(1)}` : noWa;
    const pesan = `${waMessage}

Lihat bukti: ${buktiUrl(doc.publicId)}`;
    window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-page font-bold text-fg">{title}</h1>
        <div ref={menuRef} className="relative md:hidden">
          <Button variant="outline" aria-label="Menu" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><Menu size={16} strokeWidth={1.5} /></Button>
          {menu && (
            <div role="menu" className="absolute right-0 top-full z-20 mt-2 flex w-[220px] flex-col rounded-card border border-line bg-card p-2">
              {([
                [ArrowLeft, "Kembali", false, () => router.push(backHref)],
                [Download, "Download", !doc || !qr, unduh],
                [MessageCircle, "Kirim WA", !doc || !noWa, kirimWa],
                [Printer, "Cetak", false, () => window.print()],
              ] as const).map(([Icon, label, mati, aksi]) => (
                <button key={label} type="button" role="menuitem" disabled={mati} onClick={() => { setMenu(false); aksi(); }}
                  className="flex h-11 cursor-pointer items-center gap-3 rounded-ctl px-3 text-left text-body font-bold text-fg hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50">
                  <Icon size={16} strokeWidth={1.5} />{label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 max-md:hidden">
          <Button variant="outline" onClick={() => router.push(backHref)}>Kembali</Button>
          <Button variant="outline" disabled={!doc || !qr} onClick={unduh}><Download size={16} strokeWidth={1.5} />Download</Button>
          <Button variant="outline" disabled={!doc || !noWa} title={doc && !noWa ? "Anggota belum punya no. HP" : undefined} onClick={kirimWa}><MessageCircle size={16} strokeWidth={1.5} />Kirim WA</Button>
          <Button variant="accent" onClick={() => window.print()}><Printer size={16} strokeWidth={1.5} />Cetak</Button>
        </div>
      </div>
      {error && <ErrorBox message={error} onRetry={onRetry} />}
      {loading && !doc ? (
        <Skeleton className="h-96" />
      ) : doc && (
        <ReceiptCard doc={doc} qr={qr} />
      )}
      <Toast message={toast?.m ?? null} tone={toast?.t} onClose={() => setToast(null)} />
    </>
  );
}
