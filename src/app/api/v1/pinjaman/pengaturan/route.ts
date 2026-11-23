import { currentUser, ok, handle } from "@/lib/http";
import type { AdminFeeMode } from "@/lib/loan-calc";
import { loanCeilingFor } from "@/lib/queries";
import { getSetting } from "@/lib/settings";

// GET /api/v1/pinjaman/pengaturan — pengaturan yang memengaruhi form pinjaman (cukup hak lihat Pinjaman, tanpa hak Pengaturan)
export const GET = handle(async () => ok({
  admin_fee_mode: await getSetting<AdminFeeMode>("admin_fee_mode", "potong"),
  ...(await loanCeilingFor(currentUser().role)), // ceiling = plafon; can_exceed = pengguna ini boleh melebihinya
}), { module: "loans" });
