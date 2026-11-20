import { one } from "@/lib/db";
import { currentUser, handle, ok } from "@/lib/http";
import { roleInfo } from "@/lib/rbac";

// GET /api/v1/auth/me -> pengguna yang sedang login + role, area menu, dan hak akses per modul (401 bila belum login)
export const GET = handle(async () => {
  const user = currentUser();
  const info = await roleInfo(user.role);
  const role = await one<{ name: string }>("SELECT name FROM roles WHERE code = $1", [user.role]);
  return ok({ user, role_name: role?.name ?? user.role, area: info.area, home: `/${info.area}`, permissions: info.permissions });
});
