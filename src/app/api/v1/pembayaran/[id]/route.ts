import { one } from "@/lib/db";
import { handle, HttpError, idParam, ok, ROLES } from "@/lib/http";

// GET /api/v1/pembayaran/:id — detail bukti pembayaran + efek ke saldo pinjaman
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/pembayaran/[id]">) => {
  const id = idParam((await ctx.params).id);
  const r = await one(
    `SELECT b.*, a.ke, a.total AS tagihan, a.jatuh_tempo, a.status AS status_angsuran,
            p.id AS pinjaman_id, p.no_pinjaman, p.tenor, ag.nama AS anggota, ag.alamat, w.nama AS wilayah,
            pt.nama AS petugas, vf.nama AS verifikator, v.sisa
     FROM pembayaran b
     JOIN angsuran a ON a.id = b.angsuran_id
     JOIN pinjaman p ON p.id = a.pinjaman_id
     JOIN v_pinjaman v ON v.id = p.id
     JOIN anggota ag ON ag.id = p.anggota_id
     JOIN wilayah w ON w.id = ag.wilayah_id
     LEFT JOIN pengguna pt ON pt.id = b.petugas_id
     LEFT JOIN pengguna vf ON vf.id = b.diverifikasi_oleh
     WHERE b.id = $1`,
    [id],
  );
  if (!r) throw new HttpError(404, "Pembayaran tidak ditemukan");
  const row = r as Record<string, number | string | null>;
  // sisa di view sudah tidak menghitung angsuran 'lunas'; angsuran 'menunggu_verifikasi' masih dihitung
  const sisaSebelum = Number(row.sisa);
  const sisaSesudah = row.status === "menunggu" ? sisaSebelum - Number(row.tagihan) : sisaSebelum;
  return ok({ ...r, sisa_sebelum: sisaSebelum, sisa_sesudah: sisaSesudah });
}, { roles: ROLES.admin });
