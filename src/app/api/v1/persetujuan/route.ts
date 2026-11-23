import { q, one } from "@/lib/db";
import { handle, ok } from "@/lib/http";

// GET /api/v1/persetujuan — pinjaman berstatus "pengajuan" (> loan_approval_limit) yang menunggu keputusan Owner
export const GET = handle(async () => {
  const [rows, summary] = await Promise.all([
    q(`SELECT l.id, l.loan_number, l.member_id, m.name AS member_name, m.member_number, r.name AS region_name, l.principal_amount, l.loan_amount, l.tenor_duration, l.tenor_unit,
              l.installment_amount, l.purpose, l.collateral, l.disbursed_on, l.created_at, s.name AS submitted_by_name
       FROM loans l JOIN members m ON m.id = l.member_id JOIN regions r ON r.id = m.region_id LEFT JOIN users s ON s.id = l.submitted_by
       WHERE l.status = 'pengajuan' AND l.deleted_at IS NULL AND m.deleted_at IS NULL
       ORDER BY l.created_at`),
    one(`SELECT COUNT(*) AS pending, COALESCE(SUM(loan_amount),0) AS pending_amount,
                (SELECT COUNT(*) FROM loans WHERE decided_at::date = CURRENT_DATE AND status = 'aktif' AND deleted_at IS NULL) AS approved_today,
                (SELECT COUNT(*) FROM loans WHERE decided_at::date = CURRENT_DATE AND status = 'ditolak' AND deleted_at IS NULL) AS rejected_today
         FROM loans WHERE status = 'pengajuan' AND deleted_at IS NULL`),
  ]);
  return ok(rows, { summary });
}, { module: "loan_approvals" });
