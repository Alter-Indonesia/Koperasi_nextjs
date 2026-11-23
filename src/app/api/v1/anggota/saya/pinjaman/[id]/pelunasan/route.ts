import { z } from "zod";
import { tx } from "@/lib/db";
import { body, created, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";
import { payoffQuote } from "@/lib/payoff";
import { hapusBukti } from "@/lib/proof-file";
import { getSetting } from "@/lib/settings";

type Route = RouteContext<"/api/v1/anggota/saya/pinjaman/[id]/pelunasan">;

const NewPayoff = z.object({ method: z.enum(["transfer", "tunai"]) });

// POST /api/v1/anggota/saya/pinjaman/{id}/pelunasan { method: transfer|tunai } — ajukan pelunasan dipercepat (seluruh sisa angsuran).
// Status 'menunggu' (persetujuan Admin) -> 'disetujui' -> bayar (transfer: unggah bukti · tunai: lewat petugas) -> 'menunggu_verifikasi' -> Admin verifikasi.
export const POST = handle(async (req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, NewPayoff);
  const me = currentUser();
  if (!me.member_id) throw new HttpError(404, "Akun ini tidak terhubung ke data anggota");
  if (!(await getSetting(d.method === "tunai" ? "payment_cash_enabled" : "payment_transfer_enabled", true))) throw new HttpError(422, `Pembayaran ${d.method} sedang dinonaktifkan di pengaturan`);
  const res = await tx(async (c) => {
    const loan = (await c.query("SELECT id, status FROM loans WHERE id = $1 AND member_id = $2 AND deleted_at IS NULL FOR UPDATE", [id, me.member_id])).rows[0];
    if (!loan) throw new HttpError(404, "Pinjaman tidak ditemukan");
    if (loan.status !== "aktif") throw new HttpError(422, "Hanya pinjaman yang sedang berjalan yang bisa dilunasi");
    if ((await c.query("SELECT 1 FROM loan_payoffs WHERE loan_id = $1 AND status IN ('menunggu', 'disetujui', 'menunggu_verifikasi') AND deleted_at IS NULL", [id])).rowCount)
      throw new HttpError(409, "Sudah ada pengajuan pelunasan yang berjalan untuk pinjaman ini");
    if ((await c.query("SELECT 1 FROM payments p JOIN installments i ON i.id = p.installment_id WHERE i.loan_id = $1 AND p.status = 'menunggu' AND p.deleted_at IS NULL", [id])).rowCount)
      throw new HttpError(422, "Masih ada pembayaran angsuran yang menunggu verifikasi. Tunggu hingga selesai diverifikasi.");
    const quote = await payoffQuote(id, c);
    if (quote.count === 0) throw new HttpError(422, "Tidak ada angsuran yang tersisa");
    const r = (await c.query(
      `INSERT INTO loan_payoffs (loan_id, member_id, amount, installments_count, method, source, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, 'anggota', $6, $6)
       RETURNING id, amount, installments_count, method, status`,
      [id, me.member_id, quote.amount, quote.count, d.method, me.id],
    )).rows[0];
    return { ...r, amount: Number(r.amount) };
  });
  return created(res);
}, { module: "my_loans", log: "request_payoff" });

// DELETE /api/v1/anggota/saya/pinjaman/{id}/pelunasan — batalkan pengajuan yang belum dibayar.
// Boleh saat menunggu / disetujui, atau transfer yang buktinya sudah terkirim; tunai yang sudah diterima petugas tidak bisa dibatalkan (409).
export const DELETE = handle(async (_req: Request, ctx: Route) => {
  const id = idParam((await ctx.params).id);
  const me = currentUser();
  if (!me.member_id) throw new HttpError(404, "Akun ini tidak terhubung ke data anggota");
  const res = await tx(async (c) => {
    const p = (await c.query(
      "SELECT id, status, method, proof_image FROM loan_payoffs WHERE loan_id = $1 AND member_id = $2 AND status IN ('menunggu', 'disetujui', 'menunggu_verifikasi') AND deleted_at IS NULL FOR UPDATE",
      [id, me.member_id],
    )).rows[0];
    if (!p) throw new HttpError(404, "Tidak ada pengajuan pelunasan yang berjalan");
    if (p.status === "menunggu_verifikasi" && p.method === "tunai") throw new HttpError(409, "Uang tunai sudah diterima petugas, pengajuan tidak bisa dibatalkan");
    await c.query("UPDATE loan_payoffs SET status = 'dibatalkan', decided_at = now(), updated_by = $2 WHERE id = $1", [p.id, me.id]);
    return { id: p.id as number, proof_image: p.proof_image as string | null };
  });
  if (res.proof_image) await hapusBukti(res.proof_image);
  return ok({ id: res.id, status: "dibatalkan" });
}, { module: "my_loans", action: "create", log: "cancel_payoff" });
