import { q, one } from "@/lib/db";
import { currentUser, handle, ok } from "@/lib/http";
import { getSetting } from "@/lib/settings";

// GET /api/v1/petugas/tugas — tagihan yang ditugaskan ke petugas yang login untuk hari ini (belum dibayar & telat lebih dulu)
export const GET = handle(async () => {
  const me = currentUser();
  const [today, rows, cash, transfer, bankName, bankNumber, bankHolder] = await Promise.all([
    one<{ d: string }>("SELECT CURRENT_DATE::text AS d"),
    q<{ status: string; total_amount: number; promised_on: string | null }>(
      `SELECT i.id, i.sequence, i.due_date, i.total_amount, i.status, m.name AS member_name, m.address AS member_address, m.phone AS member_phone,
              r.name AS region_name, l.loan_number, l.tenor_duration, GREATEST(0, CURRENT_DATE - i.due_date) AS days_overdue,
              pr.promised_on, pr.reason AS promise_reason
       FROM assignments a
       JOIN installments i ON i.id = a.installment_id
       JOIN loans l ON l.id = i.loan_id AND l.deleted_at IS NULL
       JOIN members m ON m.id = l.member_id AND m.deleted_at IS NULL
       JOIN regions r ON r.id = m.region_id
       LEFT JOIN LATERAL (
         SELECT p.promised_on, p.reason FROM payment_promises p
         WHERE p.installment_id = i.id AND p.deleted_at IS NULL AND p.promised_on > CURRENT_DATE ORDER BY p.created_at DESC LIMIT 1
       ) pr ON true
       WHERE a.collector_id = $1 AND a.assigned_on = CURRENT_DATE AND a.deleted_at IS NULL
       ORDER BY (i.status <> 'belum'), (pr.promised_on IS NOT NULL), i.due_date, m.name`,
      [me.id],
    ),
    getSetting("payment_cash_enabled", true),
    getSetting("payment_transfer_enabled", true),
    getSetting("bank_name", ""),
    getSetting("bank_account_number", ""),
    getSetting("bank_account_name", ""),
  ]);
  const done = rows.filter((x) => x.status !== "belum");
  const postponed = rows.filter((x) => x.status === "belum" && x.promised_on);
  return ok(rows, {
    date: today!.d,
    total: rows.length,
    done: done.length,
    postponed: postponed.length,
    amount_total: rows.reduce((s, x) => s + x.total_amount, 0),
    amount_done: done.reduce((s, x) => s + x.total_amount, 0),
    methods: { tunai: cash, transfer },
    bank: { name: bankName, number: bankNumber, holder: bankHolder },
  });
}, { module: "my_tasks" });
