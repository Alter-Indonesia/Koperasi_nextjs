import { q, one } from "@/lib/db";
import { handle, HttpError, idParam, ok, ROLES } from "@/lib/http";

// GET /api/v1/pinjaman/:id — detail pinjaman + jadwal angsuran
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/pinjaman/[id]">) => {
  const id = idParam((await ctx.params).id);
  const pinjaman = await one("SELECT * FROM v_pinjaman WHERE id = $1", [id]);
  if (!pinjaman) throw new HttpError(404, "Pinjaman tidak ditemukan");
  const jadwal = await q(
    `SELECT a.id, a.ke, a.jatuh_tempo, a.pokok, a.jasa, a.total, a.status,
            (SELECT MAX(b.dibayar_pada) FROM pembayaran b WHERE b.angsuran_id = a.id AND b.status <> 'ditolak') AS dibayar_pada
     FROM angsuran a WHERE a.pinjaman_id = $1 ORDER BY a.ke`,
    [id],
  );
  return ok({ ...pinjaman, jadwal });
}, { roles: ROLES.admin });
