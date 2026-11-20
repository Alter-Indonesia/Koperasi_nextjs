import { q, one } from "@/lib/db";
import { dateParam, handle, intParam, ok } from "@/lib/http";

// GET /api/v1/log-aktivitas?q=&module=&action=&user_id=&from=&to=&page=&limit=
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = intParam(sp.get("page"), 1);
  const limit = intParam(sp.get("limit"), 15, 1, 100);
  const search = sp.get("q")?.trim() || null;
  const moduleFilter = sp.get("module") || null;
  const action = sp.get("action") || null;
  const userId = sp.get("user_id") ? intParam(sp.get("user_id"), 0, 1, 1e9) || null : null;
  const from = dateParam(sp.get("from"));
  const to = dateParam(sp.get("to"));
  const where = `
    WHERE ($1::text IS NULL OR user_name ILIKE '%' || $1 || '%' OR path ILIKE '%' || $1 || '%')
      AND ($2::text IS NULL OR module = $2)
      AND ($3::text IS NULL OR action = $3)
      AND ($4::int IS NULL OR user_id = $4)
      AND ($5::date IS NULL OR created_at >= $5::date)
      AND ($6::date IS NULL OR created_at < $6::date + 1)`;
  const P = [search, moduleFilter, action, userId, from, to];
  const [rows, total] = await Promise.all([
    q(`SELECT id, user_id, user_name, action, module, entity_id, method, path, status_code, ip, created_at
       FROM activity_logs ${where} ORDER BY created_at DESC, id DESC LIMIT $7 OFFSET $8`, [...P, limit, (page - 1) * limit]),
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM activity_logs ${where}`, P),
  ]);
  return ok(rows, { page, limit, total: total?.n ?? 0 });
}, { module: "activity_logs" });
