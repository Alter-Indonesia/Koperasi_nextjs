import { q, one } from "@/lib/db";
import { dateParam, handle, ok, ROLES } from "@/lib/http";

// GET /api/v1/jatuh-tempo?tanggal=YYYY-MM-DD&status=semua|belum|telat
// Daftar angsuran yang jatuh tempo pada tanggal tsb + tunggakan sebelumnya, dengan ringkasan mingguan.
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const tgl = dateParam(sp.get("tanggal"));
  const status = ["belum", "telat"].includes(sp.get("status") ?? "") ? sp.get("status") : "semua";
  const [hari, minggu, ringkas, rows] = await Promise.all([
    one<{ d: string }>("SELECT COALESCE($1::date, CURRENT_DATE)::text AS d", [tgl]),
    q(`WITH h AS (SELECT COALESCE($1::date, CURRENT_DATE) AS d),
            w AS (SELECT generate_series(date_trunc('week', (SELECT d FROM h))::date, date_trunc('week', (SELECT d FROM h))::date + 6, '1 day')::date AS tanggal)
       SELECT w.tanggal::text AS tanggal,
              (SELECT COUNT(*) FROM angsuran a JOIN pinjaman p ON p.id = a.pinjaman_id WHERE p.status = 'aktif' AND a.jatuh_tempo = w.tanggal) AS jumlah
       FROM w ORDER BY w.tanggal`, [tgl]),
    one(`WITH h AS (SELECT COALESCE($1::date, CURRENT_DATE) AS d)
         SELECT
           COUNT(*) FILTER (WHERE a.status = 'belum' AND a.jatuh_tempo < h.d) AS lewat,
           COALESCE(SUM(a.total) FILTER (WHERE a.status = 'belum' AND a.jatuh_tempo < h.d),0) AS lewat_nominal,
           COUNT(*) FILTER (WHERE a.jatuh_tempo = h.d) AS hari_ini,
           COALESCE(SUM(a.total) FILTER (WHERE a.jatuh_tempo = h.d),0) AS hari_ini_nominal,
           COUNT(*) FILTER (WHERE a.jatuh_tempo = h.d + 1) AS besok,
           COALESCE(SUM(a.total) FILTER (WHERE a.jatuh_tempo = h.d + 1),0) AS besok_nominal,
           COUNT(*) FILTER (WHERE a.jatuh_tempo = h.d + 3) AS h3,
           COALESCE(SUM(a.total) FILTER (WHERE a.jatuh_tempo = h.d + 3),0) AS h3_nominal
         FROM angsuran a JOIN pinjaman p ON p.id = a.pinjaman_id, h
         WHERE p.status = 'aktif'`, [tgl]),
    q(`WITH h AS (SELECT COALESCE($1::date, CURRENT_DATE) AS d)
       SELECT a.id, a.ke, a.jatuh_tempo, a.total, a.status, p.tenor, p.no_pinjaman,
              ag.nama AS anggota, w.nama AS wilayah,
              COALESCE(tp.nama, wp.nama) AS petugas,
              GREATEST(0, (SELECT d FROM h) - a.jatuh_tempo) AS hari_telat,
              lg.saluran AS pengingat_saluran, lg.status AS pengingat_status
       FROM angsuran a
       JOIN pinjaman p ON p.id = a.pinjaman_id AND p.status = 'aktif'
       JOIN anggota ag ON ag.id = p.anggota_id
       JOIN wilayah w ON w.id = ag.wilayah_id
       LEFT JOIN LATERAL (SELECT u.nama FROM penugasan t JOIN pengguna u ON u.id = t.petugas_id WHERE t.angsuran_id = a.id ORDER BY t.tanggal DESC LIMIT 1) tp ON true
       LEFT JOIN LATERAL (SELECT u.nama FROM pengguna u WHERE u.role = 'petugas' AND u.wilayah_id = ag.wilayah_id LIMIT 1) wp ON true
       LEFT JOIN LATERAL (SELECT l.saluran, l.status FROM pengingat_log l WHERE l.angsuran_id = a.id ORDER BY l.dikirim_pada DESC LIMIT 1) lg ON true
       WHERE (a.jatuh_tempo = (SELECT d FROM h) OR (a.status = 'belum' AND a.jatuh_tempo < (SELECT d FROM h)))
         AND ($2 = 'semua'
              OR ($2 = 'belum' AND a.status = 'belum' AND a.jatuh_tempo = (SELECT d FROM h))
              OR ($2 = 'telat' AND a.status = 'belum' AND a.jatuh_tempo < (SELECT d FROM h)))
       ORDER BY (a.status <> 'belum'), a.jatuh_tempo DESC, ag.nama
       LIMIT 200`, [tgl, status]),
  ]);
  return ok(rows, { tanggal: hari?.d, minggu, ringkas, status });
}, { roles: ROLES.admin });
