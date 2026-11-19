import { z } from "zod";
import { q, one } from "@/lib/db";
import { body, created, handle, HttpError, intParam, ok, ROLES } from "@/lib/http";

// GET /api/v1/anggota?wilayah_id=&q=&page=&limit=
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = intParam(sp.get("page"), 1);
  const limit = intParam(sp.get("limit"), 9, 1, 100);
  const wil = sp.get("wilayah_id") ? intParam(sp.get("wilayah_id"), 0, 1, 1e6) || null : null;
  const cari = sp.get("q")?.trim() || null;
  const base = `
    FROM anggota a
    JOIN wilayah w ON w.id = a.wilayah_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS jumlah, COALESCE(SUM(sisa),0) AS sisa, COALESCE(SUM(tunggakan),0) AS tunggakan
      FROM v_pinjaman v WHERE v.anggota_id = a.id AND v.status = 'aktif'
    ) p ON true
    WHERE ($1::int IS NULL OR a.wilayah_id = $1)
      AND ($2::text IS NULL OR a.nama ILIKE '%' || $2 || '%' OR a.no_anggota ILIKE '%' || $2 || '%' OR a.no_hp ILIKE '%' || $2 || '%')`;
  const [rows, total, stat] = await Promise.all([
    q(`SELECT a.id, a.no_anggota, a.nama, a.no_hp, a.bergabung, a.status, w.nama AS wilayah,
              a.simpanan_pokok + a.simpanan_wajib + a.simpanan_sukarela AS simpanan,
              p.jumlah AS pinjaman_aktif, p.sisa AS sisa_pinjaman, p.tunggakan,
              CASE WHEN a.status = 'nonaktif' THEN 'Nonaktif'
                   WHEN p.tunggakan > 0 THEN 'Menunggak'
                   WHEN a.bergabung >= date_trunc('month', CURRENT_DATE) THEN 'Baru'
                   ELSE 'Aktif' END AS status_label
       ${base} ORDER BY a.nama LIMIT $3 OFFSET $4`, [wil, cari, limit, (page - 1) * limit]),
    one<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, [wil, cari]),
    one(`SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE bergabung >= date_trunc('month', CURRENT_DATE)) AS baru,
                (SELECT COUNT(DISTINCT anggota_id) FROM pinjaman WHERE status = 'aktif') AS meminjam,
                (SELECT COUNT(DISTINCT anggota_id) FROM v_pinjaman WHERE status = 'aktif' AND tunggakan > 0) AS menunggak,
                COALESCE(SUM(simpanan_pokok + simpanan_wajib + simpanan_sukarela),0) AS simpanan
         FROM anggota`),
  ]);
  return ok(rows, { page, limit, total: total?.n ?? 0, statistik: stat });
}, { roles: ROLES.admin });

const AnggotaBaru = z.object({
  nama: z.string().trim().min(2).max(100),
  no_hp: z.string().trim().regex(/^[0-9+\- ]{8,20}$/, "Nomor HP tidak valid"),
  alamat: z.string().trim().min(5).max(200),
  wilayah_id: z.number().int().positive(),
  simpanan_pokok: z.number().int().min(0).default(100_000),
});

// POST /api/v1/anggota
export const POST = handle(async (req: Request) => {
  const d = await body(req, AnggotaBaru);
  if (!(await one("SELECT 1 FROM wilayah WHERE id = $1", [d.wilayah_id]))) throw new HttpError(422, "Wilayah tidak ditemukan");
  const r = await one(
    `INSERT INTO anggota (no_anggota, nama, no_hp, alamat, wilayah_id, simpanan_pokok)
     VALUES ('AG-' || LPAD(((SELECT COALESCE(MAX(id),0) FROM anggota) + 1000)::text, 4, '0'), $1, $2, $3, $4, $5)
     RETURNING id, no_anggota, nama`,
    [d.nama, d.no_hp, d.alamat, d.wilayah_id, d.simpanan_pokok],
  );
  return created(r);
}, { roles: ROLES.admin });
