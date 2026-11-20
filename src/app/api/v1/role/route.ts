import { z } from "zod";
import { q, one } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, ok } from "@/lib/http";
import { invalidateRbac } from "@/lib/rbac";
import { RoleFields } from "@/lib/system-schema";

// GET /api/v1/role — daftar role
export const GET = handle(async () =>
  ok(await q(`SELECT r.id, r.code, r.name, r.description, r.area, r.is_system,
                     (SELECT COUNT(*) FROM users u WHERE u.role = r.code AND u.deleted_at IS NULL) AS user_count,
                     (SELECT COUNT(*) FROM role_permissions p WHERE p.role_id = r.id AND (p.can_view OR p.can_create OR p.can_update OR p.can_delete)) AS module_count
              FROM roles r WHERE r.deleted_at IS NULL ORDER BY r.is_system DESC, r.id`)),
  { module: "roles" },
);

const NewRole = z.object({ code: RoleFields.code, name: RoleFields.name, description: RoleFields.description, area: RoleFields.area });

// POST /api/v1/role — role kustom (tanpa hak akses; atur lewat PUT /role/{id}/permissions)
export const POST = handle(async (req: Request) => {
  const d = await body(req, NewRole);
  if (await one("SELECT 1 FROM roles WHERE code = $1", [d.code])) throw new HttpError(409, "Kode role sudah dipakai");
  const r = await one(
    "INSERT INTO roles (code, name, description, area, is_system, created_by, updated_by) VALUES ($1, $2, $3, $4, false, $5, $5) RETURNING id, code, name",
    [d.code, d.name, d.description || null, d.area, currentUser().id],
  );
  invalidateRbac();
  return created(r);
}, { module: "roles" });
