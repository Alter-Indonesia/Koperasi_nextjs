import { q } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { currentUser, handle, HttpError, ok } from "@/lib/http";

type Loan = { id: number; status: string };
type Installment = { id: number; loan_id: number; status: string; total_amount: number };
type Payment = { id: number; loan_id: number };
type Payoff = {
  id: number; loan_id: number; amount: number; installments_count: number; method: string; status: string; requested_at: string; approved_at: string | null;
  receipt_code: string | null; has_proof: boolean; collector_name: string | null; notes: string | null; decided_at: string | null;
};

// GET /api/v1/anggota/saya/pinjaman — semua pinjaman anggota yang login beserta jadwal angsuran, riwayat bayar, dan status pelunasan dipercepat (hanya data miliknya)
export const GET = handle(async () => {
  const me = currentUser();
  if (!me.member_id) throw new HttpError(404, "Akun ini tidak terhubung ke data anggota");
  const loans = await q<Loan>(
    `SELECT id, loan_number, purpose, status, principal_amount, loan_amount, tenor_duration, tenor_unit, interest_rate_percent, installment_amount,
            disbursed_on, remaining_balance, paid_installments, next_due_date, arrears_amount, days_overdue, collectibility
     FROM v_loans WHERE member_id = $1
     ORDER BY (status = 'aktif') DESC, (status = 'pengajuan') DESC, id DESC`,
    [me.member_id],
  );
  const ids = loans.map((l) => l.id);
  // petugas pemegang anggota (Penugasan Petugas): tunai lewat petugas hanya bisa bila anggota sudah punya petugas
  const collector = (await q<{ name: string }>(
    `SELECT u.name FROM members m JOIN users u ON u.id = m.collector_id AND u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL WHERE m.id = $1`, [me.member_id],
  ))[0]?.name ?? null;
  const [installments, payments, payoffs, bankName, bankNumber, bankHolder, cashOn, transferOn] = ids.length
    ? await Promise.all([
        q<Installment>(
          `SELECT id, loan_id, sequence, due_date, total_amount, status, GREATEST(0, CURRENT_DATE - due_date)::int * (status = 'belum')::int AS days_overdue
           FROM installments WHERE loan_id = ANY($1) AND deleted_at IS NULL ORDER BY loan_id, sequence`, [ids]),
        q<Payment>(
          `SELECT p.id, i.loan_id, i.sequence, p.amount, p.penalty_amount, p.method, p.paid_at, p.status
           FROM payments p JOIN installments i ON i.id = p.installment_id
           WHERE i.loan_id = ANY($1) AND p.deleted_at IS NULL ORDER BY p.paid_at DESC, p.id DESC`, [ids]),
        // pengajuan berjalan, atau keputusan terakhir bila ditolak (agar anggota tahu alasannya)
        q<Payoff>(
          `SELECT DISTINCT ON (p.loan_id) p.id, p.loan_id, p.amount, p.installments_count, p.method, p.status, p.requested_at, p.approved_at, p.receipt_code,
                  (p.proof_image IS NOT NULL) AS has_proof, u.name AS collector_name, p.notes, p.decided_at
           FROM loan_payoffs p LEFT JOIN users u ON u.id = p.collector_id
           WHERE p.loan_id = ANY($1) AND p.deleted_at IS NULL AND p.status IN ('menunggu', 'disetujui', 'menunggu_verifikasi', 'ditolak')
           ORDER BY p.loan_id, (p.status = 'ditolak'), p.id DESC`, [ids]),
        getSetting("bank_name", ""), getSetting("bank_account_number", ""), getSetting("bank_account_name", ""),
        getSetting("payment_cash_enabled", true), getSetting("payment_transfer_enabled", true),
      ])
    : [[], [], [], "", "", "", true, true];
  return ok(loans.map((l) => {
    const insts = installments.filter((i) => i.loan_id === l.id);
    const left = insts.filter((i) => i.status !== "lunas");
    const req = payoffs.find((p) => p.loan_id === l.id) ?? null;
    const active = req && req.status !== "ditolak" ? req : null;
    const hasPendingPayment = left.some((i) => i.status === "menunggu_verifikasi");
    return {
      ...l,
      installments: insts,
      payments: payments.filter((p) => p.loan_id === l.id),
      // pelunasan dipercepat = seluruh sisa angsuran (lihat lib/payoff.ts); hanya untuk pinjaman aktif
      payoff: l.status === "aktif" && left.length > 0
        ? {
            amount: left.reduce((s, i) => s + Number(i.total_amount), 0),
            installments_count: left.length,
            request: active && { ...active, amount: Number(active.amount) },
            last_rejected: req && req.status === "ditolak" ? { notes: req.notes, decided_at: req.decided_at } : null,
            methods: { tunai: cashOn && !!collector, transfer: transferOn },
            collector_name: collector,
            blocked_reason: hasPendingPayment && !active ? "Masih ada pembayaran angsuran yang menunggu verifikasi" : null,
            bank: { name: bankName, number: bankNumber, holder: bankHolder },
          }
        : null,
    };
  }));
}, { module: "my_loans" });
