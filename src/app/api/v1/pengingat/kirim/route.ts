import { z } from "zod";
import { q } from "@/lib/db";
import { body, created, currentUser, handle, HttpError } from "@/lib/http";

const Send = z.object({
  installment_ids: z.array(z.number().int().positive()).min(1).max(500).optional(),
  all_due: z.boolean().optional(),
  channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
});

// POST /api/v1/pengingat/kirim — antrekan pengingat untuk angsuran tertentu atau semua yang belum dibayar s.d. hari ini.
// Catatan: integrasi gateway WhatsApp/SMS belum ada; pengingat dicatat di reminder_logs dengan status "terkirim".
export const POST = handle(async (req: Request) => {
  const d = await body(req, Send);
  if (!d.all_due && !d.installment_ids?.length) throw new HttpError(400, "Pilih angsuran yang akan diingatkan");
  const channel = await q<{ is_active: boolean }>("SELECT is_active FROM reminder_channels WHERE code = $1", [d.channel]);
  if (!channel[0]?.is_active) throw new HttpError(422, `Saluran ${d.channel} sedang dinonaktifkan`);
  const rows = d.all_due
    ? await q(
        `INSERT INTO reminder_logs (installment_id, channel, status, created_by, updated_by)
         SELECT i.id, $1, 'terkirim', $2::int, $2::int FROM installments i JOIN loans l ON l.id = i.loan_id
         WHERE l.status = 'aktif' AND l.deleted_at IS NULL AND i.status = 'belum' AND i.due_date <= CURRENT_DATE
         RETURNING id`,
        [d.channel, currentUser().id],
      )
    : await q(
        `INSERT INTO reminder_logs (installment_id, channel, status, created_by, updated_by)
         SELECT i.id, $1, 'terkirim', $3::int, $3::int FROM installments i WHERE i.id = ANY($2::int[]) AND i.status = 'belum'
         RETURNING id`,
        [d.channel, d.installment_ids ?? [], currentUser().id],
      );
  return created({ sent: rows.length, channel: d.channel });
}, { module: "reminders", log: "send" });
