import { z } from "zod";
import { one } from "@/lib/db";
import { body, currentUser, handle, HttpError, ok } from "@/lib/http";

// PATCH /api/v1/pengingat/saluran/:kode { is_active }
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/v1/pengingat/saluran/[kode]">) => {
  const { kode } = await ctx.params;
  const d = await body(req, z.object({ is_active: z.boolean() }));
  const r = await one("UPDATE reminder_channels SET is_active = $2, updated_by = $3 WHERE code = $1 RETURNING code, name, is_active", [kode, d.is_active, currentUser().id]);
  if (!r) throw new HttpError(404, "Saluran tidak ditemukan");
  return ok(r);
}, { module: "reminders" });
