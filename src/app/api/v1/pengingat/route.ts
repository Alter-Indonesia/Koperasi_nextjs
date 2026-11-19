import { q, one } from "@/lib/db";
import { handle, ok, ROLES } from "@/lib/http";

// GET /api/v1/pengingat — saluran, aturan jadwal, template pesan, dan log pengiriman hari ini
export const GET = handle(async () => {
  const [saluran, aturan, template, statistik, log] = await Promise.all([
    q("SELECT kode, nama, deskripsi, aktif FROM pengingat_saluran ORDER BY urutan"),
    q("SELECT id, offset_hari, judul, keterangan FROM pengingat_aturan ORDER BY urutan"),
    q("SELECT kode, saluran, isi FROM pengingat_template ORDER BY CASE kode WHEN 'H-3' THEN 1 WHEN 'H-1' THEN 2 WHEN 'HARI_H' THEN 3 ELSE 4 END"),
    one(`SELECT COUNT(*) AS terkirim, COUNT(*) FILTER (WHERE status = 'dibaca') AS dibaca, COUNT(*) FILTER (WHERE status = 'gagal') AS gagal
         FROM pengingat_log WHERE dikirim_pada::date = CURRENT_DATE`),
    q(`SELECT l.id, l.saluran, l.status, l.dikirim_pada, l.keterangan, ag.nama AS anggota
       FROM pengingat_log l JOIN angsuran a ON a.id = l.angsuran_id JOIN pinjaman p ON p.id = a.pinjaman_id JOIN anggota ag ON ag.id = p.anggota_id
       WHERE l.dikirim_pada::date = CURRENT_DATE
       ORDER BY (l.status = 'gagal') DESC, l.dikirim_pada DESC LIMIT 5`),
  ]);
  return ok({ saluran, aturan, template, statistik, log });
}, { roles: ROLES.admin });
