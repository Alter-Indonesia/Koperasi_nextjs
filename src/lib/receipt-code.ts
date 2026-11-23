import "server-only";
import crypto from "node:crypto";

/** Kode bukti unik (isi QR kwitansi): PLN-000123-AB12CD (pelunasan) · BYR-000123-AB12CD (pembayaran tunai angsuran) */
export const receiptCode = (prefix: "PLN" | "BYR", id: number) => `${prefix}-${String(id).padStart(6, "0")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
