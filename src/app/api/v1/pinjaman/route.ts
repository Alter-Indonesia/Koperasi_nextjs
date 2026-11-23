import { z } from "zod";
import { q, one, tx } from "@/lib/db";
import { createLoan, LoanFields } from "@/lib/loan-create";
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
    q(`SELECT id, loan_number, member_id, member_name, member_number, region_name, principal_amount, loan_amount, tenor_duration, tenor_unit, installment_amount, next_due_date,
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

const NewLoan = LoanFields.extend({ member_id: z.number().int().positive() }); // jumlah tidak boleh melebihi plafon (kecuali Owner, bila diizinkan)

// POST /api/v1/pinjaman — pinjaman baru; di atas batas persetujuan (pengaturan loan_approval_limit) masuk status "pengajuan" (perlu persetujuan Owner)
export const POST = handle(async (req: Request) => {
  const d = await body(req, NewLoan);
  const member = await one<{ id: number; status: string }>("SELECT id, status FROM members WHERE id = $1 AND deleted_at IS NULL", [d.member_id]);
  if (!member) throw new HttpError(404, "Anggota tidak ditemukan");
  if (member.status !== "aktif") throw new HttpError(422, "Anggota tidak aktif");
  const me = currentUser();
  const res = await tx((c) => createLoan(c, d.member_id, d, { role: me.role, userId: me.id, enforcePlafon: true }));
  return created(res);
}, { module: "loans" });
