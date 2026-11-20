import { q, one } from "@/lib/db";
import { handle, HttpError, idParam, ok } from "@/lib/http";

// GET /api/v1/pinjaman/:id — detail pinjaman + jadwal angsuran
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/pinjaman/[id]">) => {
  const id = idParam((await ctx.params).id);
  const loan = await one("SELECT * FROM v_loans WHERE id = $1", [id]);
  if (!loan) throw new HttpError(404, "Pinjaman tidak ditemukan");
  const installments = await q(
    `SELECT i.id, i.sequence, i.due_date, i.principal_amount, i.interest_amount, i.total_amount, i.status,
            (SELECT MAX(p.paid_at) FROM payments p WHERE p.installment_id = i.id AND p.status <> 'ditolak') AS paid_at
     FROM installments i WHERE i.loan_id = $1 ORDER BY i.sequence`,
    [id],
  );
  return ok({ ...loan, installments });
}, { module: "loans" });
