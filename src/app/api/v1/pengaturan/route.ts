import { z } from "zod";
import { q, tx } from "@/lib/db";
import { body, currentUser, handle, HttpError, ok } from "@/lib/http";
import { checkSettingValue, type SettingRow } from "@/lib/settings";

const LIST = `SELECT s.id, s.key, s.group_name, s.label, s.description, s.value_type, s.value, s.config, s.sort_order, s.updated_at, u.name AS updated_by_name
              FROM settings s LEFT JOIN users u ON u.id = s.updated_by
              WHERE s.deleted_at IS NULL ORDER BY s.group_name, s.sort_order, s.id`;

// GET /api/v1/pengaturan — semua pengaturan sistem (halaman Sistem › Pengaturan dibentuk dari baris-baris ini)
export const GET = handle(async () => ok(await q(LIST)), { module: "settings" });

const Update = z.object({ values: z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0, "Tidak ada data yang diubah") });

// PATCH /api/v1/pengaturan { values: { <key>: <nilai>, … } } — ubah beberapa pengaturan sekaligus (divalidasi menurut tipe & config tiap baris)
export const PATCH = handle(async (req: Request) => {
  const { values } = await body(req, Update);
  const keys = Object.keys(values);
  const rows = await q<SettingRow>("SELECT id, key, label, value_type, config FROM settings WHERE key = ANY($1::text[]) AND deleted_at IS NULL", [keys]);
  const unknown = keys.filter((k) => !rows.some((r) => r.key === k));
  if (unknown.length) throw new HttpError(422, `Pengaturan tidak dikenal: ${unknown.join(", ")}`);
  const clean = rows.map((r) => ({ id: r.id, value: checkSettingValue(r, values[r.key]) }));
  await tx(async (c) => {
    for (const r of clean) await c.query("UPDATE settings SET value = $2::jsonb, updated_by = $3 WHERE id = $1", [r.id, JSON.stringify(r.value), currentUser().id]);
  });
  return ok(await q(LIST));
}, { module: "settings" });
