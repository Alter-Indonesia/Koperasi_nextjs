import { z } from "zod";
import { q, one, tx } from "@/lib/db";
import { type AdminFeeMode, loanAmounts } from "@/lib/loan-calc";
import { createSchedule, installmentParts } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { body, created, currentUser, handle, HttpError, intParam, ok } from "@/lib/http";

const COLLECTIBILITY = ["Lancar", "DPK", "Kurang Lancar", "Diragukan", "Macet"] as const;

// GET /api/v1/pinjaman?collectibility=&q=&page=&limit=
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = intParam(sp.get("page"), 1);
  const limit = intParam(sp.get("limit"), 10, 1, 100);
  const collectibility = COLLECTIBILITY.find((k) => k === sp.get("collectibility")) ?? null;
  const search = sp.get("q")?.trim() || null;
  const where = `status = 'aktif'
    AND ($1::text IS NULL OR collectibility = $1)
    AND ($2::text IS NULL OR member_name ILIKE '%' || $2 || '%' OR loan_number ILIKE '%' || $2 || '%')`;
  const [rows, total, summary] = await Promise.all([
    q(`SELECT id, loan_number, member_id, member_name, member_number, region_name, principal_amount, tenor_duration, tenor_unit, installment_amount, next_due_date,
              remaining_balance, paid_installments, days_overdue, collectibility
       FROM v_loans WHERE ${where}
       ORDER BY days_overdue DESC, loan_number LIMIT $3 OFFSET $4`, [collectibility, search, limit, (page - 1) * limit]),
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM v_loans WHERE ${where}`, [collectibility, search]),
    one(`SELECT COUNT(*) AS total_active, COALESCE(SUM(remaining_balance),0) AS outstanding,
                ${COLLECTIBILITY.map((k, i) => `COUNT(*) FILTER (WHERE collectibility = '${k}') AS k${i}`).join(", ")}
         FROM v_loans WHERE status = 'aktif'`),
  ]);
  const r = summary as Record<string, number>;
  return ok(rows, {
    page, limit, total: total?.n ?? 0,
    outstanding: r.outstanding, total_active: r.total_active,
    collectibility: Object.fromEntries(COLLECTIBILITY.map((k, i) => [k, r[`k${i}`]])),
  });
}, { module: "loans" });

const NewLoan = z.object({
  member_id: z.number().int().positive(),
  principal_amount: z.number().int().min(500_000).max(500_000_000),
  tenor_id: z.number().int().positive(), // lama, satuan, dan persen jasa diambil dari master tenor
  admin_fee: z.number().int().min(0).default(0), // biaya admin, dipotong dari dana cair
  purpose: z.string().trim().min(3).max(120),
  collateral: z.string().trim().max(120).optional(),
  disbursed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const OWNER_APPROVAL_LIMIT = 20_000_000;

// POST /api/v1/pinjaman — pinjaman baru; di atas Rp 20 jt masuk status "pengajuan" (perlu persetujuan Owner)
export const POST = handle(async (req: Request) => {
  const d = await body(req, NewLoan);
  const member = await one<{ id: number; status: string }>("SELECT id, status FROM members WHERE id = $1 AND deleted_at IS NULL", [d.member_id]);
  if (!member) throw new HttpError(404, "Anggota tidak ditemukan");
  if (member.status !== "aktif") throw new HttpError(422, "Anggota tidak aktif");
  const tenor = await one<{ duration: number; unit: "bulan" | "hari"; interest_rate_percent: number }>(
    "SELECT duration, unit, interest_rate_percent FROM tenors WHERE id = $1 AND is_active AND deleted_at IS NULL", [d.tenor_id],
  );
  if (!tenor) throw new HttpError(422, "Tenor tidak tersedia");
  if (d.admin_fee >= d.principal_amount) throw new HttpError(422, "Biaya admin harus lebih kecil dari plafon");
  // perlakuan biaya admin mengikuti Sistem › Pengaturan dan dicatat pada pinjaman (perubahan pengaturan tidak memengaruhi pinjaman lama)
  const feeMode = await getSetting<AdminFeeMode>("admin_fee_mode", "potong");
  const financed = loanAmounts(d.principal_amount, d.admin_fee, feeMode).financed; // dasar angsuran: plafon (pengurang) atau plafon + biaya admin (penambah)
  const { principalPart, interestPart } = installmentParts({ principal_amount: financed, interest_rate_percent: tenor.interest_rate_percent, duration: tenor.duration });
  const status = d.principal_amount > OWNER_APPROVAL_LIMIT ? "pengajuan" : "aktif";
  const res = await tx(async (c) => {
    const year = d.disbursed_on.slice(2, 4);
    const seq = (await c.query("SELECT COUNT(*) + 1 AS n FROM loans")).rows[0].n;
    const no = `PJ-${year}-${String(seq).padStart(4, "0")}`;
    const loan = (
      await c.query(
        `INSERT INTO loans (loan_number, member_id, principal_amount, tenor_duration, tenor_unit, interest_rate_percent, installment_amount, purpose, collateral, disbursed_on, status, submitted_by, admin_fee, admin_fee_mode, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$12,$12) RETURNING id, loan_number, status`,
        [no, d.member_id, d.principal_amount, tenor.duration, tenor.unit, tenor.interest_rate_percent, principalPart + interestPart, d.purpose, d.collateral ?? null, d.disbursed_on, status, currentUser().id, d.admin_fee, feeMode],
      )
    ).rows[0];
    if (status === "aktif") await createSchedule(c, loan.id, { disbursed_on: d.disbursed_on, principal_amount: financed, interest_rate_percent: tenor.interest_rate_percent, duration: tenor.duration, unit: tenor.unit }, currentUser().id);
    return loan;
  });
  return created(res);
}, { module: "loans" });
