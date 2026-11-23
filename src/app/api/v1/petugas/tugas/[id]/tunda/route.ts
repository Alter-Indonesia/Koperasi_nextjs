import { z } from "zod";
import { tx } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, idParam } from "@/lib/http";
import { ensureAssignmentsAhead } from "@/lib/queries";

const Postpone = z.object({
  promised_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal janji tidak valid"),
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter").max(300),
});
const MAX_DAYS = 30;

// POST /api/v1/petugas/tugas/{id}/tunda — tunda tagihan (id = angsuran) ke tanggal yang dijanjikan anggota, beserta alasannya.
// Tagihan ikut ditugaskan ke petugas yang sama pada tanggal janji.
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/petugas/tugas/[id]/tunda">) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, Postpone);
  const me = currentUser();
  await ensureAssignmentsAhead(0, me.id);
  const res = await tx(async (c) => {
    const i = (await c.query<{ status: string; ok: boolean }>(
      `SELECT i.status, ($2::date > CURRENT_DATE AND $2::date <= CURRENT_DATE + $3::int) AS ok FROM installments i
       WHERE i.id = $1 AND i.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM assignments a WHERE a.installment_id = i.id AND a.collector_id = $4 AND a.assigned_on = CURRENT_DATE AND a.deleted_at IS NULL)
       FOR UPDATE OF i`, [id, d.promised_on, MAX_DAYS, me.id],
    )).rows[0];
    if (!i) throw new HttpError(404, "Tagihan tidak ditemukan di tugas Anda hari ini");
    if (i.status !== "belum") throw new HttpError(409, "Tagihan ini sudah dibayar / menunggu verifikasi");
    if (!i.ok) throw new HttpError(422, `Tanggal janji harus setelah hari ini dan paling lama ${MAX_DAYS} hari ke depan`);
    const p = (await c.query<{ id: number }>(
      `INSERT INTO payment_promises (installment_id, collector_id, promised_on, reason, created_by, updated_by) VALUES ($1, $2, $3, $4, $2, $2) RETURNING id`,
      [id, me.id, d.promised_on, d.reason],
    )).rows[0];
    await c.query(
      `INSERT INTO assignments (installment_id, collector_id, assigned_on, created_by, updated_by) VALUES ($1, $2, $3, $2, $2)
       ON CONFLICT (installment_id, assigned_on) DO UPDATE SET collector_id = EXCLUDED.collector_id, updated_by = EXCLUDED.updated_by`,
      [id, me.id, d.promised_on],
    );
    return { id: p.id, promised_on: d.promised_on };
  });
  return created(res);
}, { module: "my_tasks", action: "create", log: "postpone" });
