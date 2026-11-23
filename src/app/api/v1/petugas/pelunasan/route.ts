import { z } from "zod";
import { q, tx } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, intParam, ok } from "@/lib/http";
import { receivePayoffCash } from "@/lib/payoff";
import { getSetting } from "@/lib/settings";

// GET /api/v1/petugas/pelunasan?q= — pelunasan dipercepat anggota yang dipegang petugas (Penugasan Petugas):
//  approved = pengajuan tunai anggota yang sudah disetujui Admin dan menunggu uang diterima petugas
//  loans    = pinjaman aktif anggota yang dipegangnya (untuk menerima pelunasan tunai langsung); blocked = alasan belum bisa
//  mine     = pelunasan tunai yang sudah diterima petugas ini (kwitansi QR, status setor/verifikasi)
export const GET = handle(async (req: Request) => {
  const me = currentUser();
  const search = new URL(req.url).searchParams.get("q")?.trim() || null;
  const limit = intParam(new URL(req.url).searchParams.get("limit"), 30, 1, 100);
  const [approved, loans, mine] = await Promise.all([
    q(`SELECT p.id, p.loan_id, p.amount, p.installments_count, p.approved_at, l.loan_number, m.name AS member_name, m.member_number, m.phone AS member_phone, m.address AS member_address
       FROM loan_payoffs p JOIN loans l ON l.id = p.loan_id JOIN members m ON m.id = p.member_id
       WHERE p.status = 'disetujui' AND p.method = 'tunai' AND p.deleted_at IS NULL AND m.collector_id = $1 ORDER BY p.approved_at`, [me.id]),
    q(`SELECT l.id AS loan_id, l.loan_number, m.name AS member_name, m.member_number, m.phone AS member_phone,
              COALESCE(SUM(i.total_amount) FILTER (WHERE i.status <> 'lunas'), 0)::numeric AS amount,
              COUNT(i.id) FILTER (WHERE i.status <> 'lunas')::int AS installments_count,
              CASE WHEN EXISTS (SELECT 1 FROM loan_payoffs p WHERE p.loan_id = l.id AND p.status IN ('menunggu', 'disetujui', 'menunggu_verifikasi') AND p.deleted_at IS NULL) THEN 'Sudah ada pengajuan pelunasan'
                   WHEN bool_or(i.status = 'menunggu_verifikasi') THEN 'Ada pembayaran angsuran menunggu verifikasi' END AS blocked
       FROM loans l JOIN members m ON m.id = l.member_id AND m.deleted_at IS NULL JOIN installments i ON i.loan_id = l.id AND i.deleted_at IS NULL
       WHERE l.status = 'aktif' AND l.deleted_at IS NULL AND m.collector_id = $1 AND ($2::text IS NULL OR m.name ILIKE '%' || $2 || '%' OR l.loan_number ILIKE '%' || $2 || '%')
       GROUP BY l.id, m.id HAVING COUNT(i.id) FILTER (WHERE i.status <> 'lunas') > 0 ORDER BY m.name LIMIT $3`, [me.id, search, limit]),
    q(`SELECT p.id, p.amount, p.installments_count, p.status, p.source, p.receipt_code, p.received_at, p.notes, l.loan_number, m.name AS member_name,
              (SELECT CASE WHEN bool_or(d.id IS NULL) THEN 'belum_disetor' WHEN bool_or(d.status = 'menunggu') THEN 'setoran_menunggu'
                           WHEN bool_or(d.status = 'ditolak') THEN 'setoran_ditolak' ELSE 'setoran_diterima' END
               FROM payments pm LEFT JOIN cash_deposits d ON d.id = pm.deposit_id WHERE pm.payoff_id = p.id AND pm.deleted_at IS NULL) AS deposit_state
       FROM loan_payoffs p JOIN loans l ON l.id = p.loan_id JOIN members m ON m.id = p.member_id
       WHERE p.collector_id = $1 AND p.deleted_at IS NULL ORDER BY p.received_at DESC LIMIT 20`, [me.id]),
  ]);
  return ok({ approved, loans: loans.map((l) => ({ ...l, amount: Number(l.amount) })), mine }, { region_id: me.region_id });
}, { module: "my_tasks" });

const Direct = z.object({ loan_id: z.number().int().positive() });

// POST /api/v1/petugas/pelunasan { loan_id } — petugas menerima uang tunai pelunasan langsung dari anggota yang dipegangnya (tanpa persetujuan Admin).
// Seluruh sisa angsuran; menghasilkan kwitansi ber-QR (kode bukti). Uang masuk "uang tunai di tangan" → Setoran Kas → verifikasi Admin (menu Pelunasan).
export const POST = handle(async (req: Request) => {
  const me = currentUser();
  const d = await body(req, Direct);
  if (!(await getSetting("payment_cash_enabled", true))) throw new HttpError(422, "Pembayaran tunai sedang dinonaktifkan di pengaturan");
  const res = await tx(async (c) => {
    const loan = (await c.query(
      `SELECT l.id, l.status, l.member_id FROM loans l JOIN members m ON m.id = l.member_id AND m.deleted_at IS NULL
       WHERE l.id = $1 AND l.deleted_at IS NULL AND m.collector_id = $2 FOR UPDATE OF l`, [d.loan_id, me.id],
    )).rows[0];
    if (!loan) throw new HttpError(404, "Pinjaman tidak ditemukan di anggota yang Anda pegang");
    if (loan.status !== "aktif") throw new HttpError(422, "Hanya pinjaman yang sedang berjalan yang bisa dilunasi");
    if ((await c.query("SELECT 1 FROM loan_payoffs WHERE loan_id = $1 AND status IN ('menunggu', 'disetujui', 'menunggu_verifikasi') AND deleted_at IS NULL", [d.loan_id])).rowCount)
      throw new HttpError(409, "Sudah ada pengajuan pelunasan yang berjalan untuk pinjaman ini");
    return receivePayoffCash(c, { loanId: d.loan_id, memberId: loan.member_id, collectorId: me.id, payoffId: null });
  });
  return created(res);
}, { module: "my_tasks", action: "create", log: "collect" });
