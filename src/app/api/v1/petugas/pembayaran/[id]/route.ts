import { one } from "@/lib/db";
import { currentUser, handle, HttpError, idParam, ok } from "@/lib/http";

// GET /api/v1/petugas/pembayaran/{id} — data kwitansi pembayaran tunai angsuran yang dicatat petugas ini (untuk dicetak; QR berisi receipt_code)
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/petugas/pembayaran/[id]">) => {
  const id = idParam((await ctx.params).id);
  const me = currentUser();
  const r = await one(
    `SELECT p.id, p.public_id, p.receipt_code, p.amount + p.penalty_amount AS amount, p.paid_at, p.status, i.sequence AS installment_sequence, l.loan_number, l.tenor_duration, l.tenor_unit,
            m.name AS member_name, m.member_number, m.phone AS member_phone, rg.name AS region_name, u.name AS collector_name, u.code AS collector_code
     FROM payments p JOIN installments i ON i.id = p.installment_id JOIN loans l ON l.id = i.loan_id JOIN members m ON m.id = l.member_id
     JOIN regions rg ON rg.id = m.region_id JOIN users u ON u.id = p.collector_id
     WHERE p.id = $1 AND p.collector_id = $2 AND p.receipt_code IS NOT NULL AND p.deleted_at IS NULL`, [id, me.id],
  );
  if (!r) throw new HttpError(404, "Kwitansi tidak ditemukan");
  return ok(r);
}, { module: "my_tasks" });
