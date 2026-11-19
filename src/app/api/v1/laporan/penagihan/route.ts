import { q, one } from "@/lib/db";
import { dateParam, handle, intParam, ok, ROLES } from "@/lib/http";

// GET /api/v1/laporan/penagihan?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&wilayah_id=
// Default: awal bulan ini s.d. hari ini.
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const range = (await one<{ dari: string; sampai: string }>(
    `SELECT COALESCE($1::date, date_trunc('month', CURRENT_DATE)::date)::text AS dari, COALESCE($2::date, CURRENT_DATE)::text AS sampai`,
    [dateParam(sp.get("dari")), dateParam(sp.get("sampai"))],
  ))!;
  const wil = sp.get("wilayah_id") ? intParam(sp.get("wilayah_id"), 0, 1, 1e6) || null : null;
  const P = [range.dari, range.sampai, wil];
  // angsuran yang jatuh tempo di periode (basis "ditagih")
  const DITAGIH = `
    FROM angsuran a
    JOIN pinjaman p ON p.id = a.pinjaman_id AND p.status IN ('aktif','lunas')
    JOIN anggota ag ON ag.id = p.anggota_id
    WHERE a.jatuh_tempo BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR ag.wilayah_id = $3)`;
  const [kpi, perPetugas, metode, harian, aging, lanjutan] = await Promise.all([
    one(`SELECT COUNT(*) AS ditagih, COALESCE(SUM(a.total),0) AS ditagih_nominal,
                COUNT(*) FILTER (WHERE a.status <> 'belum') AS terbayar,
                COALESCE(SUM(a.total) FILTER (WHERE a.status <> 'belum'),0) AS terkumpul,
                COUNT(*) FILTER (WHERE a.status = 'belum' AND a.jatuh_tempo < CURRENT_DATE) AS tunggakan,
                COALESCE(SUM(a.total) FILTER (WHERE a.status = 'belum' AND a.jatuh_tempo < CURRENT_DATE),0) AS tunggakan_nominal
         ${DITAGIH}`, P),
    q(`SELECT u.id, u.nama, w.nama AS wilayah,
              COUNT(a.id) AS tagihan,
              COUNT(a.id) FILTER (WHERE a.status <> 'belum') AS terbayar,
              COALESCE(SUM(a.total) FILTER (WHERE a.status <> 'belum'),0) AS terkumpul,
              COALESCE(SUM(a.total) FILTER (WHERE a.status = 'belum' AND a.jatuh_tempo < CURRENT_DATE),0) AS tunggakan
       FROM pengguna u
       JOIN wilayah w ON w.id = u.wilayah_id
       LEFT JOIN anggota ag ON ag.wilayah_id = u.wilayah_id
       LEFT JOIN pinjaman p ON p.anggota_id = ag.id AND p.status IN ('aktif','lunas')
       LEFT JOIN angsuran a ON a.pinjaman_id = p.id AND a.jatuh_tempo BETWEEN $1::date AND $2::date
       WHERE u.role = 'petugas' AND ($3::int IS NULL OR u.wilayah_id = $3)
       GROUP BY u.id, w.nama ORDER BY u.nama`, P),
    q(`SELECT b.metode, COUNT(*) AS jumlah, COALESCE(SUM(b.nominal + b.denda),0) AS nominal
       FROM pembayaran b JOIN angsuran a ON a.id = b.angsuran_id JOIN pinjaman p ON p.id = a.pinjaman_id JOIN anggota ag ON ag.id = p.anggota_id
       WHERE b.status <> 'ditolak' AND b.dibayar_pada::date BETWEEN $1::date AND $2::date AND ($3::int IS NULL OR ag.wilayah_id = $3)
       GROUP BY b.metode ORDER BY nominal DESC`, P),
    q(`SELECT d::date::text AS tanggal, COALESCE(SUM(b.nominal + b.denda),0) AS nominal
       FROM generate_series($1::date, $2::date, '1 day') d
       LEFT JOIN pembayaran b ON b.dibayar_pada::date = d::date AND b.status <> 'ditolak'
         AND ($3::int IS NULL OR EXISTS (SELECT 1 FROM angsuran a JOIN pinjaman p ON p.id = a.pinjaman_id JOIN anggota ag ON ag.id = p.anggota_id WHERE a.id = b.angsuran_id AND ag.wilayah_id = $3))
       WHERE EXTRACT(ISODOW FROM d) < 7
       GROUP BY d ORDER BY d`, P),
    q(`SELECT kelompok, COUNT(*) AS anggota, COALESCE(SUM(tunggakan),0) AS nominal FROM (
         SELECT CASE WHEN hari_telat <= 30 THEN '1–30 hari' WHEN hari_telat <= 60 THEN '31–60 hari' WHEN hari_telat <= 90 THEN '61–90 hari' ELSE '> 90 hari' END AS kelompok,
                tunggakan
         FROM v_pinjaman WHERE status = 'aktif' AND hari_telat > 0 AND ($3::int IS NULL OR wilayah_id = $3)) x
       WHERE $1::date IS NOT NULL AND $2::date IS NOT NULL
       GROUP BY kelompok`, P),
    one(`SELECT COUNT(*) FILTER (WHERE hari_telat >= 3 AND hari_telat < 7) AS telepon,
                COUNT(*) FILTER (WHERE hari_telat >= 7 AND hari_telat < 30) AS surat_1,
                COUNT(*) FILTER (WHERE hari_telat >= 30 AND hari_telat <= 90) AS surat_2,
                COUNT(*) FILTER (WHERE hari_telat > 90) AS eskalasi
         FROM v_pinjaman WHERE status = 'aktif' AND ($1::date IS NOT NULL) AND ($2::date IS NOT NULL) AND ($3::int IS NULL OR wilayah_id = $3)`, P),
  ]);
  const URUT = ["1–30 hari", "31–60 hari", "61–90 hari", "> 90 hari"];
  return ok(
    {
      kpi,
      perPetugas,
      metode,
      harian,
      aging: URUT.map((k) => aging.find((a) => a.kelompok === k) ?? { kelompok: k, anggota: 0, nominal: 0 }),
      lanjutan,
    },
    range,
  );
}, { roles: ROLES.admin });
