import { z } from "zod";
import { q } from "@/lib/db";
import { body, created, currentUser, handle } from "@/lib/http";
import { TAGIHAN_TERBUKA } from "@/lib/queries";

const Auto = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// POST /api/v1/penugasan/otomatis — bagi tagihan yang belum ditugaskan ke petugas sesuai wilayah anggota
export const POST = handle(async (req: Request) => {
  const { date } = await body(req, Auto);
  const rows = await q(
    `INSERT INTO assignments (installment_id, collector_id, assigned_on, created_by, updated_by)
     SELECT t.id, u.id, $1::date, $2::int, $2::int
     FROM (${TAGIHAN_TERBUKA}) t
     JOIN LATERAL (SELECT id FROM users WHERE role = 'petugas' AND status = 'aktif' AND deleted_at IS NULL AND region_id = t.region_id ORDER BY id LIMIT 1) u ON true
     WHERE NOT EXISTS (SELECT 1 FROM assignments s WHERE s.installment_id = t.id AND s.assigned_on = $1::date)
     RETURNING id`,
    [date, currentUser().id],
  );
  return created({ assigned: rows.length });
}, { module: "assignments", log: "auto_assign" });
