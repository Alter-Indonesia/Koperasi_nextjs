import { z } from "zod";
import { q, one } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { body, created, currentUser, handle, HttpError, intParam, ok } from "@/lib/http";
import { UserFields } from "@/lib/system-schema";

// GET /api/v1/pengguna?role=&status=&q=&page=&limit=
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = intParam(sp.get("page"), 1);
  const limit = intParam(sp.get("limit"), 10, 1, 100);
  const search = sp.get("q")?.trim() || null;
  const role = sp.get("role") || null;
  const status = ["aktif", "nonaktif"].includes(sp.get("status") ?? "") ? sp.get("status") : null;
  const base = `
    FROM users u
    JOIN roles r ON r.code = u.role
    LEFT JOIN regions g ON g.id = u.region_id
    WHERE u.deleted_at IS NULL
      AND ($1::text IS NULL OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%' OR u.code ILIKE '%' || $1 || '%')
      AND ($2::text IS NULL OR u.role = $2)
      AND ($3::text IS NULL OR u.status = $3)`;
  const [rows, total] = await Promise.all([
    q(`SELECT u.id, u.code, u.name, u.email, u.phone, u.role, r.name AS role_name, g.name AS region_name, u.status, u.last_login_at
       ${base} ORDER BY u.name LIMIT $4 OFFSET $5`, [search, role, status, limit, (page - 1) * limit]),
    one<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, [search, role, status]),
  ]);
  return ok(rows, { page, limit, total: total?.n ?? 0 });
}, { module: "users" });

const NewUser = z.object({ ...UserFields, status: UserFields.status.default("aktif") });

// POST /api/v1/pengguna — pengguna baru + password awal (di-hash bcrypt)
export const POST = handle(async (req: Request) => {
  const d = await body(req, NewUser);
  if (!(await one("SELECT 1 FROM roles WHERE code = $1 AND deleted_at IS NULL", [d.role]))) throw new HttpError(422, "Role tidak ditemukan");
  if (d.region_id && !(await one("SELECT 1 FROM regions WHERE id = $1 AND deleted_at IS NULL", [d.region_id]))) throw new HttpError(422, "Wilayah tidak ditemukan");
  if (await one("SELECT 1 FROM users WHERE lower(email) = $1 AND deleted_at IS NULL", [d.email])) throw new HttpError(409, "Email sudah dipakai pengguna lain");
  if (d.code && (await one("SELECT 1 FROM users WHERE code = $1 AND deleted_at IS NULL", [d.code]))) throw new HttpError(409, "Kode pengguna sudah dipakai");
  const r = await one<{ id: number }>(
    `INSERT INTO users (code, name, email, phone, role, region_id, status, password_hash, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING id`,
    [d.code || null, d.name, d.email, d.phone || null, d.role, d.region_id ?? null, d.status, await hashPassword(d.password), currentUser().id],
  );
  // kode otomatis bila dikosongkan: 3 huruf pertama role + nomor (mis. PET-014)
  if (!d.code) await q("UPDATE users SET code = upper(left(role, 3)) || '-' || lpad(id::text, 3, '0') WHERE id = $1", [r!.id]);
  return created({ id: r!.id, name: d.name, email: d.email });
}, { module: "users" });
