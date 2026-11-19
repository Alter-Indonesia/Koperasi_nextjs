import { z } from "zod";
import { tx } from "@/lib/db";
import { body, currentUser, handle, HttpError, idParam, ok, ROLES } from "@/lib/http";

const Verifikasi = z.object({
  aksi: z.enum(["verifikasi", "tolak"]),
  catatan: z.string().trim().max(500).optional(),
});

// POST /api/v1/pembayaran/:id/verifikasi
//  - verifikasi: pembayaran terverifikasi, angsuran lunas, saldo pinjaman berkurang (6A Update saldo)
//  - tolak: pembayaran ditolak, angsuran kembali "belum" dan masuk penagihan lanjutan (6B)
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/pembayaran/[id]/verifikasi">) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, Verifikasi);
  if (d.aksi === "tolak" && !d.catatan) throw new HttpError(422, "Alasan penolakan wajib diisi");
  const res = await tx(async (c) => {
    const b = (await c.query("SELECT id, angsuran_id, status FROM pembayaran WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!b) throw new HttpError(404, "Pembayaran tidak ditemukan");
    if (b.status !== "menunggu") throw new HttpError(409, "Pembayaran ini sudah diproses");
    await c.query(
      `UPDATE pembayaran SET status = $2, catatan_verifikasi = $3, diverifikasi_oleh = $4, diverifikasi_pada = now() WHERE id = $1`,
      [id, d.aksi === "verifikasi" ? "terverifikasi" : "ditolak", d.catatan ?? null, currentUser().id],
    );
    const a = (
      await c.query(`UPDATE angsuran SET status = $2 WHERE id = $1 RETURNING pinjaman_id`, [b.angsuran_id, d.aksi === "verifikasi" ? "lunas" : "belum"])
    ).rows[0];
    let lunas = false;
    if (d.aksi === "verifikasi") {
      const sisa = (await c.query("SELECT COUNT(*) AS n FROM angsuran WHERE pinjaman_id = $1 AND status <> 'lunas'", [a.pinjaman_id])).rows[0].n;
      if (Number(sisa) === 0) {
        await c.query("UPDATE pinjaman SET status = 'lunas' WHERE id = $1", [a.pinjaman_id]);
        lunas = true;
      }
    }
    return { id, status: d.aksi === "verifikasi" ? "terverifikasi" : "ditolak", pinjaman_lunas: lunas };
  });
  return ok(res);
}, { roles: ROLES.admin });
