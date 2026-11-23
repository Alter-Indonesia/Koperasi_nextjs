import { z } from "zod";
import { tx } from "@/lib/db";
import { body, currentUser, handle, HttpError, idParam, ok } from "@/lib/http";
import { assertDepositsAccepted, payoffQuote } from "@/lib/payoff";

const Decision = z.object({
  action: z.enum(["approve", "reject", "verify"]),
  notes: z.string().trim().max(500).optional(),
});

// POST /api/v1/pelunasan/{id} { action: approve|reject|verify, notes? } — keputusan Admin atas pengajuan pelunasan.
//  approve: 'menunggu' -> 'disetujui' (anggota boleh membayar: transfer + unggah bukti, atau tunai lewat petugas). 409 bila sisa angsuran berubah.
//  reject : 'menunggu' | 'disetujui' | 'menunggu_verifikasi' -> 'ditolak' (alasan wajib). Tunai yang sudah diterima petugas: pembayaran ditolak, angsuran kembali 'belum'.
//  verify : 'menunggu_verifikasi' -> 'terverifikasi'. Transfer wajib punya bukti; tunai wajib sudah disetor & setorannya diterima. Semua angsuran tersisa lunas,
//           pinjaman 'lunas'. 409 bila sisa angsuran berubah; 422 bila ada pembayaran angsuran lain menunggu verifikasi.
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/pelunasan/[id]">) => {
  const id = idParam((await ctx.params).id);
  const d = await body(req, Decision);
  const me = currentUser();
  const res = await tx(async (c) => {
    const p = (await c.query("SELECT id, loan_id, member_id, amount, status, method, proof_image FROM loan_payoffs WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!p) throw new HttpError(404, "Pengajuan pelunasan tidak ditemukan");
    const amount = Number(p.amount);

    if (d.action === "approve") {
      if (p.status !== "menunggu") throw new HttpError(409, "Pengajuan ini sudah diproses");
      const loan = (await c.query("SELECT status FROM loans WHERE id = $1 FOR UPDATE", [p.loan_id])).rows[0];
      if (loan?.status !== "aktif") throw new HttpError(409, "Pinjaman sudah tidak berjalan");
      if ((await payoffQuote(p.loan_id, c)).amount !== amount) throw new HttpError(409, "Sisa angsuran berubah sejak diajukan. Tolak pengajuan ini dan minta anggota mengajukan ulang.");
      if (p.method === "tunai" && !(await c.query(
        "SELECT 1 FROM members m JOIN users u ON u.id = m.collector_id AND u.role = 'petugas' AND u.status = 'aktif' AND u.deleted_at IS NULL WHERE m.id = $1", [p.member_id],
      )).rowCount) throw new HttpError(422, "Anggota belum punya petugas. Tetapkan dulu di Penugasan Petugas agar uang tunai bisa diterima.");
      await c.query("UPDATE loan_payoffs SET status = 'disetujui', approved_at = now(), approved_by = $2, notes = $3, updated_by = $2 WHERE id = $1", [id, me.id, d.notes ?? null]);
      return { id, status: "disetujui" };
    }

    if (d.action === "reject") {
      if (!["menunggu", "disetujui", "menunggu_verifikasi"].includes(p.status)) throw new HttpError(409, "Pengajuan ini sudah diproses");
      if (!d.notes) throw new HttpError(422, "Alasan penolakan wajib diisi");
      if (p.status === "menunggu_verifikasi" && p.method === "tunai") {
        const ids = (await c.query("UPDATE payments SET status = 'ditolak', verification_notes = $2, verified_by = $3, verified_at = now(), updated_by = $3 WHERE payoff_id = $1 AND status = 'menunggu' RETURNING installment_id", [id, d.notes, me.id])).rows;
        if (ids.length) await c.query("UPDATE installments SET status = 'belum', updated_by = $2 WHERE id = ANY($1::int[])", [ids.map((r) => r.installment_id), me.id]);
      }
      await c.query("UPDATE loan_payoffs SET status = 'ditolak', notes = $2, decided_at = now(), decided_by = $3, updated_by = $3 WHERE id = $1", [id, d.notes, me.id]);
      return { id, status: "ditolak" };
    }

    // verify
    if (p.status !== "menunggu_verifikasi") throw new HttpError(409, p.status === "terverifikasi" ? "Pengajuan ini sudah diverifikasi" : "Pembayaran pelunasan belum masuk (belum ada bukti / belum diterima petugas)");
    const loan = (await c.query("SELECT status FROM loans WHERE id = $1 FOR UPDATE", [p.loan_id])).rows[0];
    if (loan?.status !== "aktif") throw new HttpError(409, "Pinjaman sudah tidak berjalan");
    let installmentsPaid: number;
    if (p.method === "transfer") {
      if (!p.proof_image) throw new HttpError(422, "Bukti transfer belum diunggah anggota");
      if ((await c.query("SELECT 1 FROM payments pm JOIN installments i ON i.id = pm.installment_id WHERE i.loan_id = $1 AND pm.status = 'menunggu' AND pm.deleted_at IS NULL", [p.loan_id])).rowCount)
        throw new HttpError(422, "Masih ada pembayaran angsuran yang menunggu verifikasi. Selesaikan dulu di Verifikasi Bayar.");
      if ((await payoffQuote(p.loan_id, c)).amount !== amount) throw new HttpError(409, "Sisa angsuran berubah sejak diajukan. Tolak pengajuan ini dan minta anggota mengajukan ulang.");
      const left = (await c.query("SELECT id, total_amount FROM installments WHERE loan_id = $1 AND status <> 'lunas' AND deleted_at IS NULL ORDER BY sequence", [p.loan_id])).rows;
      for (const i of left) {
        await c.query(
          `INSERT INTO payments (installment_id, amount, method, method_note, paid_at, status, notes, proof_image, payoff_id, verified_by, verified_at, created_by, updated_by)
           VALUES ($1, $2, 'transfer', 'Pelunasan dipercepat', now(), 'terverifikasi', $3, $4, $5, $6, now(), $6, $6)`,
          [i.id, i.total_amount, `Pelunasan dipercepat #${id}`, p.proof_image, id, me.id],
        );
        await c.query("UPDATE installments SET status = 'lunas', updated_by = $2 WHERE id = $1", [i.id, me.id]);
      }
      installmentsPaid = left.length;
    } else {
      await assertDepositsAccepted(c, id);
      const paid = (await c.query(
        "UPDATE payments SET status = 'terverifikasi', verified_by = $2, verified_at = now(), updated_by = $2 WHERE payoff_id = $1 AND status = 'menunggu' RETURNING installment_id", [id, me.id],
      )).rows;
      await c.query("UPDATE installments SET status = 'lunas', updated_by = $2 WHERE id = ANY($1::int[])", [paid.map((r) => r.installment_id), me.id]);
      installmentsPaid = paid.length;
    }
    await c.query("UPDATE loans SET status = 'lunas', updated_by = $2 WHERE id = $1", [p.loan_id, me.id]);
    await c.query("UPDATE loan_payoffs SET status = 'terverifikasi', notes = COALESCE($2, notes), decided_at = now(), decided_by = $3, updated_by = $3 WHERE id = $1", [id, d.notes ?? null, me.id]);
    return { id, status: "terverifikasi", loan_paid_off: true, installments_paid: installmentsPaid };
  });
  return ok(res);
}, { module: "payments", action: "update", log: "decide_payoff" });
