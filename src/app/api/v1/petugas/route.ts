import { q } from "@/lib/db";
import { handle, ok } from "@/lib/http";

// GET /api/v1/petugas — petugas lapangan aktif
export const GET = handle(async () =>
  ok(
    await q(`SELECT u.id, u.code, u.name, u.phone, u.region_id, r.name AS region_name
             FROM users u LEFT JOIN regions r ON r.id = u.region_id
             WHERE u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL ORDER BY u.name`),
  ),
  { module: "assignments" },
);
