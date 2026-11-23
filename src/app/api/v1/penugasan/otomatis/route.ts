import { tx } from "@/lib/db";
import { created, currentUser, handle } from "@/lib/http";

// POST /api/v1/penugasan/otomatis — bagi anggota yang belum punya petugas ke petugas di wilayahnya, bergiliran ke yang paling sedikit memegang anggota
export const POST = handle(async () => {
  const me = currentUser();
  const assigned = await tx(async (c) => {
    const collectors = (await c.query<{ id: number; region_id: number; n: number }>(
      `SELECT u.id, u.region_id, (SELECT COUNT(*) FROM members h WHERE h.collector_id = u.id AND h.deleted_at IS NULL)::int AS n
       FROM users u WHERE u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL AND u.region_id IS NOT NULL`,
    )).rows;
    const pending = (await c.query<{ id: number; region_id: number }>(
      `SELECT m.id, m.region_id FROM members m
       WHERE m.deleted_at IS NULL AND m.status = 'aktif'
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.collector_id AND u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL)
       ORDER BY m.id FOR UPDATE OF m`,
    )).rows;
    let n = 0;
    for (const m of pending) {
      const target = collectors.filter((p) => p.region_id === m.region_id).sort((a, b) => a.n - b.n || a.id - b.id)[0];
      if (!target) continue; // wilayah tanpa petugas: tetap di daftar "belum punya petugas"
      await c.query("UPDATE members SET collector_id = $2, updated_by = $3 WHERE id = $1", [m.id, target.id, me.id]);
      target.n++;
      n++;
    }
    return n;
  });
  return created({ assigned });
}, { module: "assignments", log: "auto_assign" });
