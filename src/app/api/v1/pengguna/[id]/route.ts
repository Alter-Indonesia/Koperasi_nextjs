import { z } from "zod";
import { one, q, tx } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";
import { UserFields } from "@/lib/system-schema";

type Route = RouteContext<"/api/v1/pengguna/[id]">;

// GET /api/v1/pengguna/{id} — tanpa password_hash
export const GET = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const u = await one(
    `SELECT u.id, u.code, u.name, u.email, u.phone, u.role, r.name AS role_name, u.region_id, g.name AS region_name, u.status, u.last_login_at,
            u.created_at, u.updated_at, uc.name AS created_by_name, uu.name AS updated_by_name
     FROM users u JOIN roles r ON r.code = u.role LEFT JOIN regions g ON g.id = u.region_id
     LEFT JOIN users uc ON uc.id = u.created_by LEFT JOIN users uu ON uu.id = u.updated_by
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id],
  );
  if (!u) throw new HttpError(404, "Pengguna tidak ditemukan");
  return ok(u);
}, { module: "users" });

const UpdateUser = z
  .object({ ...UserFields, password: UserFields.password })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Tidak ada data yang diubah");

// PATCH /api/v1/pengguna/{id} — kolom yang dikirim saja. `password` mengganti password dan memutus semua sesi pengguna itu.
export const PATCH = handle(async (req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, UpdateUser);
  const me = currentUser();
  const res = await tx(async (c) => {
    const cur = (await c.query("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!cur) throw new HttpError(404, "Pengguna tidak ditemukan");
    if (id === me.id && ((d.role && d.role !== cur.role) || (d.status && d.status !== "aktif")))
      throw new HttpError(409, "Role dan status akun sendiri tidak bisa diubah");
    if (d.role && !(await c.query("SELECT 1 FROM roles WHERE code = $1 AND deleted_at IS NULL", [d.role])).rowCount) throw new HttpError(422, "Role tidak ditemukan");
    if (d.region_id && !(await c.query("SELECT 1 FROM regions WHERE id = $1 AND deleted_at IS NULL", [d.region_id])).rowCount) throw new HttpError(422, "Wilayah tidak ditemukan");
    if (d.email && (await c.query("SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2 AND deleted_at IS NULL", [d.email, id])).rowCount) throw new HttpError(409, "Email sudah dipakai pengguna lain");
    if (d.code && (await c.query("SELECT 1 FROM users WHERE code = $1 AND id <> $2 AND deleted_at IS NULL", [d.code, id])).rowCount) throw new HttpError(409, "Kode pengguna sudah dipakai");
    await c.query(
      `UPDATE users SET code = CASE WHEN $2::boolean THEN $3 ELSE code END, name = COALESCE($4, name), email = COALESCE($5, email),
                        phone = CASE WHEN $6::boolean THEN $7 ELSE phone END, role = COALESCE($8, role),
                        region_id = CASE WHEN $9::boolean THEN $10 ELSE region_id END, status = COALESCE($11, status),
                        password_hash = COALESCE($12, password_hash), updated_by = $13
       WHERE id = $1`,
      [id, "code" in d, d.code || null, d.name ?? null, d.email ?? null, "phone" in d, d.phone || null, d.role ?? null, "region_id" in d, d.region_id ?? null,
       d.status ?? null, d.password ? await hashPassword(d.password) : null, me.id],
    );
    // password diganti / akun dinonaktifkan: putus semua sesi login pengguna itu
    if (d.password || d.status === "nonaktif") await c.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    return { id, name: d.name ?? cur.name, email: d.email ?? cur.email };
  });
  return ok(res);
}, { module: "users" });

// DELETE /api/v1/pengguna/{id} — soft delete + putus sesi. Akun sendiri tidak bisa dihapus.
export const DELETE = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const me = currentUser();
  if (id === me.id) throw new HttpError(409, "Akun sendiri tidak bisa dihapus");
  const u = await one<{ name: string }>("UPDATE users SET deleted_at = now(), deleted_by = $2, updated_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING name", [id, me.id]);
  if (!u) throw new HttpError(404, "Pengguna tidak ditemukan");
  await q("DELETE FROM sessions WHERE user_id = $1", [id]);
  return ok({ id, name: u.name, deleted: true });
}, { module: "users" });
