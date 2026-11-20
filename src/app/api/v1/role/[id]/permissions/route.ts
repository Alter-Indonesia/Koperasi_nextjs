import { one, tx } from "@/lib/db";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";
import { invalidateRbac } from "@/lib/rbac";
import { MODULES } from "@/lib/permissions";
import { PermissionsInput } from "@/lib/system-schema";

// PUT /api/v1/role/{id}/permissions { permissions: { <modul>: ["view","create","update","delete"] } }
// Mengganti seluruh hak akses role. Role "admin" dikunci agar tidak ada yang mengunci dirinya sendiri dari sistem.
export const PUT = handle(async (req: Request, ctx: RouteContext<"/api/v1/role/[id]/permissions">) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, PermissionsInput);
  const role = await one<{ code: string }>("SELECT code FROM roles WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!role) throw new HttpError(404, "Role tidak ditemukan");
  if (role.code === "admin") throw new HttpError(409, "Hak akses role admin dikunci dan tidak bisa diubah");
  await tx(async (c) => {
    await c.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);
    for (const m of MODULES) {
      const a = d.permissions[m.code] ?? [];
      if (!a.length) continue;
      // hak ubah/tambah/hapus tanpa hak lihat tidak masuk akal: lihat otomatis ikut
      await c.query(
        "INSERT INTO role_permissions (role_id, module, can_view, can_create, can_update, can_delete) VALUES ($1, $2, true, $3, $4, $5)",
        [id, m.code, a.includes("create"), a.includes("update"), a.includes("delete")],
      );
    }
    await c.query("UPDATE roles SET updated_by = $2 WHERE id = $1", [id, currentUser().id]);
  });
  invalidateRbac();
  return ok({ id, modules: Object.values(d.permissions).filter((a) => a.length).length });
}, { module: "roles", action: "update", log: "update_permissions" });
