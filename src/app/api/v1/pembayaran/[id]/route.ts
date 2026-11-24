import { one } from "@/lib/db";
import { handle, HttpError, idParam, ok } from "@/lib/http";
import { VERIFY_BLOCK } from "@/lib/queries";

// GET /api/v1/pembayaran/:id — detail bukti pembayaran + efek ke saldo pinjaman
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/pembayaran/[id]">) => {
  const id = idParam((await ctx.params).id);
  const r = await one(
    `SELECT p.id, p.amount, p.penalty_amount, p.method, p.method_note, p.paid_at, p.proof_image, p.location_name, p.lat, p.lng,
            p.notes, p.status, p.verification_notes, p.verified_at, p.receipt_code,
            i.sequence AS installment_sequence, i.total_amount AS installment_total, i.due_date, i.status AS installment_status,
            l.id AS loan_id, l.loan_number, l.tenor_duration, l.tenor_unit, m.name AS member_name, m.address AS member_address, r.name AS region_name,
            c.name AS collector_name, v.name AS verifier_name, vl.remaining_balance,
            ${VERIFY_BLOCK} AS verify_block
     FROM payments p
     LEFT JOIN cash_deposits d ON d.id = p.deposit_id
     JOIN installments i ON i.id = p.installment_id
     JOIN loans l ON l.id = i.loan_id
     JOIN v_loans vl ON vl.id = l.id
     JOIN members m ON m.id = l.member_id
     JOIN regions r ON r.id = m.region_id
     LEFT JOIN users c ON c.id = p.collector_id
     LEFT JOIN users v ON v.id = p.verified_by
     WHERE p.id = $1`,
    [id],
  );
  if (!r) throw new HttpError(404, "Pembayaran tidak ditemukan");
  const row = r as Record<string, number | string | null>;
  // saldo di view tidak menghitung angsuran 'lunas'; angsuran 'menunggu_verifikasi' masih dihitung
  const balanceBefore = Number(row.remaining_balance);
  const balanceAfter = row.status === "menunggu" ? balanceBefore - Number(row.installment_total) : balanceBefore;
  return ok({ ...r, balance_before: balanceBefore, balance_after: balanceAfter });
}, { module: "payments" });
