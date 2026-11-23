import { q, one } from "@/lib/db";
import { handle, intParam, ok } from "@/lib/http";

const STATUS = ["menunggu", "disetujui", "menunggu_verifikasi", "terverifikasi", "ditolak", "dibatalkan"] as const;

// GET /api/v1/pelunasan?status=&q=&page=&limit= — pengajuan pelunasan dipercepat (status kosong = semua); q = nama anggota / no. pinjaman / kode bukti.
// meta.summary: jumlah menunggu persetujuan, menunggu verifikasi (+ nilainya), terverifikasi hari ini.
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const page = intParam(sp.get("page"), 1);
  const limit = intParam(sp.get("limit"), 10, 1, 100);
  const status = STATUS.find((s) => s === sp.get("status")) ?? null;
  const search = sp.get("q")?.trim() || null;
  const from = `FROM loan_payoffs p JOIN loans l ON l.id = p.loan_id JOIN members m ON m.id = p.member_id
                LEFT JOIN users cu ON cu.id = p.collector_id
                WHERE p.deleted_at IS NULL AND ($1::text IS NULL OR p.status = $1)
                  AND ($2::text IS NULL OR m.name ILIKE '%' || $2 || '%' OR l.loan_number ILIKE '%' || $2 || '%' OR upper(p.receipt_code) = upper($2))`;
  const [rows, total, summary] = await Promise.all([
    q(`SELECT p.id, p.loan_id, l.loan_number, m.name AS member_name, m.member_number, p.amount, p.installments_count, p.method, p.source, p.status,
              p.requested_at, p.approved_at, p.received_at, p.decided_at, p.notes, p.receipt_code, (p.proof_image IS NOT NULL) AS has_proof, cu.name AS collector_name,
              (SELECT CASE WHEN bool_or(d.id IS NULL) THEN 'belum_disetor' WHEN bool_or(d.status = 'menunggu') THEN 'setoran_menunggu'
                           WHEN bool_or(d.status = 'ditolak') THEN 'setoran_ditolak' ELSE 'setoran_diterima' END
               FROM payments pm LEFT JOIN cash_deposits d ON d.id = pm.deposit_id WHERE pm.payoff_id = p.id AND pm.deleted_at IS NULL) AS deposit_state
       ${from} ORDER BY (p.status IN ('menunggu', 'menunggu_verifikasi')) DESC, p.requested_at DESC, p.id DESC LIMIT $3 OFFSET $4`, [status, search, limit, (page - 1) * limit]),
    one<{ n: number }>(`SELECT COUNT(*) AS n ${from}`, [status, search]),
    one(`SELECT COUNT(*) FILTER (WHERE status = 'menunggu') AS to_approve,
                COUNT(*) FILTER (WHERE status = 'menunggu_verifikasi') AS to_verify,
                COALESCE(SUM(amount) FILTER (WHERE status = 'menunggu_verifikasi'), 0) AS to_verify_amount,
                COALESCE(SUM(amount) FILTER (WHERE status = 'terverifikasi' AND decided_at::date = CURRENT_DATE), 0) AS verified_today
         FROM loan_payoffs WHERE deleted_at IS NULL`),
  ]);
  return ok(rows, { page, limit, total: total?.n ?? 0, summary });
}, { module: "payments" });
