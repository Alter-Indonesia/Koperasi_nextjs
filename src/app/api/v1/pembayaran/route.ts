import { q, one } from "@/lib/db";
import { handle, intParam, ok } from "@/lib/http";

// GET /api/v1/pembayaran?status=menunggu|terverifikasi|ditolak&limit=
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const status = ["menunggu", "terverifikasi", "ditolak"].includes(sp.get("status") ?? "") ? sp.get("status") : "menunggu";
  const limit = intParam(sp.get("limit"), 50, 1, 200);
  const [rows, counts] = await Promise.all([
    q(`SELECT p.id, p.amount + p.penalty_amount AS amount, p.method, p.method_note, p.paid_at, p.status,
              m.name AS member_name, l.loan_number, i.sequence AS installment_sequence, l.tenor_duration, l.tenor_unit, c.name AS collector_name
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN loans l ON l.id = i.loan_id
       JOIN members m ON m.id = l.member_id
       LEFT JOIN users c ON c.id = p.collector_id
       WHERE p.status = $1
         AND ($1 = 'menunggu' OR COALESCE(p.verified_at, p.paid_at)::date = CURRENT_DATE)
       ORDER BY CASE WHEN $1 = 'menunggu' THEN p.paid_at END ASC, p.verified_at DESC NULLS LAST
       LIMIT $2`, [status, limit]),
    one(`SELECT COUNT(*) FILTER (WHERE status = 'menunggu') AS menunggu,
                COUNT(*) FILTER (WHERE status = 'terverifikasi' AND verified_at::date = CURRENT_DATE) AS terverifikasi,
                COUNT(*) FILTER (WHERE status = 'ditolak' AND verified_at::date = CURRENT_DATE) AS ditolak
         FROM payments`),
  ]);
  return ok(rows, { status, counts });
}, { module: "payments" });
