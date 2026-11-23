import "server-only";
import type { PoolClient } from "pg";
import { HttpError } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";

/**
 * Menyamakan akun login (users, role 'anggota') dengan data anggota: nama, no. HP, wilayah, status.
 * Anggota belum punya akun -> dibuat (tanpa password: Admin mengaturnya di Sistem › Pengguna), kecuali no. HP kosong / sudah dipakai akun lain.
 * Anggota sudah punya akun dan no. HP barunya bentrok dengan akun lain -> 409.
 */
export async function syncMemberAccount(c: PoolClient, memberId: number, actorId: number) {
  const m = (await c.query("SELECT id, member_number, name, phone, region_id, status, user_id FROM members WHERE id = $1 AND deleted_at IS NULL", [memberId])).rows[0];
  if (!m) return;
  const phone = normalizePhone(m.phone);
  const status = m.status === "aktif" ? "aktif" : "nonaktif";
  const taken = phone
    ? (await c.query("SELECT 1 FROM users WHERE normalize_phone(phone) = $1 AND deleted_at IS NULL AND id IS DISTINCT FROM $2", [phone, m.user_id])).rowCount
    : 0;
  if (m.user_id) {
    if (taken) throw new HttpError(409, "No. HP sudah dipakai akun lain");
    await c.query("UPDATE users SET name = $2, phone = $3, region_id = $4, status = $5, updated_by = $6 WHERE id = $1", [m.user_id, m.name, m.phone, m.region_id, status, actorId]);
    if (status === "nonaktif") await c.query("DELETE FROM sessions WHERE user_id = $1", [m.user_id]);
    return;
  }
  if (!phone || taken) return;
  const code = (await c.query("SELECT 1 FROM users WHERE code = $1 AND deleted_at IS NULL", [m.member_number])).rowCount ? null : m.member_number;
  const uid = (await c.query(
    "INSERT INTO users (code, name, phone, role, region_id, status, created_by, updated_by) VALUES ($1, $2, $3, 'anggota', $4, $5, $6, $6) RETURNING id",
    [code, m.name, m.phone, m.region_id, status, actorId],
  )).rows[0].id;
  await c.query("UPDATE members SET user_id = $2 WHERE id = $1", [memberId, uid]);
}

/** Anggota dihapus -> akun loginnya ikut dihapus (soft delete) dan semua sesinya diputus. */
export async function removeMemberAccount(c: PoolClient, memberId: number, actorId: number) {
  const uid = (await c.query("SELECT user_id FROM members WHERE id = $1", [memberId])).rows[0]?.user_id;
  if (!uid) return;
  await c.query("UPDATE users SET deleted_at = now(), deleted_by = $2, updated_by = $2 WHERE id = $1 AND deleted_at IS NULL", [uid, actorId]);
  await c.query("DELETE FROM sessions WHERE user_id = $1", [uid]);
}
