import { one } from "@/lib/db";
import { currentUser, handle, HttpError, idParam, ok } from "@/lib/http";

// GET /api/v1/petugas/pelunasan/{id} — data kwitansi pelunasan tunai yang diterima petugas ini (untuk dicetak; QR berisi receipt_code)
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/petugas/pelunasan/[id]">) => {
  const id = idParam((await ctx.params).id);
  const me = currentUser();
  const r = await one(
    `SELECT p.id, p.receipt_code, p.amount, p.installments_count, p.received_at, p.status, p.source, l.loan_number, l.loan_amount, l.tenor_duration, l.tenor_unit,
            m.name AS member_name, m.member_number, m.address AS member_address, rg.name AS region_name, u.name AS collector_name, u.code AS collector_code
     FROM loan_payoffs p JOIN loans l ON l.id = p.loan_id JOIN members m ON m.id = p.member_id JOIN regions rg ON rg.id = m.region_id JOIN users u ON u.id = p.collector_id
     WHERE p.id = $1 AND p.collector_id = $2 AND p.receipt_code IS NOT NULL AND p.deleted_at IS NULL`, [id, me.id],
  );
  if (!r) throw new HttpError(404, "Kwitansi tidak ditemukan");
  return ok(r);
}, { module: "my_tasks" });
