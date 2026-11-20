import { q, one } from "@/lib/db";
import { currentUser, handle, ok } from "@/lib/http";

// GET /api/v1/petugas/tugas — tagihan yang ditugaskan ke petugas yang login untuk hari ini (telat lebih dulu)
export const GET = handle(async () => {
  const me = currentUser();
  const today = (await one<{ d: string }>("SELECT CURRENT_DATE::text AS d"))!.d;
  const rows = await q<{ status: string; total_amount: number }>(
    `SELECT i.id, i.sequence, i.due_date, i.total_amount, i.status, m.name AS member_name, m.address AS member_address, m.phone AS member_phone,
            r.name AS region_name, l.loan_number, l.tenor_duration, GREATEST(0, CURRENT_DATE - i.due_date) AS days_overdue
     FROM assignments a
     JOIN installments i ON i.id = a.installment_id
     JOIN loans l ON l.id = i.loan_id AND l.deleted_at IS NULL
     JOIN members m ON m.id = l.member_id AND m.deleted_at IS NULL
     JOIN regions r ON r.id = m.region_id
     WHERE a.collector_id = $1 AND a.assigned_on = CURRENT_DATE AND a.deleted_at IS NULL
     ORDER BY (i.status <> 'belum'), i.due_date, m.name`,
    [me.id],
  );
  const done = rows.filter((x) => x.status !== "belum");
  return ok(rows, {
    date: today,
    total: rows.length,
    done: done.length,
    amount_total: rows.reduce((s, x) => s + x.total_amount, 0),
    amount_done: done.reduce((s, x) => s + x.total_amount, 0),
  });
}, { module: "my_tasks" });
