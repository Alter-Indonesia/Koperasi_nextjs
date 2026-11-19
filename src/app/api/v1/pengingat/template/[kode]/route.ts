import { z } from "zod";
import { one } from "@/lib/db";
import { body, handle, HttpError, ok, ROLES } from "@/lib/http";

// PUT /api/v1/pengingat/template/:kode { isi }
export const PUT = handle(async (req: Request, ctx: RouteContext<"/api/v1/pengingat/template/[kode]">) => {
  const { kode } = await ctx.params;
  const d = await body(req, z.object({ isi: z.string().trim().min(10).max(1000) }));
  const r = await one("UPDATE pengingat_template SET isi = $2 WHERE kode = $1 RETURNING kode, saluran, isi", [kode, d.isi]);
  if (!r) throw new HttpError(404, "Template tidak ditemukan");
  return ok(r);
}, { roles: ROLES.admin });
