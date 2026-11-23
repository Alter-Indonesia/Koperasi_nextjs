import { q, one } from "@/lib/db";
import { currentUser, handle, HttpError, ok } from "@/lib/http";

// GET /api/v1/anggota/saya — profil, simpanan, dan ringkasan pinjaman anggota yang login (hanya data miliknya)
export const GET = handle(async () => {
  const me = currentUser();
  if (!me.member_id) throw new HttpError(404, "Akun ini tidak terhubung ke data anggota");
  const member = await one(
    `SELECT m.id, m.member_number, m.name, m.phone, m.address, m.status, m.joined_on, r.name AS region_name,
            m.principal_savings, m.mandatory_savings, m.voluntary_savings,
            m.principal_savings + m.mandatory_savings + m.voluntary_savings AS total_savings,
            (SELECT u.name FROM users u WHERE u.id = m.collector_id AND u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL) AS collector_name
     FROM members m JOIN regions r ON r.id = m.region_id
     WHERE m.id = $1 AND m.deleted_at IS NULL`,
    [me.member_id],
  );
  if (!member) throw new HttpError(404, "Data anggota tidak ditemukan");
  const [summary, next, last] = await Promise.all([
    one<{ active_loans: number; remaining_balance: number; arrears_amount: number; worst_days: number }>(
      `SELECT COUNT(*)::int AS active_loans, COALESCE(SUM(remaining_balance), 0) AS remaining_balance,
              COALESCE(SUM(arrears_amount), 0) AS arrears_amount, COALESCE(MAX(days_overdue), 0)::int AS worst_days
       FROM v_loans WHERE member_id = $1 AND status = 'aktif'`, [me.member_id]),
    // angsuran terdekat yang belum lunas dari semua pinjaman aktif (yang telat tampil lebih dulu)
    q(
      `SELECT i.id, i.sequence, i.due_date, i.total_amount, i.status, l.loan_number, l.tenor_duration, l.tenor_unit,
              GREATEST(0, CURRENT_DATE - i.due_date)::int AS days_overdue
       FROM installments i JOIN loans l ON l.id = i.loan_id AND l.deleted_at IS NULL
       WHERE l.member_id = $1 AND l.status = 'aktif' AND i.status <> 'lunas' AND i.deleted_at IS NULL
       ORDER BY i.due_date, i.sequence LIMIT 1`, [me.member_id]),
    one<{ n: string }>("SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS n"),
  ]);
  return ok({ ...member, email: me.email, ...summary, next_installment: next[0] ?? null }, { today: last?.n });
}, { module: "my_loans" });
