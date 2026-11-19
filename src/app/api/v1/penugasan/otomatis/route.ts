import { z } from "zod";
import { q } from "@/lib/db";
import { body, created, handle, ROLES } from "@/lib/http";
import { TAGIHAN_TERBUKA } from "@/lib/queries";

const Otomatis = z.object({ tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// POST /api/v1/penugasan/otomatis — bagi tagihan yang belum ditugaskan ke petugas sesuai wilayah anggota
export const POST = handle(async (req: Request) => {
  const { tanggal } = await body(req, Otomatis);
  const rows = await q(
    `INSERT INTO penugasan (angsuran_id, petugas_id, tanggal)
     SELECT t.id, u.id, $1::date
     FROM (${TAGIHAN_TERBUKA}) t
     JOIN LATERAL (SELECT id FROM pengguna WHERE role = 'petugas' AND status = 'aktif' AND wilayah_id = t.wilayah_id ORDER BY id LIMIT 1) u ON true
     WHERE NOT EXISTS (SELECT 1 FROM penugasan s WHERE s.angsuran_id = t.id AND s.tanggal = $1::date)
     RETURNING id`,
    [tanggal],
  );
  return created({ ditugaskan: rows.length });
}, { roles: ROLES.admin });
