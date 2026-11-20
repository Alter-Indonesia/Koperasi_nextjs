import "server-only";
import { q } from "@/lib/db";
import { type Action, type Area, type Module, type PermissionMap, MODULES, MODULE_ACTIONS, SUPERADMIN_ROLE } from "@/lib/permissions";

/** Hak akses & area per role, dibaca dari DB dan di-cache singkat (diinvalidasi saat role diubah). */
type RoleInfo = { area: Area; permissions: PermissionMap };
type Cache = { at: number; roles: Map<string, RoleInfo> };
const TTL_MS = 15_000;
const g = globalThis as unknown as { rbacCache?: Cache };

async function load(): Promise<Map<string, RoleInfo>> {
  const c = g.rbacCache;
  if (c && Date.now() - c.at < TTL_MS) return c.roles;
  const roles = await q<{ code: string; area: Area }>("SELECT code, area FROM roles WHERE deleted_at IS NULL");
  const perms = await q<{ code: string; module: Module; can_view: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }>(
    "SELECT r.code, p.module, p.can_view, p.can_create, p.can_update, p.can_delete FROM role_permissions p JOIN roles r ON r.id = p.role_id WHERE r.deleted_at IS NULL",
  );
  const map = new Map<string, RoleInfo>(roles.map((r) => [r.code, { area: r.area, permissions: {} }]));
  for (const p of perms) {
    const actions: Action[] = [];
    if (p.can_view) actions.push("view");
    if (p.can_create) actions.push("create");
    if (p.can_update) actions.push("update");
    if (p.can_delete) actions.push("delete");
    if (actions.length) map.get(p.code)!.permissions[p.module] = actions;
  }
  // Owner = superadmin: selalu semua modul & aksi (modul baru otomatis ikut), apa pun isi tabel role_permissions
  const owner = map.get(SUPERADMIN_ROLE);
  if (owner) owner.permissions = Object.fromEntries(MODULES.map((m) => [m.code, [...MODULE_ACTIONS[m.code]]])) as PermissionMap;
  g.rbacCache = { at: Date.now(), roles: map };
  return map;
}

export const invalidateRbac = () => { g.rbacCache = undefined; };
export async function roleInfo(roleCode: string): Promise<RoleInfo> {
  return (await load()).get(roleCode) ?? { area: "anggota", permissions: {} };
}
export async function hasPermission(roleCode: string, module: Module, action: Action) {
  return !!(await roleInfo(roleCode)).permissions[module]?.includes(action);
}
