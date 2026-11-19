import { q } from "@/lib/db";
import { handle, ok, ROLES } from "@/lib/http";

// GET /api/v1/wilayah
export const GET = handle(async () =>
  ok(await q(`SELECT w.id, w.nama, (SELECT COUNT(*) FROM anggota a WHERE a.wilayah_id = w.id) AS anggota FROM wilayah w ORDER BY w.nama`)),
  { roles: ROLES.admin },
);
