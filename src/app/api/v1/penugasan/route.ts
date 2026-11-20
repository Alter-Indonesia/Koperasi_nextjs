import { z } from "zod";
import { q, one } from "@/lib/db";
import { body, created, currentUser, dateParam, handle, HttpError, ok } from "@/lib/http";
import { MAX_COLLECTOR_LOAD, TAGIHAN_TERBUKA } from "@/lib/queries";

// GET /api/v1/penugasan?date=YYYY-MM-DD (default: besok)
export const GET = handle(async (req: Request) => {
  const dateInput = dateParam(new URL(req.url).searchParams.get("date"));
  const date = (await one<{ d: string }>("SELECT COALESCE($1::date, CURRENT_DATE + 1)::text AS d", [dateInput]))!.d;
  const [unassigned, collectors, tasks] = await Promise.all([
    q(`SELECT t.* FROM (${TAGIHAN_TERBUKA}) t
       WHERE NOT EXISTS (SELECT 1 FROM assignments s WHERE s.installment_id = t.id AND s.assigned_on = $1::date)
       ORDER BY t.due_date, t.member_name`, [date]),
    q(`SELECT u.id, u.code, u.name, u.region_id, r.name AS region_name
       FROM users u LEFT JOIN regions r ON r.id = u.region_id
       WHERE u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL ORDER BY u.name`),
    q(`SELECT s.collector_id, i.id AS installment_id, i.total_amount, m.name AS member_name
       FROM assignments s JOIN installments i ON i.id = s.installment_id
       JOIN loans l ON l.id = i.loan_id JOIN members m ON m.id = l.member_id
       WHERE s.assigned_on = $1::date ORDER BY i.total_amount DESC`, [date]),
  ]);
  const byCollector = collectors.map((c) => {
    const list = tasks.filter((t) => t.collector_id === c.id);
    return { ...c, load: list.length, max_load: MAX_COLLECTOR_LOAD, tasks: list };
  });
  return ok({ date, unassigned, collectors: byCollector });
}, { module: "assignments" });

const Assign = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  collector_id: z.number().int().positive(),
  installment_ids: z.array(z.number().int().positive()).min(1).max(200),
});

// POST /api/v1/penugasan — tugaskan angsuran terpilih ke satu petugas
export const POST = handle(async (req: Request) => {
  const d = await body(req, Assign);
  const p = await one("SELECT id FROM users WHERE id = $1 AND role = 'petugas' AND status = 'aktif' AND deleted_at IS NULL", [d.collector_id]);
  if (!p) throw new HttpError(404, "Petugas tidak ditemukan");
  const rows = await q(
    `INSERT INTO assignments (installment_id, collector_id, assigned_on, created_by, updated_by)
     SELECT i.id, $1, $2::date, $4::int, $4::int FROM installments i WHERE i.id = ANY($3::int[]) AND i.status = 'belum'
     ON CONFLICT (installment_id, assigned_on) DO UPDATE SET collector_id = EXCLUDED.collector_id, updated_by = EXCLUDED.updated_by
     RETURNING id`,
    [d.collector_id, d.date, d.installment_ids, currentUser().id],
  );
  return created({ assigned: rows.length });
}, { module: "assignments" });
