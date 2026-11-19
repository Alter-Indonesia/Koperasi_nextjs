import { q } from "@/lib/db";
import { handle, ok, ROLES } from "@/lib/http";

// GET /api/v1/petugas — petugas lapangan aktif
export const GET = handle(async () =>
  ok(
    await q(`SELECT u.id, u.kode, u.nama, u.no_hp, u.wilayah_id, w.nama AS wilayah
             FROM pengguna u LEFT JOIN wilayah w ON w.id = u.wilayah_id
             WHERE u.role = 'petugas' AND u.status = 'aktif' ORDER BY u.nama`),
  ),
  { roles: ROLES.admin },
);
