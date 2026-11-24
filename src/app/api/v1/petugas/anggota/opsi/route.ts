import { q } from "@/lib/db";
import { currentUser, handle, ok } from "@/lib/http";
import type { AdminFeeMode } from "@/lib/loan-calc";
import { loanCeilingFor } from "@/lib/queries";
import { getSetting } from "@/lib/settings";

// GET /api/v1/petugas/anggota/opsi — pilihan form anggota baru: wilayah, tenor aktif, perlakuan biaya admin, plafon & batas persetujuan
export const GET = handle(async () => {
  const [regions, tenors, admin_fee_mode, limits] = await Promise.all([
    q("SELECT id, name FROM regions WHERE deleted_at IS NULL ORDER BY name"),
    q("SELECT id, duration, unit, interest_rate_percent, label FROM tenors WHERE deleted_at IS NULL AND is_active ORDER BY unit DESC, sort_order, duration"),
    getSetting<AdminFeeMode>("admin_fee_mode", "potong"),
    loanCeilingFor(currentUser().role),
  ]);
  return ok({ regions, tenors, admin_fee_mode, approval_limit: limits.approval_limit, ceiling: limits.ceiling });
}, { module: "my_tasks" });
