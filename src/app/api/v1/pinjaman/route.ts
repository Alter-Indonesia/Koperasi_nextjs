import { z } from "zod";
import { q, one, tx } from "@/lib/db";
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
    q(`SELECT id, loan_number, member_id, member_name, member_number, region_name, principal_amount, tenor_months, installment_amount, next_due_date,
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
  tenor_months: z.number().int().min(1).max(60),
  interest_rate_percent: z.number().min(0).max(10).default(1.5),
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
  if (!(await one("SELECT 1 FROM tenors WHERE months = $1 AND is_active AND deleted_at IS NULL", [d.tenor_months]))) throw new HttpError(422, `Tenor ${d.tenor_months} bulan tidak tersedia`);
  const principalPart = Math.round(d.principal_amount / d.tenor_months);
  const interestPart = Math.round((d.principal_amount * d.interest_rate_percent) / 100);
  const status = d.principal_amount > OWNER_APPROVAL_LIMIT ? "pengajuan" : "aktif";
  const res = await tx(async (c) => {
    const year = d.disbursed_on.slice(2, 4);
    const seq = (await c.query("SELECT COUNT(*) + 1 AS n FROM loans")).rows[0].n;
    const no = `PJ-${year}-${String(seq).padStart(4, "0")}`;
    const loan = (
      await c.query(
        `INSERT INTO loans (loan_number, member_id, principal_amount, tenor_months, interest_rate_percent, installment_amount, purpose, collateral, disbursed_on, status, submitted_by, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$11) RETURNING id, loan_number, status`,
        [no, d.member_id, d.principal_amount, d.tenor_months, d.interest_rate_percent, principalPart + interestPart, d.purpose, d.collateral ?? null, d.disbursed_on, status, currentUser().id],
      )
    ).rows[0];
    if (status === "aktif") {
      await c.query(
        `INSERT INTO installments (loan_id, sequence, due_date, principal_amount, interest_amount, total_amount, created_by, updated_by)
         SELECT $1, k, ($2::date + make_interval(months => k))::date, $3::numeric, $4::numeric, $3::numeric + $4::numeric, $6::int, $6::int FROM generate_series(1, $5::int) k`,
        [loan.id, d.disbursed_on, principalPart, interestPart, d.tenor_months, currentUser().id],
      );
    }
    return loan;
  });
  return created(res);
}, { module: "loans" });
