import { jam, rupiah, tanggalPanjang, tenorLabel, type TenorUnit } from "@/lib/format";
import type { ReceiptDoc } from "./receipt-image";

/** Data kwitansi dari API (petugas & publik) -> isi kwitansi untuk tampilan, PNG, dan pesan WhatsApp. */
type Dasar = {
  public_id: string; receipt_code: string; amount: number; status: string; loan_number: string; tenor_duration: number; tenor_unit: TenorUnit;
  member_name: string; member_number: string; region_name: string; collector_name: string; collector_code: string | null;
};
export type KwitansiBayar = Dasar & { kind?: "pembayaran"; paid_at: string; installment_sequence: number };
export type KwitansiLunas = Dasar & { kind?: "pelunasan"; received_at: string; installments_count: number; loan_amount: number };

const petugas = (k: Dasar) => `${k.collector_name}${k.collector_code ? ` (${k.collector_code})` : ""}`;

export const docBayar = (k: KwitansiBayar): ReceiptDoc => ({
  heading: "KWITANSI PEMBAYARAN TUNAI",
  code: k.receipt_code,
  publicId: k.public_id,
  rows: [
    ["Anggota", `${k.member_name} (${k.member_number})`],
    ["Wilayah", k.region_name],
    ["No. pinjaman", k.loan_number],
    ["Angsuran", `ke-${k.installment_sequence} dari ${tenorLabel(k.tenor_duration, k.tenor_unit)}`],
    ["Diterima", `${tanggalPanjang(k.paid_at)} ${jam(k.paid_at)}`],
    ["Petugas", petugas(k)],
  ],
  totalLabel: "Total dibayar tunai",
  total: rupiah(k.amount),
  footer: "Pembayaran sah setelah uang disetor petugas dan diverifikasi Admin. Simpan bukti ini.",
});

export const docLunas = (k: KwitansiLunas): ReceiptDoc => ({
  heading: "KWITANSI PELUNASAN DIPERCEPAT",
  code: k.receipt_code,
  publicId: k.public_id,
  rows: [
    ["Anggota", `${k.member_name} (${k.member_number})`],
    ["Wilayah", k.region_name],
    ["No. pinjaman", k.loan_number],
    ["Pinjaman", `${rupiah(k.loan_amount)} · ${k.tenor_duration} ${k.tenor_unit}`],
    ["Angsuran dilunasi", `${k.installments_count} angsuran`],
    ["Diterima", `${tanggalPanjang(k.received_at)} ${jam(k.received_at)}`],
    ["Petugas", petugas(k)],
  ],
  totalLabel: "Total dibayar tunai",
  total: rupiah(k.amount),
  footer: "Pinjaman dinyatakan lunas setelah uang disetor petugas dan diverifikasi Admin. Simpan bukti ini.",
});

export const pesanBayar = (k: KwitansiBayar) =>
  `Yth. ${k.member_name},\n\nKami telah menerima pembayaran tunai angsuran ke-${k.installment_sequence} pinjaman ${k.loan_number} sebesar ${rupiah(k.amount)} pada ${tanggalPanjang(k.paid_at)} ${jam(k.paid_at)} oleh petugas ${k.collector_name}.\n\nKode bukti: ${k.receipt_code}\n\nPembayaran sah setelah uang disetor petugas dan diverifikasi Admin. Terima kasih.\n— KoperasiKu`;

export const pesanLunas = (k: KwitansiLunas) =>
  `Yth. ${k.member_name},\n\nKami telah menerima pelunasan dipercepat pinjaman ${k.loan_number} sebesar ${rupiah(k.amount)} (${k.installments_count} angsuran) pada ${tanggalPanjang(k.received_at)} ${jam(k.received_at)} oleh petugas ${k.collector_name}.\n\nKode bukti: ${k.receipt_code}\n\nPinjaman dinyatakan lunas setelah uang disetor petugas dan diverifikasi Admin. Terima kasih.\n— KoperasiKu`;
