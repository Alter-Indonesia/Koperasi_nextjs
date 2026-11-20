import { z } from "zod";
import { q, one } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, ok } from "@/lib/http";
import { TenorFields } from "@/lib/master-schema";

// GET /api/v1/tenor?active=1 — pilihan lama pinjaman (bulan). active=1 hanya yang aktif (dipakai form pinjaman).
export const GET = handle(async (req: Request) => {
  const onlyActive = new URL(req.url).searchParams.get("active") === "1";
  return ok(await q(`SELECT id, months, label, is_active, sort_order FROM tenors WHERE deleted_at IS NULL AND ($1::boolean = false OR is_active) ORDER BY sort_order, months`, [onlyActive]));
}, { module: "tenors" });

const NewTenor = z.object({ ...TenorFields, is_active: TenorFields.is_active.default(true), sort_order: TenorFields.sort_order.default(0) });

// POST /api/v1/tenor
export const POST = handle(async (req: Request) => {
  const d = await body(req, NewTenor);
  if (await one("SELECT 1 FROM tenors WHERE months = $1 AND deleted_at IS NULL", [d.months])) throw new HttpError(409, `Tenor ${d.months} bulan sudah ada`);
  const r = await one(
    "INSERT INTO tenors (months, label, is_active, sort_order, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $5) RETURNING id, months, label, is_active, sort_order",
    [d.months, d.label || null, d.is_active, d.sort_order, currentUser().id],
  );
  return created(r);
}, { module: "tenors" });
