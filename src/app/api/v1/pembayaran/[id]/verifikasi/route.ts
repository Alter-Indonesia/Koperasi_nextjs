import { z } from "zod";
import { tx } from "@/lib/db";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";

const Verify = z.object({
  action: z.enum(["verify", "reject"]),
  notes: z.string().trim().max(500).optional(),
});

// POST /api/v1/pembayaran/:id/verifikasi
//  - verify: pembayaran terverifikasi, angsuran lunas, saldo pinjaman berkurang (6A Update saldo)
//  - reject: pembayaran ditolak, angsuran kembali "belum" dan masuk penagihan lanjutan (6B)
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/pembayaran/[id]/verifikasi">) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, Verify);
  if (d.action === "reject" && !d.notes) throw new HttpError(422, "Alasan penolakan wajib diisi");
  const res = await tx(async (c) => {
    const p = (await c.query("SELECT id, installment_id, status FROM payments WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!p) throw new HttpError(404, "Pembayaran tidak ditemukan");
    if (p.status !== "menunggu") throw new HttpError(409, "Pembayaran ini sudah diproses");
    await c.query(
      `UPDATE payments SET status = $2, verification_notes = $3, verified_by = $4, verified_at = now(), updated_by = $4 WHERE id = $1`,
      [id, d.action === "verify" ? "terverifikasi" : "ditolak", d.notes ?? null, currentUser().id],
    );
    const i = (
      await c.query(`UPDATE installments SET status = $2, updated_by = $3 WHERE id = $1 RETURNING loan_id`, [p.installment_id, d.action === "verify" ? "lunas" : "belum", currentUser().id])
    ).rows[0];
    let paidOff = false;
    if (d.action === "verify") {
      const left = (await c.query("SELECT COUNT(*) AS n FROM installments WHERE loan_id = $1 AND status <> 'lunas'", [i.loan_id])).rows[0].n;
      if (Number(left) === 0) {
        await c.query("UPDATE loans SET status = 'lunas', updated_by = $2 WHERE id = $1", [i.loan_id, currentUser().id]);
        paidOff = true;
      }
    }
    return { id, status: d.action === "verify" ? "terverifikasi" : "ditolak", loan_paid_off: paidOff };
  });
  return ok(res);
}, { module: "payments", action: "update", log: "verify" });
