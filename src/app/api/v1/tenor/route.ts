import { z } from "zod";
import { q, one } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, ok } from "@/lib/http";
import { TENOR_MAX, TenorFields } from "@/lib/master-schema";

const COLS = "id, duration, unit, interest_rate_percent, label, is_active, sort_order";

// GET /api/v1/tenor?active=1 — pilihan lama pinjaman (bulan/hari). active=1 hanya yang aktif (dipakai form pinjaman).
export const GET = handle(async (req: Request) => {
  const onlyActive = new URL(req.url).searchParams.get("active") === "1";
  return ok(await q(`SELECT ${COLS} FROM tenors WHERE deleted_at IS NULL AND ($1::boolean = false OR is_active) ORDER BY unit DESC, sort_order, duration`, [onlyActive]));
}, { module: "tenors" });

const NewTenor = z.object({
  ...TenorFields,
  unit: TenorFields.unit.default("bulan"),
  interest_rate_percent: TenorFields.interest_rate_percent.default(1.5),
  is_active: TenorFields.is_active.default(true),
  sort_order: TenorFields.sort_order.default(0),
});

// POST /api/v1/tenor
export const POST = handle(async (req: Request) => {
  const d = await body(req, NewTenor);
  if (d.duration > TENOR_MAX[d.unit]) throw new HttpError(422, `Tenor ${d.unit} maksimal ${TENOR_MAX[d.unit]}`);
  if (await one("SELECT 1 FROM tenors WHERE duration = $1 AND unit = $2 AND deleted_at IS NULL", [d.duration, d.unit])) throw new HttpError(409, `Tenor ${d.duration} ${d.unit} sudah ada`);
  const r = await one(
    `INSERT INTO tenors (duration, unit, interest_rate_percent, label, is_active, sort_order, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING ${COLS}`,
    [d.duration, d.unit, d.interest_rate_percent, d.label || null, d.is_active, d.sort_order, currentUser().id],
  );
  return created(r);
}, { module: "tenors" });
