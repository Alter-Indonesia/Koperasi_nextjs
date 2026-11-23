import { z } from "zod";
import { tx } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, idParam } from "@/lib/http";
import { ensureAssignmentsAhead } from "@/lib/queries";
import { receiptCode } from "@/lib/receipt-code";
import { getSetting } from "@/lib/settings";

const Pay = z.object({
  method: z.enum(["tunai", "transfer"]),
  method_note: z.string().trim().max(100).optional(), // transfer: bank / no. referensi
  notes: z.string().trim().max(300).optional(),
});

// POST /api/v1/petugas/tugas/{id}/bayar — petugas mencatat pembayaran angsuran (id = angsuran) yang ditugaskan kepadanya hari ini.
// Tunai menghasilkan kode bukti (QR kwitansi): GET /petugas/pembayaran/{id}.
// Pembayaran berstatus "menunggu" dan baru melunasi angsuran setelah diverifikasi admin (POST /pembayaran/{id}/verifikasi).
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/petugas/tugas/[id]/bayar">) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, Pay);
  const me = currentUser();
  if (!(await getSetting(d.method === "tunai" ? "payment_cash_enabled" : "payment_transfer_enabled", true)))
    throw new HttpError(422, `Pembayaran ${d.method} sedang dinonaktifkan di pengaturan`);
  if (d.method === "transfer" && !d.method_note) throw new HttpError(422, "Isi bank atau nomor referensi transfer");
  await ensureAssignmentsAhead(0, me.id);
  const res = await tx(async (c) => {
    const i = (await c.query<{ status: string; total_amount: number }>(
      `SELECT i.status, i.total_amount FROM installments i
       WHERE i.id = $1 AND i.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM assignments a WHERE a.installment_id = i.id AND a.collector_id = $2 AND a.assigned_on = CURRENT_DATE AND a.deleted_at IS NULL)
       FOR UPDATE OF i`, [id, me.id],
    )).rows[0];
    if (!i) throw new HttpError(404, "Tagihan tidak ditemukan di tugas Anda hari ini");
    if (i.status !== "belum") throw new HttpError(409, "Tagihan ini sudah dibayar / menunggu verifikasi");
    const p = (await c.query<{ id: number }>(
      `INSERT INTO payments (installment_id, amount, method, method_note, collector_id, notes, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'menunggu', $5, $5) RETURNING id`,
      [id, i.total_amount, d.method, d.method === "transfer" ? d.method_note : null, me.id, d.notes ?? null],
    )).rows[0];
    await c.query("UPDATE installments SET status = 'menunggu_verifikasi', updated_by = $2 WHERE id = $1", [id, me.id]);
    // tunai: kwitansi ber-QR (kode bukti dicari Admin saat verifikasi)
    const code = d.method === "tunai" ? receiptCode("BYR", p.id) : null;
    if (code) await c.query("UPDATE payments SET receipt_code = $2 WHERE id = $1", [p.id, code]);
    return { id: p.id, amount: Number(i.total_amount), method: d.method, status: "menunggu", receipt_code: code };
  });
  return created(res);
}, { module: "my_tasks", action: "create", log: "collect" });
