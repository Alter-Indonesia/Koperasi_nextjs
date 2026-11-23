import { q, one } from "@/lib/db";
import { handle, intParam, ok } from "@/lib/http";

const STATUS = ["menunggu", "cocok", "selisih", "ditolak"] as const;

// GET /api/v1/setoran?status=&q=&page=&limit= — setoran kas petugas (status kosong = semua); meta.summary untuk kartu ringkasan
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = intParam(sp.get("page"), 1);
  const limit = intParam(sp.get("limit"), 10, 1, 100);
  const status = STATUS.find((s) => s === sp.get("status")) ?? null;
  const search = sp.get("q")?.trim() || null;
  const where = `d.deleted_at IS NULL AND ($1::text IS NULL OR d.status = $1) AND ($2::text IS NULL OR u.name ILIKE '%' || $2 || '%')`;
  const [rows, total, summary] = await Promise.all([
    q(`SELECT d.id, d.deposited_on, d.amount, d.payment_count, d.status, d.received_amount, d.returned_amount, d.notes, d.decided_at,
              u.name AS collector_name, rb.name AS received_by_name
       FROM cash_deposits d JOIN users u ON u.id = d.collector_id LEFT JOIN users rb ON rb.id = d.received_by
       WHERE ${where} ORDER BY (d.status = 'menunggu') DESC, d.deposited_on DESC, d.id DESC LIMIT $3 OFFSET $4`, [status, search, limit, (page - 1) * limit]),
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM cash_deposits d JOIN users u ON u.id = d.collector_id WHERE ${where}`, [status, search]),
    one(`SELECT COUNT(*) FILTER (WHERE status = 'menunggu') AS pending,
                COALESCE(SUM(amount) FILTER (WHERE status = 'menunggu'), 0) AS pending_amount,
                COALESCE(SUM(received_amount) FILTER (WHERE decided_at::date = CURRENT_DATE), 0) AS received_today,
                COALESCE(SUM(returned_amount) FILTER (WHERE decided_at::date = CURRENT_DATE), 0) AS returned_today
         FROM cash_deposits WHERE deleted_at IS NULL`),
  ]);
  return ok(rows, { page, limit, total: total?.n ?? 0, summary });
}, { module: "deposit_receipts" });
