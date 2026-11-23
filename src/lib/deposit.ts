import type { BadgeTone } from "@/components/ui/Badge";

/** Status setoran kas petugas (aman untuk klien). */
export type DepositStatus = "menunggu" | "cocok" | "selisih" | "ditolak";
export const DEPOSIT_LABEL: Record<DepositStatus, string> = { menunggu: "Menunggu", cocok: "Cocok", selisih: "Selisih", ditolak: "Ditolak" };
export const DEPOSIT_TONE: Record<DepositStatus, BadgeTone> = { menunggu: "warn-outline", cocok: "sudah-bayar", selisih: "belum-bayar", ditolak: "telat" };
