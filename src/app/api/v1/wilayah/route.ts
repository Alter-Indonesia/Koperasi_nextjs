import { z } from "zod";
import { q, one } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, ok } from "@/lib/http";

// GET /api/v1/wilayah
export const GET = handle(async () =>
  ok(
    await q(`SELECT r.id, r.name,
                    (SELECT COUNT(*) FROM members m WHERE m.region_id = r.id AND m.deleted_at IS NULL) AS member_count,
                    (SELECT COUNT(*) FROM users u WHERE u.region_id = r.id AND u.deleted_at IS NULL) AS user_count
             FROM regions r WHERE r.deleted_at IS NULL ORDER BY r.name`),
  ),
  { module: "regions" },
);

const NewRegion = z.object({ name: z.string().trim().min(2, "Nama wilayah minimal 2 karakter").max(60) });

// POST /api/v1/wilayah
export const POST = handle(async (req: Request) => {
  const d = await body(req, NewRegion);
  if (await one("SELECT 1 FROM regions WHERE lower(name) = lower($1) AND deleted_at IS NULL", [d.name])) throw new HttpError(409, "Nama wilayah sudah ada");
  const r = await one("INSERT INTO regions (name, created_by, updated_by) VALUES ($1, $2, $2) RETURNING id, name", [d.name, currentUser().id]);
  return created(r);
}, { module: "regions" });
