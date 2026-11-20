import { z } from "zod";
import { one, tx } from "@/lib/db";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";
import { loanAmounts } from "@/lib/loan-calc";
import { createSchedule } from "@/lib/queries";

type Route = RouteContext<"/api/v1/persetujuan/[id]">;

// GET /api/v1/persetujuan/{id} — detail pengajuan
export const GET = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const r = await one(
    `SELECT l.id, l.loan_number, l.member_id, m.name AS member_name, m.member_number, m.phone AS member_phone, r.name AS region_name,
            l.principal_amount, l.tenor_duration, l.tenor_unit, l.admin_fee, l.admin_fee_mode, l.interest_rate_percent, l.installment_amount, l.purpose, l.collateral, l.disbursed_on, l.status,
            l.created_at, l.updated_at, s.name AS submitted_by_name, d.name AS decided_by_name, l.decided_at, l.decision_notes,
            (SELECT COUNT(*) FROM v_loans v WHERE v.member_id = l.member_id AND v.status = 'aktif') AS member_active_loans,
            (SELECT COALESCE(SUM(v.remaining_balance), 0) FROM v_loans v WHERE v.member_id = l.member_id AND v.status = 'aktif') AS member_outstanding
     FROM loans l JOIN members m ON m.id = l.member_id JOIN regions r ON r.id = m.region_id
     LEFT JOIN users s ON s.id = l.submitted_by LEFT JOIN users d ON d.id = l.decided_by
     WHERE l.id = $1 AND l.deleted_at IS NULL AND l.status IN ('pengajuan', 'aktif', 'ditolak', 'lunas')`,
    [id],
  );
  if (!r) throw new HttpError(404, "Pengajuan tidak ditemukan");
  return ok(r);
}, { module: "loan_approvals" });

const Decision = z.object({ action: z.enum(["approve", "reject"]), notes: z.string().trim().max(500).optional() });

// POST /api/v1/persetujuan/{id} { action: approve|reject, notes? } — keputusan Owner.
//  approve: status "aktif" + jadwal angsuran dibuat dari tanggal cair. reject: status "ditolak" (alasan wajib).
export const POST = handle(async (req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, Decision);
  if (d.action === "reject" && !d.notes) throw new HttpError(422, "Alasan penolakan wajib diisi");
  const me = currentUser();
  const res = await tx(async (c) => {
    const l = (await c.query("SELECT * FROM loans WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!l) throw new HttpError(404, "Pengajuan tidak ditemukan");
    if (l.status !== "pengajuan") throw new HttpError(409, "Pengajuan ini sudah diputuskan");
    if (d.action === "approve") {
      await createSchedule(c, id, { disbursed_on: l.disbursed_on, principal_amount: loanAmounts(Number(l.principal_amount), Number(l.admin_fee), l.admin_fee_mode).financed, interest_rate_percent: Number(l.interest_rate_percent), duration: l.tenor_duration, unit: l.tenor_unit }, me.id);
    }
    await c.query("UPDATE loans SET status = $2, decided_by = $3, decided_at = now(), decision_notes = $4, updated_by = $3 WHERE id = $1", [
      id, d.action === "approve" ? "aktif" : "ditolak", me.id, d.notes ?? null,
    ]);
    return { id, loan_number: l.loan_number, status: d.action === "approve" ? "aktif" : "ditolak" };
  });
  return ok(res);
}, { module: "loan_approvals", action: "update", log: "decide_loan" });
