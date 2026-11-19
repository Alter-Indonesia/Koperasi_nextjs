import { z } from "zod";
import { q } from "@/lib/db";
import { body, created, handle, HttpError, ROLES } from "@/lib/http";

const Kirim = z.object({
  angsuran_ids: z.array(z.number().int().positive()).min(1).max(500).optional(),
  semua_jatuh_tempo: z.boolean().optional(),
  saluran: z.enum(["whatsapp", "sms"]).default("whatsapp"),
});

// POST /api/v1/pengingat/kirim — antrekan pengingat untuk angsuran tertentu atau semua yang belum dibayar s.d. hari ini.
// Catatan: integrasi gateway WhatsApp/SMS belum ada; pengingat dicatat di pengingat_log dengan status "terkirim".
export const POST = handle(async (req: Request) => {
  const d = await body(req, Kirim);
  if (!d.semua_jatuh_tempo && !d.angsuran_ids?.length) throw new HttpError(400, "Pilih angsuran yang akan diingatkan");
  const saluran = await q<{ aktif: boolean }>("SELECT aktif FROM pengingat_saluran WHERE kode = $1", [d.saluran]);
  if (!saluran[0]?.aktif) throw new HttpError(422, `Saluran ${d.saluran} sedang dinonaktifkan`);
  const rows = d.semua_jatuh_tempo
    ? await q(
        `INSERT INTO pengingat_log (angsuran_id, saluran, status)
         SELECT a.id, $1, 'terkirim' FROM angsuran a JOIN pinjaman p ON p.id = a.pinjaman_id
         WHERE p.status = 'aktif' AND a.status = 'belum' AND a.jatuh_tempo <= CURRENT_DATE
         RETURNING id`,
        [d.saluran],
      )
    : await q(
        `INSERT INTO pengingat_log (angsuran_id, saluran, status)
         SELECT a.id, $1, 'terkirim' FROM angsuran a WHERE a.id = ANY($2::int[]) AND a.status = 'belum'
         RETURNING id`,
        [d.saluran, d.angsuran_ids ?? []],
      );
  return created({ terkirim: rows.length, saluran: d.saluran });
}, { roles: ROLES.admin });
