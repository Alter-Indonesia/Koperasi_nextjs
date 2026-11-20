import "server-only";
import type { PoolClient } from "pg";

export const MAX_COLLECTOR_LOAD = 30;

/** Angsuran tertua yang belum dibayar per pinjaman, sudah/akan jatuh tempo s.d. tanggal $1 (installments = angsuran) */
export const TAGIHAN_TERBUKA = `
  SELECT DISTINCT ON (i.loan_id) i.id, i.loan_id, i.sequence, i.due_date, i.total_amount,
         m.name AS member_name, m.address AS member_address, m.region_id, r.name AS region_name, l.loan_number
  FROM installments i
  JOIN loans l ON l.id = i.loan_id AND l.status = 'aktif' AND l.deleted_at IS NULL
  JOIN members m ON m.id = l.member_id AND m.deleted_at IS NULL
  JOIN regions r ON r.id = m.region_id
  WHERE i.status = 'belum' AND i.due_date <= $1::date
  ORDER BY i.loan_id, i.due_date`;

export type LoanTerms = { disbursed_on: string; principal_amount: number; interest_rate_percent: number; duration: number; unit: "bulan" | "hari" };

/** Angsuran per periode: pokok dibagi rata + jasa flat (persen jasa × plafon per bulan/hari, mengikuti satuan tenor). */
export function installmentParts(t: Pick<LoanTerms, "principal_amount" | "interest_rate_percent" | "duration">) {
  return { principalPart: Math.round(t.principal_amount / t.duration), interestPart: Math.round((t.principal_amount * t.interest_rate_percent) / 100) };
}

/** Buat jadwal angsuran: jatuh tempo ke-k = tanggal cair + k bulan, atau + k hari untuk tenor harian. */
export async function createSchedule(c: PoolClient, loanId: number, t: LoanTerms, userId: number) {
  const { principalPart, interestPart } = installmentParts(t);
  await c.query(
    `INSERT INTO installments (loan_id, sequence, due_date, principal_amount, interest_amount, total_amount, created_by, updated_by)
     SELECT $1, k, CASE WHEN $7 = 'hari' THEN $2::date + k ELSE ($2::date + make_interval(months => k))::date END,
            $3::numeric, $4::numeric, $3::numeric + $4::numeric, $6::int, $6::int FROM generate_series(1, $5::int) k`,
    [loanId, t.disbursed_on, principalPart, interestPart, t.duration, userId, t.unit],
  );
}
