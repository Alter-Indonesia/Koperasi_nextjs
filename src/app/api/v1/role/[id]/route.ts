import { z } from "zod";
import { q, one } from "@/lib/db";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";
import { invalidateRbac } from "@/lib/rbac";
import { RoleFields } from "@/lib/system-schema";

type Route = RouteContext<"/api/v1/role/[id]">;

// GET /api/v1/role/{id} — role + hak akses per modul
export const GET = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const role = await one(
    `SELECT r.id, r.code, r.name, r.description, r.area, r.is_system, r.created_at, r.updated_at, uc.name AS created_by_name, uu.name AS updated_by_name,
            (SELECT COUNT(*) FROM users u WHERE u.role = r.code AND u.deleted_at IS NULL) AS user_count
     FROM roles r LEFT JOIN users uc ON uc.id = r.created_by LEFT JOIN users uu ON uu.id = r.updated_by
     WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [id],
  );
  if (!role) throw new HttpError(404, "Role tidak ditemukan");
  const rows = await q<{ module: string; can_view: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }>(
    "SELECT module, can_view, can_create, can_update, can_delete FROM role_permissions WHERE role_id = $1",
    [id],
  );
  const permissions: Record<string, string[]> = {};
  for (const p of rows) {
    const a = [p.can_view && "view", p.can_create && "create", p.can_update && "update", p.can_delete && "delete"].filter(Boolean) as string[];
    if (a.length) permissions[p.module] = a;
  }
  return ok({ ...role, permissions });
}, { module: "roles" });

const UpdateRole = z
  .object({ name: RoleFields.name, description: RoleFields.description, area: RoleFields.area })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Tidak ada data yang diubah");

// PATCH /api/v1/role/{id} — ubah nama/deskripsi/area. Role bawaan: area tidak bisa diubah.
export const PATCH = handle(async (req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, UpdateRole);
  const cur = await one<{ is_system: boolean; area: string }>("SELECT is_system, area FROM roles WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!cur) throw new HttpError(404, "Role tidak ditemukan");
  if (cur.is_system && d.area && d.area !== cur.area) throw new HttpError(409, "Area role bawaan tidak bisa diubah");
  const r = await one(
    `UPDATE roles SET name = COALESCE($2, name), description = CASE WHEN $3::boolean THEN $4 ELSE description END, area = COALESCE($5, area), updated_by = $6
     WHERE id = $1 RETURNING id, code, name, area`,
    [id, d.name ?? null, "description" in d, d.description || null, d.area ?? null, currentUser().id],
  );
  invalidateRbac();
  return ok(r);
}, { module: "roles" });

// DELETE /api/v1/role/{id} — soft delete role kustom; ditolak bila role bawaan atau masih dipakai pengguna
export const DELETE = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const cur = await one<{ code: string; is_system: boolean }>("SELECT code, is_system FROM roles WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!cur) throw new HttpError(404, "Role tidak ditemukan");
  if (cur.is_system) throw new HttpError(409, "Role bawaan tidak bisa dihapus");
  const users = Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = $1 AND deleted_at IS NULL", [cur.code]))?.n ?? 0);
  if (users > 0) throw new HttpError(409, `Role masih dipakai ${users} pengguna`);
  await q("UPDATE roles SET deleted_at = now(), deleted_by = $2, updated_by = $2 WHERE id = $1", [id, currentUser().id]);
  invalidateRbac();
  return ok({ id, code: cur.code, deleted: true });
}, { module: "roles" });
