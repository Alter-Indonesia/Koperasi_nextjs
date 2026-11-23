import { z } from "zod";
import { q, one, tx } from "@/lib/db";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";

type Route = RouteContext<"/api/v1/setoran/[id]">;

// GET /api/v1/setoran/{id} — detail setoran + pembayaran tunai yang disetor
export const GET = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const d = await one(
    `SELECT d.id, d.deposited_on, d.amount, d.payment_count, d.status, d.received_amount, d.returned_amount, d.notes, d.decided_at, d.created_at,
            u.name AS collector_name, rb.name AS received_by_name,
            (SELECT COALESCE(SUM(c.returned_amount), 0) FROM cash_deposits c WHERE c.carried_to_deposit_id = d.id) AS carried_amount
     FROM cash_deposits d JOIN users u ON u.id = d.collector_id LEFT JOIN users rb ON rb.id = d.received_by
     WHERE d.id = $1 AND d.deleted_at IS NULL`, [id],
  );
  if (!d) throw new HttpError(404, "Setoran tidak ditemukan");
  const payments = await q(
    `SELECT p.id, p.amount, p.paid_at, m.name AS member_name, l.loan_number, i.sequence AS installment_sequence
     FROM payments p JOIN installments i ON i.id = p.installment_id JOIN loans l ON l.id = i.loan_id JOIN members m ON m.id = l.member_id
     WHERE p.deposit_id = $1 AND p.deleted_at IS NULL ORDER BY p.paid_at`, [id],
  );
  return ok({ ...d, payments });
}, { module: "deposit_receipts" });

const Decision = z.object({
  action: z.enum(["approve", "reject"]),
  received_amount: z.number().int().min(1).optional(), // hanya untuk approve; kosong = diterima penuh
  notes: z.string().trim().max(500).optional(),
});

// POST /api/v1/setoran/{id} { action: approve|reject, received_amount?, notes? } — keputusan Admin atas setoran 'menunggu'.
//  approve: jumlah diterima = amount -> 'cocok'; kurang -> 'selisih' (catatan wajib) dan selisihnya kembali ke petugas.
//  reject : 'ditolak' (catatan wajib); seluruh nilai setoran kembali ke petugas.
export const POST = handle(async (req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, Decision);
  const me = currentUser();
  const res = await tx(async (c) => {
    const dep = (await c.query("SELECT id, amount, status FROM cash_deposits WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!dep) throw new HttpError(404, "Setoran tidak ditemukan");
    if (dep.status !== "menunggu") throw new HttpError(409, "Setoran ini sudah diputuskan");
    const amount = Number(dep.amount);
    let status: "cocok" | "selisih" | "ditolak", received: number;
    if (d.action === "reject") {
      if (!d.notes) throw new HttpError(422, "Alasan penolakan wajib diisi");
      status = "ditolak"; received = 0;
    } else {
      received = d.received_amount ?? amount;
      if (received > amount) throw new HttpError(422, "Jumlah diterima tidak boleh melebihi nilai setoran");
      status = received === amount ? "cocok" : "selisih";
      if (status === "selisih" && !d.notes) throw new HttpError(422, "Catatan wajib diisi bila ada selisih");
    }
    const returned = amount - received;
    await c.query(
      `UPDATE cash_deposits SET status = $2, received_amount = $3, returned_amount = $4, notes = $5, received_by = $6, decided_at = now(), updated_by = $6 WHERE id = $1`,
      [id, status, received, returned, d.notes ?? null, me.id],
    );
    return { id, status, received_amount: received, returned_amount: returned };
  });
  return ok(res);
}, { module: "deposit_receipts", action: "update", log: "receive_deposit" });
