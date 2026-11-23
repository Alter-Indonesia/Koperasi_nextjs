"use client";
import { useParams } from "next/navigation";
import { withFreshState } from "@/components/layout/FreshState";
import { ReceiptView } from "@/components/receipt/ReceiptView";
import { docLunas, pesanLunas, type KwitansiLunas } from "@/components/receipt/receipt-docs";
import { useApi } from "@/lib/api";

type Kwitansi = KwitansiLunas & { id: number; member_phone: string | null };

/** Kwitansi pelunasan tunai (dicetak oleh petugas). QR membuka bukti publik /bukti/{uuid}; kode bukti dicari Admin saat verifikasi. */
function KwitansiPage() {
  const { id } = useParams<{ id: string }>();
  const { data: k, error, loading, reload } = useApi<Kwitansi>(`/api/v1/petugas/pelunasan/${id}`);
  return (
    <ReceiptView title="Bukti Pelunasan" doc={k ? docLunas(k) : null} phone={k?.member_phone ?? null} waMessage={k ? pesanLunas(k) : ""} backHref="/petugas/anggota#pelunasan" loading={loading} error={error} onRetry={reload} />
  );
}

export default withFreshState(KwitansiPage, { module: "my_tasks" });
