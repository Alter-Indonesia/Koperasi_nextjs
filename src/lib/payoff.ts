import "server-only";
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { q } from "@/lib/db";
import { HttpError } from "@/lib/errors";

/** Status pengajuan yang masih berjalan (satu per pinjaman). */
export const PAYOFF_ACTIVE = ["menunggu", "disetujui", "menunggu_verifikasi"] as const;

/** Kebijakan nominal pelunasan dipercepat: jumlah seluruh angsuran yang belum lunas (jasa tetap dibayar penuh). Ganti di sini bila kebijakan berubah. */
const QUOTE_SQL = `SELECT COALESCE(SUM(total_amount), 0)::numeric AS amount, COUNT(*)::int AS count
                   FROM installments WHERE loan_id = $1 AND status <> 'lunas' AND deleted_at IS NULL`;

export type Quote = { amount: number; count: number };

export async function payoffQuote(loanId: number, c?: PoolClient): Promise<Quote> {
  const r = c ? (await c.query(QUOTE_SQL, [loanId])).rows[0] : (await q<{ amount: number; count: number }>(QUOTE_SQL, [loanId]))[0];
  return { amount: Number(r.amount), count: Number(r.count) };
}

/** Kode bukti unik (isi QR kwitansi): PLN-000123-AB12CD */
export const newReceiptCode = (payoffId: number) => `PLN-${String(payoffId).padStart(6, "0")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

/** Pembayaran tunai yang bagian dari pelunasan baru boleh diverifikasi setelah setoran petugasnya diterima Admin (aturan sama dengan VERIFY_BLOCK). */
export async function assertDepositsAccepted(c: PoolClient, payoffId: number) {
  const rows = (await c.query<{ deposit_id: number | null; status: string | null }>(
    `SELECT p.deposit_id, d.status FROM payments p LEFT JOIN cash_deposits d ON d.id = p.deposit_id
     WHERE p.payoff_id = $1 AND p.status = 'menunggu' AND p.deleted_at IS NULL`, [payoffId],
  )).rows;
  if (!rows.length) throw new HttpError(409, "Pembayaran tunai pelunasan ini tidak ditemukan");
  if (rows.some((r) => !r.deposit_id)) throw new HttpError(422, "Uang tunai pelunasan ini belum disetor petugas ke kasir");
  if (rows.some((r) => r.status === "menunggu")) throw new HttpError(422, "Setoran petugas untuk pelunasan ini belum diterima. Terima setorannya dulu di menu Setoran Petugas");
  if (rows.some((r) => r.status === "ditolak")) throw new HttpError(422, "Setoran petugas untuk pelunasan ini ditolak. Petugas harus menyetor ulang");
}

/**
 * Petugas menerima uang tunai pelunasan: dibuat pembayaran tunai 'menunggu' per angsuran tersisa (ikut uang tunai di tangan petugas →
 * setoran kas), angsuran 'menunggu_verifikasi', pengajuan 'menunggu_verifikasi' + kode bukti (QR kwitansi).
 * `payoffId` = pengajuan anggota yang sudah disetujui; null = petugas menerima langsung (dibuat pengajuan baru, source 'petugas').
 */
export async function receivePayoffCash(c: PoolClient, opts: { loanId: number; memberId: number; collectorId: number; payoffId: number | null }) {
  const left = (await c.query<{ id: number; total_amount: number; status: string }>(
    "SELECT id, total_amount, status FROM installments WHERE loan_id = $1 AND status <> 'lunas' AND deleted_at IS NULL ORDER BY sequence FOR UPDATE", [opts.loanId],
  )).rows;
  if (!left.length) throw new HttpError(422, "Tidak ada angsuran yang tersisa");
  if (left.some((i) => i.status !== "belum")) throw new HttpError(422, "Masih ada pembayaran angsuran yang menunggu verifikasi. Selesaikan dulu di Verifikasi Bayar.");
  const amount = left.reduce((s, i) => s + Number(i.total_amount), 0);
  let id = opts.payoffId;
  if (id) {
    const cur = (await c.query("SELECT amount FROM loan_payoffs WHERE id = $1", [id])).rows[0];
    if (Number(cur.amount) !== amount) throw new HttpError(409, "Sisa angsuran berubah sejak diajukan. Minta anggota membatalkan lalu mengajukan ulang.");
  } else {
    id = (await c.query<{ id: number }>(
      `INSERT INTO loan_payoffs (loan_id, member_id, amount, installments_count, method, source, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'tunai', 'petugas', 'menunggu', $5, $5) RETURNING id`, [opts.loanId, opts.memberId, amount, left.length, opts.collectorId],
    )).rows[0].id;
  }
  const code = newReceiptCode(id!);
  for (const i of left) {
    await c.query(
      `INSERT INTO payments (installment_id, amount, method, collector_id, notes, status, payoff_id, created_by, updated_by)
       VALUES ($1, $2, 'tunai', $3, $4, 'menunggu', $5, $3, $3)`, [i.id, i.total_amount, opts.collectorId, `Pelunasan dipercepat ${code}`, id],
    );
    await c.query("UPDATE installments SET status = 'menunggu_verifikasi', updated_by = $2 WHERE id = $1", [i.id, opts.collectorId]);
  }
  await c.query(
    `UPDATE loan_payoffs SET status = 'menunggu_verifikasi', collector_id = $2, received_at = now(), receipt_code = $3, updated_by = $2 WHERE id = $1`, [id, opts.collectorId, code],
  );
  return { id: id!, amount, installments_count: left.length, receipt_code: code };
}
