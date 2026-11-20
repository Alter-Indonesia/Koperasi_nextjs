import { z } from "zod";
import { one } from "@/lib/db";
import { body, currentUser, handle, HttpError, ok } from "@/lib/http";

// PUT /api/v1/pengingat/template/:kode { body }
export const PUT = handle(async (req: Request, ctx: RouteContext<"/api/v1/pengingat/template/[kode]">) => {
  const { kode } = await ctx.params;
  const d = await body(req, z.object({ body: z.string().trim().min(10).max(1000) }));
  const r = await one("UPDATE reminder_templates SET body = $2, updated_by = $3 WHERE code = $1 RETURNING code, channel, body", [kode, d.body, currentUser().id]);
  if (!r) throw new HttpError(404, "Template tidak ditemukan");
  return ok(r);
}, { module: "reminders" });
