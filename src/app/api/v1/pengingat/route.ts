import { q, one } from "@/lib/db";
import { handle, ok } from "@/lib/http";

// GET /api/v1/pengingat — saluran, aturan jadwal, template pesan, dan log pengiriman hari ini
export const GET = handle(async () => {
  const [channels, rules, templates, stats, logs] = await Promise.all([
    q("SELECT code, name, description, is_active FROM reminder_channels ORDER BY sort_order"),
    q("SELECT id, day_offset, title, description FROM reminder_rules ORDER BY sort_order"),
    q("SELECT code, channel, body FROM reminder_templates ORDER BY CASE code WHEN 'H-3' THEN 1 WHEN 'H-1' THEN 2 WHEN 'HARI_H' THEN 3 ELSE 4 END"),
    one(`SELECT COUNT(*) AS sent, COUNT(*) FILTER (WHERE status = 'dibaca') AS read, COUNT(*) FILTER (WHERE status = 'gagal') AS failed
         FROM reminder_logs WHERE sent_at::date = CURRENT_DATE`),
    q(`SELECT g.id, g.channel, g.status, g.sent_at, g.notes, m.name AS member_name
       FROM reminder_logs g JOIN installments i ON i.id = g.installment_id JOIN loans l ON l.id = i.loan_id JOIN members m ON m.id = l.member_id
       WHERE g.sent_at::date = CURRENT_DATE
       ORDER BY (g.status = 'gagal') DESC, g.sent_at DESC LIMIT 5`),
  ]);
  return ok({ channels, rules, templates, stats, logs });
}, { module: "reminders" });
