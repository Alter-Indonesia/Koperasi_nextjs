import "server-only";

export const BEBAN_MAKS_PETUGAS = 30;

/** Angsuran tertua yang belum dibayar per pinjaman, sudah/akan jatuh tempo s.d. tanggal $1 */
export const TAGIHAN_TERBUKA = `
  SELECT DISTINCT ON (a.pinjaman_id) a.id, a.pinjaman_id, a.ke, a.jatuh_tempo, a.total,
         ag.nama AS anggota, ag.alamat, ag.wilayah_id, w.nama AS wilayah, p.no_pinjaman
  FROM angsuran a
  JOIN pinjaman p ON p.id = a.pinjaman_id AND p.status = 'aktif'
  JOIN anggota ag ON ag.id = p.anggota_id
  JOIN wilayah w ON w.id = ag.wilayah_id
  WHERE a.status = 'belum' AND a.jatuh_tempo <= $1::date
  ORDER BY a.pinjaman_id, a.jatuh_tempo`;
