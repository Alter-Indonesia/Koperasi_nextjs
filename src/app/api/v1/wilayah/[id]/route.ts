import { z } from "zod";
import { one } from "@/lib/db";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";

type Route = RouteContext<"/api/v1/wilayah/[id]">;

// GET /api/v1/wilayah/{id}
export const GET = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const r = await one(
    `SELECT r.id, r.name, r.created_at, r.updated_at, uc.name AS created_by_name, uu.name AS updated_by_name,
            (SELECT COUNT(*) FROM members m WHERE m.region_id = r.id AND m.deleted_at IS NULL) AS member_count,
            (SELECT COUNT(*) FROM users u WHERE u.region_id = r.id AND u.deleted_at IS NULL) AS user_count
     FROM regions r LEFT JOIN users uc ON uc.id = r.created_by LEFT JOIN users uu ON uu.id = r.updated_by
     WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [id],
  );
  if (!r) throw new HttpError(404, "Wilayah tidak ditemukan");
  return ok(r);
}, { module: "regions" });

// PATCH /api/v1/wilayah/{id} { name }
export const PATCH = handle(async (req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, z.object({ name: z.string().trim().min(2, "Nama wilayah minimal 2 karakter").max(60) }));
  if (await one("SELECT 1 FROM regions WHERE lower(name) = lower($1) AND id <> $2 AND deleted_at IS NULL", [d.name, id])) throw new HttpError(409, "Nama wilayah sudah ada");
  const r = await one("UPDATE regions SET name = $2, updated_by = $3 WHERE id = $1 AND deleted_at IS NULL RETURNING id, name", [id, d.name, currentUser().id]);
  if (!r) throw new HttpError(404, "Wilayah tidak ditemukan");
  return ok(r);
}, { module: "regions" });

// DELETE /api/v1/wilayah/{id} — soft delete; ditolak (409) bila masih dipakai anggota atau pengguna
export const DELETE = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const used = await one<{ members: number; users: number }>(
    `SELECT (SELECT COUNT(*) FROM members WHERE region_id = $1 AND deleted_at IS NULL) AS members,
            (SELECT COUNT(*) FROM users WHERE region_id = $1 AND deleted_at IS NULL) AS users`,
    [id],
  );
  if (used && (used.members > 0 || used.users > 0)) throw new HttpError(409, `Wilayah masih dipakai ${used.members} anggota dan ${used.users} pengguna`);
  const r = await one("UPDATE regions SET deleted_at = now(), deleted_by = $2, updated_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id, name", [id, currentUser().id]);
  if (!r) throw new HttpError(404, "Wilayah tidak ditemukan");
  return ok({ ...r, deleted: true });
}, { module: "regions" });
