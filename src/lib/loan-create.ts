import type { PoolClient } from "pg";
import { z } from "zod";
import { type AdminFeeMode, loanAmounts } from "@/lib/loan-calc";
import { rupiah } from "@/lib/format";
import { createSchedule, installmentParts, loanCeilingFor } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { HttpError } from "@/lib/http";

/** Isian pinjaman (tanpa anggota); dipakai POST /pinjaman dan POST /petugas/anggota. */
export const LoanFields = z.object({
  loan_amount: z.number().int().min(500_000).max(500_000_000), // jumlah pinjaman
  tenor_id: z.number().int().positive(), // lama, satuan, dan persen jasa diambil dari master tenor
  admin_fee: z.number().int().min(0).default(0), // biaya admin; perlakuannya mengikuti pengaturan admin_fee_mode
  purpose: z.string().trim().min(3).max(120),
  collateral: z.string().trim().max(120).optional(),
  disbursed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type LoanInput = z.infer<typeof LoanFields>;

/**
 * Buat pinjaman (+ jadwal angsuran bila langsung aktif) di dalam transaksi `c`.
 * Di atas batas persetujuan (loan_approval_limit) statusnya `pengajuan` (Owner memutuskan lewat Persetujuan Pinjaman);
 * selain itu langsung `aktif`. `enforcePlafon` = tolak jumlah di atas plafon (kecuali Owner, bila diizinkan).
 */
export async function createLoan(c: PoolClient, memberId: number, d: LoanInput, opts: { role: string; userId: number; enforcePlafon: boolean }) {
  const tenor = (await c.query<{ duration: number; unit: "bulan" | "hari"; interest_rate_percent: number }>(
    "SELECT duration, unit, interest_rate_percent FROM tenors WHERE id = $1 AND is_active AND deleted_at IS NULL", [d.tenor_id],
  )).rows[0];
  if (!tenor) throw new HttpError(422, "Tenor tidak tersedia");
  const { ceiling, can_exceed, approval_limit } = await loanCeilingFor(opts.role);
  if (opts.enforcePlafon && d.loan_amount > ceiling && !can_exceed) throw new HttpError(422, `Jumlah pinjaman melebihi plafon (${rupiah(ceiling)})`);
  if (d.admin_fee >= d.loan_amount) throw new HttpError(422, "Biaya admin harus lebih kecil dari jumlah pinjaman");
  // perlakuan biaya admin dicatat pada pinjaman (perubahan pengaturan tidak memengaruhi pinjaman lama)
  const feeMode = await getSetting<AdminFeeMode>("admin_fee_mode", "potong");
  const financed = loanAmounts(d.loan_amount, d.admin_fee, feeMode).financed;
  const { principalPart, interestPart } = installmentParts({ principal_amount: financed, interest_rate_percent: tenor.interest_rate_percent, duration: tenor.duration });
  const status = d.loan_amount > approval_limit ? "pengajuan" : "aktif";
  const no = `PJ-${d.disbursed_on.slice(2, 4)}-${String((await c.query("SELECT COUNT(*) + 1 AS n FROM loans")).rows[0].n).padStart(4, "0")}`;
  const loan = (await c.query(
    `INSERT INTO loans (loan_number, member_id, principal_amount, loan_amount, tenor_duration, tenor_unit, interest_rate_percent, installment_amount, purpose, collateral, disbursed_on, status, submitted_by, admin_fee, admin_fee_mode, created_by, updated_by)
     VALUES ($1,$2,$15,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$12,$12) RETURNING id, loan_number, status`,
    [no, memberId, d.loan_amount, tenor.duration, tenor.unit, tenor.interest_rate_percent, principalPart + interestPart, d.purpose, d.collateral ?? null, d.disbursed_on, status, opts.userId, d.admin_fee, feeMode, ceiling],
  )).rows[0] as { id: number; loan_number: string; status: "aktif" | "pengajuan" };
  if (status === "aktif") await createSchedule(c, loan.id, { disbursed_on: d.disbursed_on, principal_amount: financed, interest_rate_percent: tenor.interest_rate_percent, duration: tenor.duration, unit: tenor.unit }, opts.userId);
  return loan;
}
