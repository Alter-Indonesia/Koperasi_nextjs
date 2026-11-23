import { tx } from "@/lib/db";
import { created, currentUser, handle, HttpError, idParam } from "@/lib/http";
import { receivePayoffCash } from "@/lib/payoff";
import { getSetting } from "@/lib/settings";

// POST /api/v1/petugas/pelunasan/{id}/terima — petugas menerima uang tunai untuk pengajuan pelunasan anggota yang sudah disetujui Admin (id = pengajuan).
// Hanya anggota yang dipegang petugas. Menghasilkan kwitansi ber-QR (kode bukti); uang masuk "uang tunai di tangan" → Setoran Kas → verifikasi Admin.
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/petugas/pelunasan/[id]/terima">) => {
  const id = idParam((await ctx.params).id);
  const me = currentUser();
  if (!(await getSetting("payment_cash_enabled", true))) throw new HttpError(422, "Pembayaran tunai sedang dinonaktifkan di pengaturan");
  const res = await tx(async (c) => {
    const p = (await c.query(
      `SELECT p.id, p.loan_id, p.member_id, p.status, p.method FROM loan_payoffs p JOIN members m ON m.id = p.member_id
       WHERE p.id = $1 AND p.deleted_at IS NULL AND m.collector_id = $2 FOR UPDATE OF p`, [id, me.id],
    )).rows[0];
    if (!p) throw new HttpError(404, "Pengajuan pelunasan tidak ditemukan di anggota yang Anda pegang");
    if (p.method !== "tunai") throw new HttpError(422, "Pengajuan ini bukan pelunasan tunai");
    if (p.status !== "disetujui") throw new HttpError(409, "Pengajuan ini belum disetujui Admin atau sudah diproses");
    await c.query("SELECT 1 FROM loans WHERE id = $1 FOR UPDATE", [p.loan_id]);
    return receivePayoffCash(c, { loanId: p.loan_id, memberId: p.member_id, collectorId: me.id, payoffId: p.id });
  });
  return created(res);
}, { module: "my_tasks", action: "create", log: "collect" });
