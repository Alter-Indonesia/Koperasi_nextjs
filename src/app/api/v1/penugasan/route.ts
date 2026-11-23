import { z } from "zod";
import { q, tx } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, ok } from "@/lib/http";
import { MAX_COLLECTOR_LOAD } from "@/lib/queries";

/** Anggota aktif beserta jumlah pinjaman aktifnya; collector_id hanya dihitung bila petugasnya masih aktif. */
const MEMBERS = `SELECT m.id, m.member_number, m.name AS member_name, m.address AS member_address, m.phone AS member_phone, m.region_id, r.name AS region_name,
                        CASE WHEN cu.id IS NOT NULL THEN m.collector_id END AS collector_id,
                        (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.id AND l.status = 'aktif' AND l.deleted_at IS NULL)::int AS active_loans
                 FROM members m JOIN regions r ON r.id = m.region_id
                 LEFT JOIN users cu ON cu.id = m.collector_id AND cu.role = 'petugas' AND cu.status = 'aktif' AND cu.deleted_at IS NULL
                 WHERE m.deleted_at IS NULL AND m.status = 'aktif'`;

// GET /api/v1/penugasan — penugasan tetap anggota ke petugas.
//  unassigned = anggota yang belum punya petugas; collectors[].members = semua anggota yang dipegang petugas itu (load = jumlahnya)
export const GET = handle(async () => {
  const [members, collectors] = await Promise.all([
    q<{ id: number; collector_id: number | null }>(`${MEMBERS} ORDER BY r.name, m.name`),
    q(`SELECT u.id, u.code, u.name, u.region_id, r.name AS region_name
       FROM users u LEFT JOIN regions r ON r.id = u.region_id
       WHERE u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL ORDER BY u.name`),
  ]);
  return ok({
    unassigned: members.filter((m) => !m.collector_id),
    collectors: collectors.map((c) => {
      const list = members.filter((m) => m.collector_id === c.id);
      return { ...c, load: list.length, max_load: MAX_COLLECTOR_LOAD, members: list };
    }),
  });
}, { module: "assignments" });

const Assign = z.object({
  collector_id: z.number().int().positive().nullable(), // null = lepas dari petugas
  member_ids: z.array(z.number().int().positive()).min(1).max(200),
});

// POST /api/v1/penugasan { collector_id | null, member_ids } — tetapkan petugas pemegang anggota terpilih (null = lepas).
// Tagihan hari ini dan ke depan yang belum dibayar ikut dipindahkan ke petugas baru; yang sudah dibayar tetap atas nama petugas sebelumnya.
export const POST = handle(async (req: Request) => {
  const d = await body(req, Assign);
  const me = currentUser();
  const res = await tx(async (c) => {
    if (d.collector_id && !(await c.query("SELECT 1 FROM users WHERE id = $1 AND role = 'petugas' AND status = 'aktif' AND deleted_at IS NULL", [d.collector_id])).rowCount)
      throw new HttpError(404, "Petugas tidak ditemukan");
    const rows = (await c.query<{ id: number }>(
      "UPDATE members SET collector_id = $1, updated_by = $3 WHERE id = ANY($2::int[]) AND deleted_at IS NULL RETURNING id", [d.collector_id, d.member_ids, me.id],
    )).rows;
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const own = `installment_id IN (SELECT i.id FROM installments i JOIN loans l ON l.id = i.loan_id WHERE l.member_id = ANY($1::int[]) AND i.status = 'belum') AND assigned_on >= CURRENT_DATE`;
      if (d.collector_id) await c.query(`UPDATE assignments SET collector_id = $2, updated_by = $3 WHERE ${own} AND deleted_at IS NULL`, [ids, d.collector_id, me.id]);
      else await c.query(`DELETE FROM assignments WHERE ${own}`, [ids]);
    }
    return { assigned: ids.length };
  });
  return created(res);
}, { module: "assignments" });
