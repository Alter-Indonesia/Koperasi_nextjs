import { one, q } from "@/lib/db";
import { currentUser, handle, HttpError, idParam, ok } from "@/lib/http";
import { bacaBukti, hapusBukti, simpanBukti } from "@/lib/proof-file";

// POST /api/v1/anggota/saya/pinjaman/{id}/pelunasan/bukti (multipart, field `foto`) — unggah bukti transfer pelunasan.
// Hanya untuk pengajuan transfer yang sudah disetujui Admin (boleh mengganti selama belum diverifikasi); status menjadi 'menunggu_verifikasi'.
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/anggota/saya/pinjaman/[id]/pelunasan/bukti">) => {
  const id = idParam((await ctx.params).id);
  const me = currentUser();
  if (!me.member_id) throw new HttpError(404, "Akun ini tidak terhubung ke data anggota");
  const p = await one<{ id: number; status: string; method: string; proof_image: string | null }>(
    "SELECT id, status, method, proof_image FROM loan_payoffs WHERE loan_id = $1 AND member_id = $2 AND status IN ('disetujui', 'menunggu_verifikasi') AND deleted_at IS NULL", [id, me.member_id],
  );
  if (!p) throw new HttpError(404, "Tidak ada pengajuan pelunasan yang menunggu pembayaran");
  if (p.method !== "transfer") throw new HttpError(422, "Bukti transfer hanya untuk pelunasan dengan metode transfer");
  const { buf, ext } = await bacaBukti(req);
  const nama = await simpanBukti(buf, ext);
  await q("UPDATE loan_payoffs SET proof_image = $2, proof_uploaded_at = now(), status = 'menunggu_verifikasi', updated_by = $3 WHERE id = $1", [p.id, nama, me.id]);
  if (p.proof_image) await hapusBukti(p.proof_image);
  return ok({ id: p.id, status: "menunggu_verifikasi" });
}, { module: "my_loans", action: "create", log: "upload" });
