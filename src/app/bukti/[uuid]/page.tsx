"use client";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { withFreshState } from "@/components/layout/FreshState";
import { buktiUrl, ReceiptCard } from "@/components/receipt/ReceiptView";
import { docBayar, docLunas, type KwitansiBayar, type KwitansiLunas } from "@/components/receipt/receipt-docs";
import { Button } from "@/components/ui/Button";
import { ErrorBox, Skeleton } from "@/components/ui/Feedback";
import { useApi } from "@/lib/api";

/** Bukti pembayaran publik (tujuan QR kwitansi): tanpa login, diakses lewat UUID acak. Isinya sama dengan kwitansi cetak petugas. */
function BuktiPublikPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: k, error, loading, reload } = useApi<KwitansiBayar | KwitansiLunas>(`/api/v1/bukti/${uuid}`);
  const [qr, setQr] = useState<string | null>(null);
  const publicId = k?.public_id;
  useEffect(() => {
    if (!publicId) return;
    let batal = false;
    QRCode.toDataURL(buktiUrl(publicId), { margin: 1, width: 192, errorCorrectionLevel: "M" }).then((u) => { if (!batal) setQr(u); });
    return () => { batal = true; };
  }, [publicId]);
  const doc = k ? (k.kind === "pelunasan" ? docLunas(k as KwitansiLunas) : docBayar(k as KwitansiBayar)) : null;
  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !doc && <Skeleton className="h-96" />}
      {doc && (
        <>
          <ReceiptCard doc={doc} qr={qr} />
          <Button variant="accent" className="print:hidden" onClick={() => window.print()}><Printer size={16} strokeWidth={1.5} />Cetak</Button>
        </>
      )}
    </div>
  );
}

export default withFreshState(BuktiPublikPage);
