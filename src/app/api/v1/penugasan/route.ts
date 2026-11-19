import { z } from "zod";
import { q, one } from "@/lib/db";
import { body, created, dateParam, handle, HttpError, ok, ROLES } from "@/lib/http";
import { BEBAN_MAKS_PETUGAS as BEBAN_MAKS, TAGIHAN_TERBUKA } from "@/lib/queries";

// GET /api/v1/penugasan?tanggal=YYYY-MM-DD (default: besok)
export const GET = handle(async (req: Request) => {
  const tgl = dateParam(new URL(req.url).searchParams.get("tanggal"));
  const tanggal = (await one<{ d: string }>("SELECT COALESCE($1::date, CURRENT_DATE + 1)::text AS d", [tgl]))!.d;
  const [belum, petugas, tugas] = await Promise.all([
    q(`SELECT t.* FROM (${TAGIHAN_TERBUKA}) t
       WHERE NOT EXISTS (SELECT 1 FROM penugasan s WHERE s.angsuran_id = t.id AND s.tanggal = $1::date)
       ORDER BY t.jatuh_tempo, t.anggota`, [tanggal]),
    q(`SELECT u.id, u.kode, u.nama, u.wilayah_id, w.nama AS wilayah
       FROM pengguna u LEFT JOIN wilayah w ON w.id = u.wilayah_id
       WHERE u.role = 'petugas' AND u.status = 'aktif' ORDER BY u.nama`),
    q(`SELECT s.petugas_id, a.id AS angsuran_id, a.total, ag.nama AS anggota
       FROM penugasan s JOIN angsuran a ON a.id = s.angsuran_id
       JOIN pinjaman p ON p.id = a.pinjaman_id JOIN anggota ag ON ag.id = p.anggota_id
       WHERE s.tanggal = $1::date ORDER BY a.total DESC`, [tanggal]),
  ]);
  const byPetugas = petugas.map((p) => {
    const list = tugas.filter((t) => t.petugas_id === p.id);
    return { ...p, beban: list.length, beban_maks: BEBAN_MAKS, tugas: list };
  });
  return ok({ tanggal, belum, petugas: byPetugas });
}, { roles: ROLES.admin });

const Tugaskan = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  petugas_id: z.number().int().positive(),
  angsuran_ids: z.array(z.number().int().positive()).min(1).max(200),
});

// POST /api/v1/penugasan — tugaskan angsuran terpilih ke satu petugas
export const POST = handle(async (req: Request) => {
  const d = await body(req, Tugaskan);
  const p = await one("SELECT id FROM pengguna WHERE id = $1 AND role = 'petugas' AND status = 'aktif'", [d.petugas_id]);
  if (!p) throw new HttpError(404, "Petugas tidak ditemukan");
  const rows = await q(
    `INSERT INTO penugasan (angsuran_id, petugas_id, tanggal)
     SELECT a.id, $1, $2::date FROM angsuran a WHERE a.id = ANY($3::int[]) AND a.status = 'belum'
     ON CONFLICT (angsuran_id, tanggal) DO UPDATE SET petugas_id = EXCLUDED.petugas_id
     RETURNING id`,
    [d.petugas_id, d.tanggal, d.angsuran_ids],
  );
  return created({ ditugaskan: rows.length });
}, { roles: ROLES.admin });
