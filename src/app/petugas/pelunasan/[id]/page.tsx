"use client";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { withFreshState } from "@/components/layout/FreshState";
import { Button } from "@/components/ui/Button";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { useApi } from "@/lib/api";
import { jam, rupiah, tanggalPanjang } from "@/lib/format";

type Kwitansi = {
  id: number; receipt_code: string; amount: number; installments_count: number; received_at: string; status: string; source: string; loan_number: string; loan_amount: number;
  tenor_duration: number; tenor_unit: string; member_name: string; member_number: string; member_address: string | null; region_name: string; collector_name: string; collector_code: string | null;
};

/** Kwitansi pelunasan tunai (dicetak oleh petugas). QR berisi kode bukti, yang dicari/dipindai Admin saat verifikasi. */
function KwitansiPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: k, error, loading, reload } = useApi<Kwitansi>(`/api/v1/petugas/pelunasan/${id}`);
  const [qr, setQr] = useState<string | null>(null);
  const kode = k?.receipt_code;
  useEffect(() => {
    if (!kode) return;
    let batal = false;
    QRCode.toDataURL(kode, { margin: 1, width: 192, errorCorrectionLevel: "M" }).then((u) => { if (!batal) setQr(u); });
    return () => { batal = true; };
  }, [kode]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-page font-bold text-fg">Bukti Pelunasan</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/petugas/pelunasan")}>Kembali</Button>
          <Button variant="accent" onClick={() => window.print()}><Printer size={16} strokeWidth={1.5} />Cetak</Button>
        </div>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !k ? (
        <Skeleton className="h-96" />
      ) : k && (
        <article className="mx-auto flex w-full max-w-[420px] flex-col gap-4 rounded-card bg-card p-6 print:max-w-none print:rounded-none print:p-0">
          <header className="text-center">
            <p className="text-appbar font-bold text-fg">KoperasiKu</p>
            <p className="text-caption font-bold tracking-[2px] text-fg-muted">KWITANSI PELUNASAN DIPERCEPAT</p>
          </header>
          <div className="flex flex-col items-center gap-2 border-y border-dashed border-line py-4">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL dibuat di klien
              <img src={qr} alt={`QR ${k.receipt_code}`} width={192} height={192} />
            ) : (
              <div className="size-[192px]" />
            )}
            <p className="text-body font-bold tracking-[1px] text-fg">{k.receipt_code}</p>
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-body-sm">
            {([
              ["Anggota", `${k.member_name} (${k.member_number})`],
              ["Wilayah", k.region_name],
              ["No. pinjaman", k.loan_number],
              ["Pinjaman", `${rupiah(k.loan_amount)} · ${k.tenor_duration} ${k.tenor_unit}`],
              ["Angsuran dilunasi", `${k.installments_count} angsuran`],
              ["Diterima", `${tanggalPanjang(k.received_at)} ${jam(k.received_at)}`],
              ["Petugas", `${k.collector_name}${k.collector_code ? ` (${k.collector_code})` : ""}`],
            ] as const).map(([a, b]) => (
              <div key={a} className="contents"><dt className="text-fg-muted">{a}</dt><dd className="min-w-0 break-words text-right font-bold text-fg">{b}</dd></div>
            ))}
          </dl>
          <div className="flex items-center justify-between rounded-ctl bg-canvas px-4 py-3 print:border print:border-line">
            <span className="text-body font-bold text-fg">Total dibayar tunai</span>
            <span className="text-appbar font-bold text-fg">{rupiah(k.amount)}</span>
          </div>
          <p className="text-center text-small text-fg-muted">Pinjaman dinyatakan lunas setelah uang disetor petugas dan diverifikasi Admin. Simpan bukti ini.</p>
        </article>
      )}
    </>
  );
}

export default withFreshState(KwitansiPage, { module: "my_tasks" });
