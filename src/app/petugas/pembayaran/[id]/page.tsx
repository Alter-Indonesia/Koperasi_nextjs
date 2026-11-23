"use client";
import { useParams } from "next/navigation";
import { withFreshState } from "@/components/layout/FreshState";
import { ReceiptView } from "@/components/receipt/ReceiptView";
import { docBayar, pesanBayar, type KwitansiBayar } from "@/components/receipt/receipt-docs";
import { useApi } from "@/lib/api";

type Kwitansi = KwitansiBayar & { id: number; member_phone: string | null };

/** Kwitansi pembayaran tunai angsuran (dicetak oleh petugas). QR membuka bukti publik /bukti/{uuid}; kode bukti dicari Admin di Verifikasi Bayar. */
function KwitansiPembayaranPage() {
  const { id } = useParams<{ id: string }>();
  const { data: k, error, loading, reload } = useApi<Kwitansi>(`/api/v1/petugas/pembayaran/${id}`);
  return (
    <ReceiptView title="Bukti Pembayaran" doc={k ? docBayar(k) : null} phone={k?.member_phone ?? null} waMessage={k ? pesanBayar(k) : ""} backHref="/petugas" loading={loading} error={error} onRetry={reload} />
  );
}

export default withFreshState(KwitansiPembayaranPage, { module: "my_tasks" });
