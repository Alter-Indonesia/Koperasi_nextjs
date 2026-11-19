import { z } from "zod";
import { one } from "@/lib/db";
import { body, handle, HttpError, ok, ROLES } from "@/lib/http";

// PATCH /api/v1/pengingat/saluran/:kode { aktif }
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/v1/pengingat/saluran/[kode]">) => {
  const { kode } = await ctx.params;
  const d = await body(req, z.object({ aktif: z.boolean() }));
  const r = await one("UPDATE pengingat_saluran SET aktif = $2 WHERE kode = $1 RETURNING kode, nama, aktif", [kode, d.aktif]);
  if (!r) throw new HttpError(404, "Saluran tidak ditemukan");
  return ok(r);
}, { roles: ROLES.admin });
