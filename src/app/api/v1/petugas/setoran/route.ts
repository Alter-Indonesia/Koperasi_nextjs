import { q, one, tx } from "@/lib/db";
import { created, currentUser, handle, HttpError, ok } from "@/lib/http";
import { getSetting } from "@/lib/settings";

// Uang tunai yang dikembalikan kasir (setoran ditolak / ada selisih) dan belum disetor ulang
const CARRY_OVER = `SELECT COALESCE(SUM(returned_amount), 0) AS amount FROM cash_deposits
                    WHERE collector_id = $1 AND returned_amount > 0 AND carried_to_deposit_id IS NULL AND deleted_at IS NULL`;

// GET /api/v1/petugas/setoran — uang tunai di tangan, transfer/QRIS hari ini, rincian hari ini, riwayat setoran
export const GET = handle(async () => {
  const me = currentUser();
  const [cash, carry, nonCash, today, deposits, date, deadline] = await Promise.all([
    one<{ amount: number; count: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count FROM payments
       WHERE collector_id = $1 AND method = 'tunai' AND status <> 'ditolak' AND deposit_id IS NULL AND deleted_at IS NULL`, [me.id]),
    one<{ amount: number }>(CARRY_OVER, [me.id]),
    one<{ amount: number; count: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count FROM payments
       WHERE collector_id = $1 AND method <> 'tunai' AND status <> 'ditolak' AND paid_at::date = CURRENT_DATE AND deleted_at IS NULL`, [me.id]),
    q(`SELECT p.id, p.amount, p.method, p.paid_at, p.deposit_id, m.name AS member_name
       FROM payments p JOIN installments i ON i.id = p.installment_id JOIN loans l ON l.id = i.loan_id JOIN members m ON m.id = l.member_id
       WHERE p.collector_id = $1 AND p.status <> 'ditolak' AND p.paid_at::date = CURRENT_DATE AND p.deleted_at IS NULL ORDER BY p.paid_at DESC`, [me.id]),
    q(`SELECT d.id, d.deposited_on, d.amount, d.payment_count, d.status, d.received_amount, d.returned_amount, d.notes, u.name AS received_by_name
       FROM cash_deposits d LEFT JOIN users u ON u.id = d.received_by
       WHERE d.collector_id = $1 AND d.deleted_at IS NULL ORDER BY d.deposited_on DESC, d.id DESC LIMIT 10`, [me.id]),
    one<{ d: string }>("SELECT CURRENT_DATE::text AS d"),
    getSetting("deposit_deadline", "17:00"),
  ]);
  const carryAmount = Number(carry?.amount ?? 0);
  // amount = pembayaran tunai belum disetor + uang kembalian dari kasir; count = jumlah pembayaran saja
  return ok({ cash_on_hand: { amount: Number(cash?.amount ?? 0) + carryAmount, count: cash?.count ?? 0, returned_amount: carryAmount }, non_cash: nonCash, today, deposits }, { date: date!.d, deadline });
}, { module: "my_deposits" });

// POST /api/v1/petugas/setoran — setor seluruh uang tunai yang belum disetor, termasuk yang dikembalikan kasir (menunggu dicocokkan kasir)
export const POST = handle(async () => {
  const me = currentUser();
  const dep = await tx(async (c) => {
    const rows = (await c.query<{ id: number; amount: number }>(
      `SELECT id, amount FROM payments WHERE collector_id = $1 AND method = 'tunai' AND status <> 'ditolak' AND deposit_id IS NULL AND deleted_at IS NULL FOR UPDATE`, [me.id],
    )).rows;
    const carryRows = (await c.query<{ id: number; returned_amount: number; status: string }>(
      `SELECT id, returned_amount, status FROM cash_deposits WHERE collector_id = $1 AND returned_amount > 0 AND carried_to_deposit_id IS NULL AND deleted_at IS NULL FOR UPDATE`, [me.id],
    )).rows;
    if (!rows.length && !carryRows.length) throw new HttpError(422, "Tidak ada uang tunai yang perlu disetor");
    // pembayaran di setoran yang ditolak ikut pindah ke setoran baru ini (verifikasinya mengikuti setoran yang diterima)
    const rejectedIds = carryRows.filter((r) => r.status === "ditolak").map((r) => r.id);
    const relinked = rejectedIds.length
      ? (await c.query<{ id: number }>("SELECT id FROM payments WHERE deposit_id = ANY($1::int[]) AND deleted_at IS NULL FOR UPDATE", [rejectedIds])).rows.map((r) => r.id)
      : [];
    const total = rows.reduce((s, r) => s + Number(r.amount), 0) + carryRows.reduce((s, r) => s + Number(r.returned_amount), 0);
    const count = rows.length + relinked.length;
    const d = (await c.query<{ id: number }>(
      `INSERT INTO cash_deposits (collector_id, amount, payment_count, created_by, updated_by) VALUES ($1, $2, $3, $1, $1) RETURNING id`, [me.id, total, count],
    )).rows[0];
    const payIds = [...rows.map((r) => r.id), ...relinked];
    if (payIds.length) await c.query("UPDATE payments SET deposit_id = $1, updated_by = $2 WHERE id = ANY($3::int[])", [d.id, me.id, payIds]);
    if (carryRows.length) await c.query("UPDATE cash_deposits SET carried_to_deposit_id = $1, updated_by = $2 WHERE id = ANY($3::int[])", [d.id, me.id, carryRows.map((r) => r.id)]);
    return { id: d.id, amount: total, payment_count: count };
  });
  return created(dep);
}, { module: "my_deposits", log: "deposit" });
