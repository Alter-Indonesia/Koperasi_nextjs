import path from "node:path";
import { one } from "@/lib/db";
import { handle, HttpError, idParam } from "@/lib/http";
import { bacaBerkasBukti, MIME_BUKTI } from "@/lib/proof-file";

// GET /api/v1/pelunasan/{id}/bukti -> foto bukti transfer pelunasan (wajib login; tidak ada URL publik)
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/pelunasan/[id]/bukti">) => {
  const id = idParam((await ctx.params).id);
  const p = await one<{ proof_image: string | null }>("SELECT proof_image FROM loan_payoffs WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (!p) throw new HttpError(404, "Pengajuan pelunasan tidak ditemukan");
  if (!p.proof_image) throw new HttpError(404, "Bukti transfer belum diunggah");
  const file = await bacaBerkasBukti(p.proof_image);
  if (!file) throw new HttpError(404, "Berkas bukti tidak ditemukan");
  return new Response(new Uint8Array(file), {
    headers: { "content-type": MIME_BUKTI[path.extname(p.proof_image).slice(1)] ?? "application/octet-stream", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}, { module: "payments" });
