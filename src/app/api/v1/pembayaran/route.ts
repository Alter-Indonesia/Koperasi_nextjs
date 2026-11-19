import { q, one } from "@/lib/db";
import { handle, intParam, ok, ROLES } from "@/lib/http";

// GET /api/v1/pembayaran?status=menunggu|terverifikasi|ditolak&limit=
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const status = ["menunggu", "terverifikasi", "ditolak"].includes(sp.get("status") ?? "") ? sp.get("status") : "menunggu";
  const limit = intParam(sp.get("limit"), 50, 1, 200);
  const [rows, jumlah] = await Promise.all([
    q(`SELECT b.id, b.nominal + b.denda AS nominal, b.metode, b.keterangan_metode, b.dibayar_pada, b.status,
              ag.nama AS anggota, p.no_pinjaman, a.ke, p.tenor, pt.nama AS petugas
       FROM pembayaran b
       JOIN angsuran a ON a.id = b.angsuran_id
       JOIN pinjaman p ON p.id = a.pinjaman_id
       JOIN anggota ag ON ag.id = p.anggota_id
       LEFT JOIN pengguna pt ON pt.id = b.petugas_id
       WHERE b.status = $1
         AND ($1 = 'menunggu' OR COALESCE(b.diverifikasi_pada, b.dibayar_pada)::date = CURRENT_DATE)
       ORDER BY CASE WHEN $1 = 'menunggu' THEN b.dibayar_pada END ASC, b.diverifikasi_pada DESC NULLS LAST
       LIMIT $2`, [status, limit]),
    one(`SELECT COUNT(*) FILTER (WHERE status = 'menunggu') AS menunggu,
                COUNT(*) FILTER (WHERE status = 'terverifikasi' AND diverifikasi_pada::date = CURRENT_DATE) AS terverifikasi,
                COUNT(*) FILTER (WHERE status = 'ditolak' AND diverifikasi_pada::date = CURRENT_DATE) AS ditolak
         FROM pembayaran`),
  ]);
  return ok(rows, { status, jumlah });
}, { roles: ROLES.admin });
