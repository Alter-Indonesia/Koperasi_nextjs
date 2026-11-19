import { q, one } from "@/lib/db";
import { handle, ok, ROLES } from "@/lib/http";

// GET /api/v1/dashboard — ringkasan penagihan hari ini untuk Admin
export const GET = handle(async () => {
  const [hari, aktif, jatuhTempo, terbayar, tunggakan, alur, menunggu, kinerja] = await Promise.all([
    one<{ d: string }>("SELECT CURRENT_DATE::text AS d"),
    one(`SELECT COUNT(*) AS jumlah, COALESCE(SUM(sisa),0) AS outstanding, COUNT(DISTINCT anggota_id) AS anggota
         FROM v_pinjaman WHERE status = 'aktif'`),
    one(`SELECT COUNT(*) AS jumlah, COALESCE(SUM(a.total),0) AS nominal
         FROM angsuran a JOIN pinjaman p ON p.id = a.pinjaman_id
         WHERE p.status = 'aktif' AND a.jatuh_tempo = CURRENT_DATE`),
    one(`SELECT COUNT(*) FILTER (WHERE a.jatuh_tempo = CURRENT_DATE) AS dari_jatuh_tempo,
                COUNT(*) AS jumlah, COALESCE(SUM(b.nominal + b.denda),0) AS nominal
         FROM pembayaran b JOIN angsuran a ON a.id = b.angsuran_id
         WHERE b.dibayar_pada::date = CURRENT_DATE AND b.status <> 'ditolak'`),
    one(`SELECT COALESCE(SUM(tunggakan),0) AS nominal,
                COUNT(DISTINCT anggota_id) FILTER (WHERE tunggakan > 0) AS anggota,
                COALESCE(SUM(sisa) FILTER (WHERE kolektibilitas IN ('Kurang Lancar','Diragukan','Macet')),0)
                  / NULLIF(SUM(sisa),0) AS npl
         FROM v_pinjaman WHERE status = 'aktif'`),
    one(`SELECT
           (SELECT COUNT(*) FROM pinjaman WHERE status = 'aktif') AS data_pinjaman,
           (SELECT COUNT(*) FROM angsuran a JOIN pinjaman p ON p.id = a.pinjaman_id WHERE p.status='aktif' AND a.jatuh_tempo = CURRENT_DATE) AS jatuh_tempo,
           (SELECT COUNT(*) FROM pengingat_log WHERE dikirim_pada::date = CURRENT_DATE AND status <> 'gagal') AS pengingat,
           (SELECT COUNT(*) FROM pembayaran WHERE dibayar_pada::date = CURRENT_DATE AND status <> 'ditolak') AS pembayaran,
           (SELECT COUNT(*) FROM pembayaran WHERE status = 'menunggu') AS verifikasi,
           (SELECT COUNT(*) FROM pembayaran WHERE diverifikasi_pada::date = CURRENT_DATE AND status = 'terverifikasi') AS lunas,
           (SELECT COUNT(*) FROM v_pinjaman WHERE status = 'aktif' AND tunggakan > 0) AS lanjutan`),
    q(`SELECT b.id, b.nominal + b.denda AS nominal, b.metode, b.keterangan_metode, b.dibayar_pada,
              a.ke, p.tenor, p.no_pinjaman, ag.nama AS anggota, pt.nama AS petugas
       FROM pembayaran b
       JOIN angsuran a ON a.id = b.angsuran_id
       JOIN pinjaman p ON p.id = a.pinjaman_id
       JOIN anggota ag ON ag.id = p.anggota_id
       LEFT JOIN pengguna pt ON pt.id = b.petugas_id
       WHERE b.status = 'menunggu'
       ORDER BY b.dibayar_pada DESC LIMIT 6`),
    q(`SELECT u.id, u.nama, w.nama AS wilayah,
              COUNT(t.id) AS tugas,
              COUNT(t.id) FILTER (WHERE a.status <> 'belum') AS selesai,
              COALESCE((SELECT SUM(b.nominal + b.denda) FROM pembayaran b
                        WHERE b.petugas_id = u.id AND b.dibayar_pada::date = CURRENT_DATE AND b.status <> 'ditolak'),0) AS terkumpul
       FROM pengguna u
       LEFT JOIN wilayah w ON w.id = u.wilayah_id
       LEFT JOIN penugasan t ON t.petugas_id = u.id AND t.tanggal = CURRENT_DATE
       LEFT JOIN angsuran a ON a.id = t.angsuran_id
       WHERE u.role = 'petugas' AND u.status = 'aktif'
       GROUP BY u.id, w.nama ORDER BY u.nama`),
  ]);
  return ok({ tanggal: hari?.d, aktif, jatuhTempo, terbayar, tunggakan, alur, menunggu, kinerja });
}, { roles: ROLES.admin });
