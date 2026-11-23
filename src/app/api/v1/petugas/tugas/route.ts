import { q, one } from "@/lib/db";
import { currentUser, dateParam, handle, HttpError, ok } from "@/lib/http";
import { getSetting } from "@/lib/settings";

const AHEAD_DAYS = 4; // petugas boleh melihat penugasan sampai 4 hari ke depan

// GET /api/v1/petugas/tugas?date=YYYY-MM-DD — tagihan yang ditugaskan ke petugas yang login (default hari ini; paling jauh 4 hari ke depan)
// (belum dibayar & telat lebih dulu). meta.upcoming = jumlah tugas per hari untuk 4 hari ke depan.
export const GET = handle(async (req: Request) => {
  const me = currentUser();
  const dateInput = dateParam(new URL(req.url).searchParams.get("date"));
  const sel = (await one<{ d: string; ok: boolean }>(
    `SELECT d::text AS d, d BETWEEN CURRENT_DATE AND CURRENT_DATE + ${AHEAD_DAYS} AS ok FROM (SELECT COALESCE($1::date, CURRENT_DATE) AS d) x`, [dateInput],
  ))!;
  if (!sel.ok) throw new HttpError(422, `Penugasan hanya bisa dilihat untuk hari ini sampai ${AHEAD_DAYS} hari ke depan`);
  const [today, rows, cash, transfer, bankName, bankNumber, bankHolder, upcoming] = await Promise.all([
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
       WHERE a.collector_id = $1 AND a.assigned_on = $2::date AND a.deleted_at IS NULL
       ORDER BY (i.status <> 'belum'), (pr.promised_on IS NOT NULL), i.due_date, m.name`,
      [me.id, sel.d],
    ),
    getSetting("payment_cash_enabled", true),
    getSetting("payment_transfer_enabled", true),
    getSetting("bank_name", ""),
    getSetting("bank_account_number", ""),
    getSetting("bank_account_name", ""),
    q<{ date: string; count: number }>(
      `SELECT g.d::date::text AS date, COUNT(a.id)::int AS count
       FROM generate_series(CURRENT_DATE + 1, CURRENT_DATE + ${AHEAD_DAYS}, interval '1 day') AS g(d)
       LEFT JOIN assignments a ON a.assigned_on = g.d::date AND a.collector_id = $1 AND a.deleted_at IS NULL
       GROUP BY g.d ORDER BY g.d`, [me.id],
    ),
  ]);
  const done = rows.filter((x) => x.status !== "belum");
  const postponed = rows.filter((x) => x.status === "belum" && x.promised_on);
  return ok(rows, {
    date: sel.d,
    today: today!.d,
    upcoming,
    total: rows.length,
    done: done.length,
    postponed: postponed.length,
    amount_total: rows.reduce((s, x) => s + x.total_amount, 0),
    amount_done: done.reduce((s, x) => s + x.total_amount, 0),
    methods: { tunai: cash, transfer },
    bank: { name: bankName, number: bankNumber, holder: bankHolder },
  });
}, { module: "my_tasks" });
