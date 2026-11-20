import { one } from "@/lib/db";
import { currentUser, handle, ok } from "@/lib/http";
import { getSetting } from "@/lib/settings";

// GET /api/v1/petugas/profil — data petugas yang login, wilayah tugas, dan capaian bulan ini terhadap target
export const GET = handle(async () => {
  const me = currentUser();
  const [stats, region, target] = await Promise.all([
    one<{ collected: number; visits: number; month: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS collected, COUNT(*) AS visits, to_char(CURRENT_DATE, 'YYYY-MM') AS month FROM payments
       WHERE collector_id = $1 AND status <> 'ditolak' AND deleted_at IS NULL AND date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE)`, [me.id]),
    one<{ member_count: number }>("SELECT COUNT(*) AS member_count FROM members WHERE region_id = $1 AND deleted_at IS NULL", [me.region_id]),
    getSetting("collector_monthly_target", 0),
  ]);
  const collected = stats!.collected;
  return ok({
    id: me.id, code: me.code, name: me.name, email: me.email, region_name: me.region_name, member_count: region?.member_count ?? 0,
    month: stats!.month, collected, visits: stats!.visits, target, collection_rate: target > 0 ? collected / target : 0, remaining: Math.max(0, target - collected),
  });
}, { module: "my_tasks" });
