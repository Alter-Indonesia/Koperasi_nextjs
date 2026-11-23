import { one, q } from "@/lib/db";
import { currentUser, handle, ok } from "@/lib/http";
import { getSetting } from "@/lib/settings";

// GET /api/v1/petugas/profil — biodata petugas yang login, wilayah tugas, dan capaian bulan ini terhadap target
export const GET = handle(async () => {
  const me = currentUser();
  const [bio, stats, region, members, target] = await Promise.all([
    one<{ phone: string | null; status: string; joined_at: string; last_login_at: string | null }>(
      "SELECT phone, status, created_at AS joined_at, last_login_at FROM users WHERE id = $1", [me.id]),
    one<{ collected: number; visits: number; month: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS collected, COUNT(*) AS visits, to_char(CURRENT_DATE, 'YYYY-MM') AS month FROM payments
       WHERE collector_id = $1 AND status <> 'ditolak' AND deleted_at IS NULL AND date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE)`, [me.id]),
    one<{ member_count: number }>("SELECT COUNT(*) AS member_count FROM members WHERE region_id = $1 AND deleted_at IS NULL", [me.region_id]),
    // anggota tanggung jawab petugas = anggota di wilayah tugasnya
    q<{ id: number; member_number: string; name: string; phone: string | null; address: string | null; active_loans: number; arrears_amount: number }>(
      `SELECT m.id, m.member_number, m.name, m.phone, m.address,
              COUNT(l.id) FILTER (WHERE l.status = 'aktif')::int AS active_loans,
              COALESCE(SUM(l.arrears_amount) FILTER (WHERE l.status = 'aktif'), 0) AS arrears_amount
       FROM members m LEFT JOIN v_loans l ON l.member_id = m.id
       WHERE m.region_id = $1 AND m.deleted_at IS NULL
       GROUP BY m.id ORDER BY m.name`, [me.region_id]),
    getSetting("collector_monthly_target", 0),
  ]);
  const collected = stats!.collected;
  return ok({
    id: me.id, code: me.code, name: me.name, email: me.email, phone: bio?.phone ?? null, status: bio?.status ?? "aktif", joined_at: bio?.joined_at ?? null, last_login_at: bio?.last_login_at ?? null, region_name: me.region_name, member_count: region?.member_count ?? 0, members,
    month: stats!.month, collected, visits: stats!.visits, target, collection_rate: target > 0 ? collected / target : 0, remaining: Math.max(0, target - collected),
  });
}, { module: "my_tasks" });
