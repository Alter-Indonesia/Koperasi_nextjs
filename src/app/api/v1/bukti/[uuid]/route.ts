import { one } from "@/lib/db";
import { handle, HttpError, ok } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/v1/bukti/{uuid} — bukti pembayaran (pembayaran tunai angsuran / pelunasan dipercepat) untuk halaman publik /bukti/{uuid}.
// Publik (tanpa login): UUID acak adalah satu-satunya kunci, jadi no. HP & alamat anggota sengaja tidak dikembalikan.
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/bukti/[uuid]">) => {
  const uuid = (await ctx.params).uuid;
  if (!UUID.test(uuid)) throw new HttpError(404, "Bukti tidak ditemukan");
  const bayar = await one(
    `SELECT 'pembayaran' AS kind, p.public_id, p.receipt_code, p.amount + p.penalty_amount AS amount, p.paid_at, p.status, i.sequence AS installment_sequence, l.loan_number, l.tenor_duration, l.tenor_unit,
            m.name AS member_name, m.member_number, rg.name AS region_name, u.name AS collector_name, u.code AS collector_code
     FROM payments p JOIN installments i ON i.id = p.installment_id JOIN loans l ON l.id = i.loan_id JOIN members m ON m.id = l.member_id
     JOIN regions rg ON rg.id = m.region_id JOIN users u ON u.id = p.collector_id
     WHERE p.public_id = $1 AND p.receipt_code IS NOT NULL AND p.deleted_at IS NULL`, [uuid],
  );
  if (bayar) return ok(bayar);
  const lunas = await one(
    `SELECT 'pelunasan' AS kind, p.public_id, p.receipt_code, p.amount, p.installments_count, p.received_at, p.status, l.loan_number, l.loan_amount, l.tenor_duration, l.tenor_unit,
            m.name AS member_name, m.member_number, rg.name AS region_name, u.name AS collector_name, u.code AS collector_code
     FROM loan_payoffs p JOIN loans l ON l.id = p.loan_id JOIN members m ON m.id = p.member_id JOIN regions rg ON rg.id = m.region_id JOIN users u ON u.id = p.collector_id
     WHERE p.public_id = $1 AND p.receipt_code IS NOT NULL AND p.deleted_at IS NULL`, [uuid],
  );
  if (!lunas) throw new HttpError(404, "Bukti tidak ditemukan");
  return ok(lunas);
}, { public: true });
