import { one } from "@/lib/db";
import { handle, HttpError, idParam, ok } from "@/lib/http";

// GET /api/v1/log-aktivitas/{id} — satu catatan lengkap (hanya baca; log tidak bisa diubah atau dihapus)
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/log-aktivitas/[id]">) => {
  const id = idParam((await ctx.params).id);
  const r = await one("SELECT id, user_id, user_name, action, module, entity_id, method, path, status_code, ip, user_agent, details, created_at FROM activity_logs WHERE id = $1", [id]);
  if (!r) throw new HttpError(404, "Catatan tidak ditemukan");
  return ok(r);
}, { module: "activity_logs" });
