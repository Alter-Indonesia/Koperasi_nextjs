import { ensureAssignmentsAhead } from "@/lib/queries";
import { q, one } from "@/lib/db";
import { handle, ok } from "@/lib/http";

// GET /api/v1/dashboard — ringkasan penagihan hari ini untuk Admin
export const GET = handle(async () => {
  await ensureAssignmentsAhead(0); // tugas hari ini semua petugas dibentuk dari anggota yang dipegang
  const [today, active, dueToday, paidToday, arrears, flow, pending, collectors] = await Promise.all([
    one<{ d: string }>("SELECT CURRENT_DATE::text AS d"),
    one(`SELECT COUNT(*) AS count, COALESCE(SUM(remaining_balance),0) AS outstanding, COUNT(DISTINCT member_id) AS members
         FROM v_loans WHERE status = 'aktif'`),
    one(`SELECT COUNT(*) AS count, COALESCE(SUM(i.total_amount),0) AS amount
         FROM installments i JOIN loans l ON l.id = i.loan_id
         WHERE l.status = 'aktif' AND l.deleted_at IS NULL AND i.due_date = CURRENT_DATE`),
    one(`SELECT COUNT(*) FILTER (WHERE i.due_date = CURRENT_DATE) AS from_due,
                COUNT(*) AS count, COALESCE(SUM(p.amount + p.penalty_amount),0) AS amount
         FROM payments p JOIN installments i ON i.id = p.installment_id
         WHERE p.paid_at::date = CURRENT_DATE AND p.status <> 'ditolak'`),
    one(`SELECT COALESCE(SUM(arrears_amount),0) AS amount,
                COUNT(DISTINCT member_id) FILTER (WHERE arrears_amount > 0) AS members,
                COALESCE(SUM(remaining_balance) FILTER (WHERE collectibility IN ('Kurang Lancar','Diragukan','Macet')),0)
                  / NULLIF(SUM(remaining_balance),0) AS npl
         FROM v_loans WHERE status = 'aktif'`),
    one(`SELECT
           (SELECT COUNT(*) FROM v_loans WHERE status = 'aktif') AS active_loans,
           (SELECT COUNT(*) FROM installments i JOIN loans l ON l.id = i.loan_id WHERE l.status='aktif' AND l.deleted_at IS NULL AND i.due_date = CURRENT_DATE) AS due,
           (SELECT COUNT(*) FROM reminder_logs WHERE sent_at::date = CURRENT_DATE AND status <> 'gagal') AS reminders,
           (SELECT COUNT(*) FROM payments WHERE paid_at::date = CURRENT_DATE AND status <> 'ditolak') AS payments,
           (SELECT COUNT(*) FROM payments WHERE status = 'menunggu') AS verifications,
           (SELECT COUNT(*) FROM payments WHERE verified_at::date = CURRENT_DATE AND status = 'terverifikasi') AS paid_off,
           (SELECT COUNT(*) FROM v_loans WHERE status = 'aktif' AND arrears_amount > 0) AS follow_up`),
    q(`SELECT p.id, p.amount + p.penalty_amount AS amount, p.method, p.method_note, p.paid_at,
              i.sequence AS installment_sequence, l.tenor_duration, l.tenor_unit, l.loan_number, m.name AS member_name, c.name AS collector_name
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN loans l ON l.id = i.loan_id
       JOIN members m ON m.id = l.member_id
       LEFT JOIN users c ON c.id = p.collector_id
       WHERE p.status = 'menunggu'
       ORDER BY p.paid_at DESC LIMIT 6`),
    q(`SELECT u.id, u.name, r.name AS region_name,
              COUNT(t.id) AS tasks,
              COUNT(t.id) FILTER (WHERE i.status <> 'belum') AS completed,
              COALESCE((SELECT SUM(p.amount + p.penalty_amount) FROM payments p
                        WHERE p.collector_id = u.id AND p.paid_at::date = CURRENT_DATE AND p.status <> 'ditolak'),0) AS collected
       FROM users u
       LEFT JOIN regions r ON r.id = u.region_id
       LEFT JOIN assignments t ON t.collector_id = u.id AND t.assigned_on = CURRENT_DATE
       LEFT JOIN installments i ON i.id = t.installment_id
       WHERE u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL
       GROUP BY u.id, r.name ORDER BY u.name`),
  ]);
  return ok({ date: today?.d, active, due_today: dueToday, paid_today: paidToday, arrears, flow, pending, collectors });
}, { module: "dashboard" });
