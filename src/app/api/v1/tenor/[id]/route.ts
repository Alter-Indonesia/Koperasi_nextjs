import { z } from "zod";
import { one } from "@/lib/db";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";
import { TENOR_MAX, TenorFields } from "@/lib/master-schema";

const COLS = "id, duration, unit, interest_rate_percent, label, is_active, sort_order";

type Route = RouteContext<"/api/v1/tenor/[id]">;

// GET /api/v1/tenor/{id}
export const GET = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const r = await one(
    `SELECT t.id, t.duration, t.unit, t.interest_rate_percent, t.label, t.is_active, t.sort_order, t.created_at, t.updated_at, uc.name AS created_by_name, uu.name AS updated_by_name,
            (SELECT COUNT(*) FROM loans l WHERE l.tenor_duration = t.duration AND l.tenor_unit = t.unit AND l.deleted_at IS NULL) AS loan_count
     FROM tenors t LEFT JOIN users uc ON uc.id = t.created_by LEFT JOIN users uu ON uu.id = t.updated_by
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [id],
  );
  if (!r) throw new HttpError(404, "Tenor tidak ditemukan");
  return ok(r);
}, { module: "tenors" });

const UpdateTenor = z.object(TenorFields).partial().refine((d) => Object.keys(d).length > 0, "Tidak ada data yang diubah");

// PATCH /api/v1/tenor/{id}
export const PATCH = handle(async (req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, UpdateTenor);
  const cur = await one<{ duration: number; unit: "bulan" | "hari" }>("SELECT duration, unit FROM tenors WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!cur) throw new HttpError(404, "Tenor tidak ditemukan");
  const duration = d.duration ?? cur.duration, unit = d.unit ?? cur.unit;
  if (duration > TENOR_MAX[unit]) throw new HttpError(422, `Tenor ${unit} maksimal ${TENOR_MAX[unit]}`);
  if (await one("SELECT 1 FROM tenors WHERE duration = $1 AND unit = $2 AND id <> $3 AND deleted_at IS NULL", [duration, unit, id])) throw new HttpError(409, `Tenor ${duration} ${unit} sudah ada`);
  const r = await one(
    `UPDATE tenors SET duration = $2, unit = $8, interest_rate_percent = COALESCE($9, interest_rate_percent), label = CASE WHEN $3::boolean THEN $4 ELSE label END,
                       is_active = COALESCE($5, is_active), sort_order = COALESCE($6, sort_order), updated_by = $7
     WHERE id = $1 AND deleted_at IS NULL RETURNING ${COLS}`,
    [id, duration, "label" in d, d.label || null, d.is_active ?? null, d.sort_order ?? null, currentUser().id, unit, d.interest_rate_percent ?? null],
  );
  if (!r) throw new HttpError(404, "Tenor tidak ditemukan");
  return ok(r);
}, { module: "tenors" });

// DELETE /api/v1/tenor/{id} — soft delete. Pinjaman lama tetap menyimpan lama tenornya (lama + satuan), jadi tidak terpengaruh.
export const DELETE = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const r = await one("UPDATE tenors SET deleted_at = now(), deleted_by = $2, updated_by = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id, duration, unit", [id, currentUser().id]);
  if (!r) throw new HttpError(404, "Tenor tidak ditemukan");
  return ok({ ...r, deleted: true });
}, { module: "tenors" });
